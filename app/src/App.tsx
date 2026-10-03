import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buyCover,
  claimFaucet,
  depositLiquidity,
    settleCover,
  voidCover,
  withdrawLiquidity,
  type CoverOrder,
} from "./actions";
import { loadActivity, withEntry, type ActivityEntry } from "./activity";
import { ActivityLog } from "./components/ActivityLog";
import { BuyPolicyPanel } from "./components/BuyPolicyPanel";
import { LiquidityPanel } from "./components/LiquidityPanel";
import { NoIntermediaryPanel } from "./components/NoIntermediaryPanel";
import { PoliciesPanel } from "./components/PoliciesPanel";
import { PoolPanel } from "./components/PoolPanel";
import { WalletPanel } from "./components/WalletPanel";
import { explorerTx } from "./config";
import { loadSnapshot, type PolicyView, type ProductView } from "./data";
import { useActionRunner, usePoll, useToasts } from "./hooks";
import { makeProgram } from "./program";
import { Toasts } from "./ui";

export function App() {
  const wallet = useAnchorWallet();
  const owner = wallet?.publicKey;
  const program = useMemo(() => makeProgram(wallet), [wallet]);
  const [activity, setActivity] = useState<readonly ActivityEntry[]>(() => loadActivity());

  const { data: snapshot, error, reload } = usePoll(() => loadSnapshot(program, owner));
  const toast = useToasts();
  const record = useCallback(
    (outcome: { message: string; signature?: string }) => {
      const { signature } = outcome;
      if (signature) setActivity((entries) => withEntry(entries, { signature, text: outcome.message, at: Date.now() }));
    },
    [],
  );
  const runner = useActionRunner(toast, record, reload, explorerTx);

  // A different wallet account means different balances: refresh right away.
  useEffect(() => {
    void reload();
  }, [owner, reload]);

  const context = owner ? { program, owner } : undefined;
  const needWallet = () => {
    if (!context) throw new Error("Najpierw połącz portfel.");
    return context;
  };

  return (
    <main className="app">
      <header className="hero">
        <h1>🛡️ SolaShield: ochrona wypłaty w SOL</h1>
        <p>
          Dla freelancerów i contributorów DAO, którzy dostają wynagrodzenie w SOL. Kupujesz ochronę do dnia wypłaty:
          jeśli kurs SOL/USD spadnie o wybrany procent, program sam wypłaci ustaloną kwotę w tUSDC. Bez ubezpieczyciela,
          likwidatora szkód i zgody administratora: o wypłacie decyduje kod i cena z Pytha.
        </p>
      </header>

      {error ? <div className="banner">Błąd połączenia z siecią: {error}</div> : null}

      <WalletPanel owner={owner} snapshot={snapshot} runner={runner} onClaim={() => claimFaucet(needWallet())} />

      {snapshot ? (
        <>
          <div className="grid two">
            <PoolPanel snapshot={snapshot} />
            <div className="stack">
              <LiquidityPanel
                snapshot={snapshot}
                runner={runner}
                connected={Boolean(owner)}
                onDeposit={(amount) => depositLiquidity(needWallet(), amount)}
                onWithdraw={(amount) => withdrawLiquidity(needWallet(), amount, snapshot)}
              />
              <BuyPolicyPanel
                snapshot={snapshot}
                runner={runner}
                connected={Boolean(owner)}
                onBuy={(order: CoverOrder) => buyCover(needWallet(), order)}
              />
            </div>
          </div>
          <div className="grid two">
            <PoliciesPanel
              snapshot={snapshot}
              owner={owner}
              runner={runner}
              connected={Boolean(owner)}
              onSettle={(policy: PolicyView, product: ProductView) => settleCover(needWallet(), policy, product)}
              onVoid={(policy: PolicyView) => voidCover(needWallet(), policy)}
            />
            <ActivityLog entries={activity} />
          </div>
        </>
      ) : null}
      <NoIntermediaryPanel />
      <Toasts toasts={toast.toasts} dismiss={toast.dismiss} />
    </main>
  );
}
