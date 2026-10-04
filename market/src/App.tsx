import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { useCallback, useMemo, useState } from "react";
import { cancelListing, claimTokens, createListing, finalize, fund, refund, submitAttestation, verifyListing } from "./actions";
import { simAccounts, simMove, simPrivacy, simReset, type AttestRequest, type AttestResult, type InventoryItem } from "./attestor";
import { DealPanel } from "./components/DealPanel";
import { Header } from "./components/Header";
import { HowItWorks } from "./components/HowItWorks";
import { MarketGrid } from "./components/MarketGrid";
import { SellPanel } from "./components/SellPanel";
import { SteamSimulator } from "./components/SteamSimulator";
import { explorerTx } from "./config";
import { loadSnapshot } from "./data";
import { explainError } from "./errors";
import { useActionRunner, useChainClock, usePoll, useToasts, type ActionOutcome } from "./hooks";
import { makeProgram } from "./program";
import { Toasts, TxStatus } from "./ui";

type Tab = "market" | "sell";
type Look = { icon?: string; color?: string };
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

export function App() {
  const wallet = useAnchorWallet();
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

  const [tab, setTab] = useState<Tab>("market");
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [proofs, setProofs] = useState<Proofs>(loadProofs);
  const [extraLooks, setExtraLooks] = useState<Record<string, Look>>({});

  const looks = useMemo(() => {
    const map: Record<string, Look> = { ...extraLooks };
    for (const account of sim.data ?? []) for (const item of account.items) map[item.name] = { icon: item.icon, color: item.color };
    return map;
  }, [sim.data, extraLooks]);
  const lookFor = useCallback((name: string): Look => looks[name] ?? {}, [looks]);

  const deals = snapshot.data?.deals ?? [];
  const deal = deals.find((d) => d.address.toBase58() === selected);

  const addProof = useCallback((attestation: AttestResult) => {
    setProofs((current) => {
      const next = { ...current, [attestation.deal]: [attestation, ...(current[attestation.deal] ?? [])] };
      saveProofs(next);
      return next;
    });
  }, []);

  const needWallet = () => {
    if (!wallet || !owner) throw new Error("Połącz portfel.");
    return { wallet, owner };
  };

  const onList = (steamId: string, item: InventoryItem, price: string) =>
    void runner.run(async (): Promise<ActionOutcome> => {
      const { owner: seller } = needWallet();
      const listed = await createListing(program, seller, steamId, item, price);
      setSelected(listed.deal.toBase58());
      setTab("market");
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

  const withDeal = (action: (submitter: NonNullable<typeof owner>, d: NonNullable<typeof deal>) => Promise<ActionOutcome>) =>
    void runner.run(async () => {
      if (!deal) throw new Error("Wybierz transakcję.");
      return action(needWallet().owner, deal);
    });

  return (
    <div className="app">
      <Header owner={owner} wallet={snapshot.data?.wallet} runner={runner} onClaim={() => void runner.run(() => claimTokens(needWallet().wallet))} />
      <HowItWorks />
      {snapshot.error ? <p className="banner">Nie udało się odczytać łańcucha: {snapshot.error}</p> : null}

      <div className="layout">
        <div className="stack">
          <div className="tabs">
            <button className={tab === "market" ? "active" : ""} onClick={() => setTab("market")}>
              Rynek
            </button>
            <button className={tab === "sell" ? "active" : ""} onClick={() => setTab("sell")}>
              Wystaw skina
            </button>
          </div>
          {tab === "market" ? (
            <MarketGrid deals={deals} now={now} owner={owner} selected={selected} iconFor={lookFor} onSelect={setSelected} />
          ) : (
            <SellPanel
              owner={owner}
              runner={runner}
              onLoaded={(items) => setExtraLooks((current) => ({ ...current, ...Object.fromEntries(items.map((i) => [i.name, { icon: i.icon, color: i.color }])) }))}
              onList={onList}
            />
          )}
        </div>
        <DealPanel
          deal={deal}
          now={now}
          owner={owner}
          runner={runner}
          proofs={deal ? (proofs[deal.address.toBase58()] ?? []) : []}
          look={deal ? lookFor(deal.itemName) : {}}
          onAttest={onAttest}
          onFund={(steamId) =>
            withDeal(async (buyer, d) => {
              const funded = await fund(program, buyer, d, steamId);
              addProof(funded.attestation);
              return funded.outcome;
            })
          }
          onCancel={() => withDeal((seller, d) => cancelListing(program, seller, d))}
          onFinalize={() => withDeal((submitter, d) => finalize(program, submitter, d))}
          onRefund={() => withDeal((submitter, d) => refund(program, submitter, d))}
        />
      </div>

      <SteamSimulator
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
      <TxStatus busy={runner.busy} state={runner.phase} />
      <Toasts toasts={toast.toasts} dismiss={toast.dismiss} />
    </div>
  );
}
