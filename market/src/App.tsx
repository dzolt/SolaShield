import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Coins, Tag } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cancelListing, claimTokens, createListing, finalize, fund, refund, submitAttestation, verifyListing } from "./actions";
import { simAccounts, simMove, simPrivacy, simReset, type AttestRequest, type AttestResult, type InventoryItem } from "./attestor";
import { DealBrowser } from "./components/browse/DealBrowser";
import { DealDrawer } from "./components/deal/DealDrawer";
import { DemoPanel } from "./components/demo/DemoPanel";
import type { ItemLook } from "./components/items/ItemCard";
import { Footer } from "./components/layout/Footer";
import { Landing } from "./components/layout/Landing";
import { TopBar } from "./components/layout/TopBar";
import { Composer } from "./components/sell/Composer";
import { FAUCET_TOKENS, explorerTx } from "./config";
import { loadSnapshot, type Deal } from "./data";
import { explainError } from "./errors";
import { useActionRunner, useChainClock, usePoll, useToasts, type ActionOutcome } from "./hooks";
import { makeProgram } from "./program";
import { BUYER_FILTERS, dealFromUrl, roleFromUrl, SELLER_FILTERS, writeDealToUrl, writeRoleToUrl, type Role } from "./roles";
import { Button, Notice, Segmented, Toasts, TxStatus } from "./ui";

type SellerTab = "sell" | "mine";
type Proofs = Record<string, AttestResult[]>;

const PROOFS_KEY = "proofswap:proofs";

/** Evidence JSON is not stored on-chain (only its hash), so the page keeps the attestations it has seen. */
function loadProofs(): Proofs {
  try {
    return JSON.parse(localStorage.getItem(PROOFS_KEY) ?? "{}") as Proofs;
  } catch {
    return {};
  }
}

function saveProofs(proofs: Proofs): void {
  try {
    localStorage.setItem(PROOFS_KEY, JSON.stringify(proofs));
  } catch {
    // Storage can be unavailable (private mode); the proofs then live only in memory.
  }
}

const sameItem = (deal: Deal, item: InventoryItem): boolean => item.name === deal.itemName && item.wear === deal.wear && item.pattern === deal.pattern;

export function App() {
  const wallet = useAnchorWallet();
  const { setVisible } = useWalletModal();
  const owner = wallet?.publicKey;
  const program = useMemo(() => makeProgram(wallet), [wallet]);
  const snapshot = usePoll(() => loadSnapshot(program, owner));
  const sim = usePoll(() => simAccounts());
  const now = useChainClock(snapshot.data?.now);
  const toast = useToasts();
  const reloadSnapshot = snapshot.reload;
  const reloadSim = sim.reload;
  const reloadAll = useCallback(async () => {
    await Promise.all([reloadSnapshot(), reloadSim()]);
  }, [reloadSnapshot, reloadSim]);
  const runner = useActionRunner(toast, reloadAll, explorerTx);

  const [role, setRole] = useState<Role | undefined>(roleFromUrl);
  const [tab, setTab] = useState<SellerTab>("sell");
  const [selected, setSelected] = useState<string | undefined>(dealFromUrl);
  const [demoOpen, setDemoOpen] = useState(false);
  const [proofs, setProofs] = useState<Proofs>(loadProofs);
  const [extraLooks, setExtraLooks] = useState<Record<string, ItemLook>>({});

  useEffect(() => writeDealToUrl(selected), [selected]);

  const looks = useMemo(() => {
    const map: Record<string, ItemLook> = { ...extraLooks };
    for (const account of sim.data ?? []) for (const item of account.items) map[item.name] = { icon: item.icon, color: item.color };
    return map;
  }, [sim.data, extraLooks]);
  const lookFor = useCallback((name: string): ItemLook => looks[name] ?? {}, [looks]);
  const onLoaded = useCallback((items: readonly InventoryItem[]) => {
    setExtraLooks((current) => ({ ...current, ...Object.fromEntries(items.map((item) => [item.name, { icon: item.icon, color: item.color }])) }));
  }, []);

  const deals = snapshot.data?.deals;
  const deal = deals?.find((d) => d.address.toBase58() === selected);
  const myDeals = owner ? (deals ?? []).filter((d) => d.seller.equals(owner) && d.status !== "completed" && d.status !== "refunded").length : 0;

  const addProof = useCallback((attestation: AttestResult) => {
    setProofs((current) => {
      const next = { ...current, [attestation.deal]: [attestation, ...(current[attestation.deal] ?? [])] };
      saveProofs(next);
      return next;
    });
  }, []);

  const pick = (next: Role | undefined) => {
    writeRoleToUrl(next);
    setRole(next);
    setSelected(undefined);
    setTab("sell");
  };

  const needWallet = () => {
    if (!wallet || !owner) throw new Error("Połącz portfel.");
    return { wallet, owner };
  };

  const onClaim = () => void runner.run(() => claimTokens(needWallet().wallet));

  const onList = (steamId: string, item: InventoryItem, price: string) =>
    void runner.run(async (): Promise<ActionOutcome> => {
      const { owner: seller } = needWallet();
      const listed = await createListing(program, seller, steamId, item, price);
      setSelected(listed.deal.toBase58());
      setTab("mine");
      try {
        const verified = await verifyListing(program, seller, listed.deal);
        addProof(verified.attestation);
        return { message: `${listed.outcome.message} ${verified.outcome.message}`, signature: verified.outcome.signature };
      } catch (e: unknown) {
        return { message: `${listed.outcome.message} Potwierdzenie w Steam się nie udało: ${explainError(e)}`, signature: listed.outcome.signature };
      }
    });

  const onAttest = (request: AttestRequest) =>
    void runner.run(async () => {
      if (!deal) throw new Error("Wybierz transakcję.");
      const { owner: submitter } = needWallet();
      const result = await submitAttestation(program, submitter, deal, request);
      addProof(result.attestation);
      return result.outcome;
    });

  const withDeal = (action: (submitter: NonNullable<typeof owner>, d: Deal) => Promise<ActionOutcome>) =>
    void runner.run(async () => {
      if (!deal) throw new Error("Wybierz transakcję.");
      return action(needWallet().owner, deal);
    });

  /** The seller's item as the simulator knows it, when both Steam accounts of the deal are demo accounts. */
  const simulatedItem = (d: Deal | undefined): { from: string; to: string; assetid: string } | undefined => {
    const accounts = sim.data ?? [];
    if (!d || !d.buyer) return undefined;
    const seller = accounts.find((a) => a.steamId === d.sellerSteamId);
    const buyer = accounts.find((a) => a.steamId === d.buyerSteamId);
    const item = seller?.items.find((i) => i.tradable && sameItem(d, i));
    return seller && buyer && item ? { from: seller.steamId, to: buyer.steamId, assetid: item.assetid } : undefined;
  };

  const onSimulateTrade = () =>
    void runner.run(async () => {
      const move = simulatedItem(deal);
      if (!move) throw new Error("Tego przedmiotu nie ma w symulatorze. Przekaż go zwykłą wymianą na Steamie.");
      const moved = await simMove(move.from, move.to, move.assetid);
      return { message: `Wymiana w symulatorze wykonana. Przedmiot dostał nowe ID: ${moved.newAssetId}. Teraz sprawdź dostawę.` };
    });

  const unfunded = !!owner && snapshot.data?.wallet !== undefined && snapshot.data.wallet.tokens === 0n;

  return (
    <>
      <TopBar
        role={role}
        onRole={pick}
        onHome={() => pick(undefined)}
        owner={owner}
        wallet={snapshot.data?.wallet}
        busy={runner.busy}
        onClaim={onClaim}
        onOpenDemo={role === "seller" ? () => setDemoOpen(true) : undefined}
      />

      {!role ? (
        <Landing onPick={pick} />
      ) : (
        <main className="page">
          {role === "buyer" ? (
            <div className="page-head">
              <div>
                <h1>Rynek</h1>
                <p className="lead">Ogłoszenia, które źródło już potwierdziło. Płacisz do sejfu programu, a nie do sprzedającego.</p>
              </div>
            </div>
          ) : (
            <div className="page-head">
              <div>
                <h1>Sprzedaję</h1>
                <p className="lead">Wybierz przedmiot z inventory i wystaw go. Źródło potwierdzi, że go masz, a kupujący zapłaci do sejfu, zanim cokolwiek przekażesz.</p>
              </div>
              <Segmented
                value={tab}
                onChange={setTab}
                label="Widok sprzedającego"
                options={[
                  { value: "sell", label: "Wystaw" },
                  { value: "mine", label: "Moje ogłoszenia", count: myDeals },
                ]}
              />
            </div>
          )}

          {snapshot.error ? <Notice tone="bad">Nie udało się odczytać łańcucha: {snapshot.error}</Notice> : null}
          {unfunded ? (
            <Notice
              action={
                <Button size="sm" variant="primary" icon={<Coins />} disabled={runner.busy} onClick={onClaim}>
                  Odbierz {FAUCET_TOKENS} tUSDC
                </Button>
              }
            >
              Nie masz jeszcze testowych tUSDC, a potrzebujesz ich do płacenia.
            </Notice>
          ) : null}

          {role === "buyer" ? (
            <DealBrowser
              deals={deals}
              filters={BUYER_FILTERS}
              now={now}
              owner={owner}
              lookFor={lookFor}
              onOpen={setSelected}
              emptyAction={(filter) =>
                filter.id === "open" ? (
                  <Button variant="soft" icon={<Tag />} onClick={() => pick("seller")}>
                    Wystaw pierwszy przedmiot
                  </Button>
                ) : null
              }
            />
          ) : tab === "sell" ? (
            <Composer owner={owner} runner={runner} onLoaded={onLoaded} onList={onList} onConnect={() => setVisible(true)} />
          ) : (
            <DealBrowser key="mine" deals={deals} filters={SELLER_FILTERS} now={now} owner={owner} lookFor={lookFor} onOpen={setSelected} />
          )}

          <Footer />
        </main>
      )}

      {role ? (
        <DealDrawer
          deal={deal}
          now={now}
          owner={owner}
          role={role}
          runner={runner}
          proofs={deal ? (proofs[deal.address.toBase58()] ?? []) : []}
          look={deal ? lookFor(deal.itemName) : {}}
          simAvailable={!!simulatedItem(deal)}
          onClose={() => setSelected(undefined)}
          onConnect={() => setVisible(true)}
          onAttest={onAttest}
          onFund={(steamId) =>
            withDeal(async (buyer, d) => {
              const funded = await fund(program, buyer, d, steamId);
              addProof(funded.attestation);
              return funded.outcome;
            })
          }
          onCancel={() =>
            withDeal(async (seller, d) => {
              const outcome = await cancelListing(program, seller, d);
              setSelected(undefined);
              return outcome;
            })
          }
          onFinalize={() => withDeal((submitter, d) => finalize(program, submitter, d))}
          onRefund={() => withDeal((submitter, d) => refund(program, submitter, d))}
          onSimulateTrade={onSimulateTrade}
        />
      ) : null}

      {role === "seller" ? (
        <DemoPanel
          open={demoOpen}
          onClose={() => setDemoOpen(false)}
          accounts={sim.data}
          error={sim.error}
          deal={deal}
          busy={runner.busy}
          onMove={(from, to, assetid) =>
            void runner.run(async () => {
              const moved = await simMove(from, to, assetid);
              return { message: `Wymiana w symulatorze wykonana. Przedmiot dostał nowe ID: ${moved.newAssetId}.` };
            })
          }
          onPrivacy={(steamId, isPrivate) =>
            void runner.run(async () => {
              await simPrivacy(steamId, isPrivate);
              return { message: isPrivate ? "Inventory ukryte." : "Inventory znowu publiczne." };
            })
          }
          onReset={() =>
            void runner.run(async () => {
              await simReset();
              return { message: "Przywrócono inventory demo." };
            })
          }
        />
      ) : null}

      <TxStatus busy={runner.busy} state={runner.phase} />
      <Toasts toasts={toast.toasts} dismiss={toast.dismiss} />
    </>
  );
}
