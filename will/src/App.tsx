import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { useCallback, useMemo, useState } from "react";
import {
  cancelWill, checkIn, claimShare, claimTokens, createWill, deposit, lockHeirs, setGuardian, setHeirs, triggerDistribution, veto, withdraw,
  type HeirDraft,
} from "./actions";
import { CreatePanel } from "./components/CreatePanel";
import { Header } from "./components/Header";
import { HowItWorks } from "./components/HowItWorks";
import { WillList } from "./components/WillList";
import { WillPanel } from "./components/WillPanel";
import { explorerTx } from "./config";
import { loadSnapshot, rolesOf, type Will } from "./data";
import { useActionRunner, useChainClock, usePoll, useToasts, type ActionOutcome } from "./hooks";
import { makeProgram } from "./program";
import { Toasts } from "./ui";

export function App() {
  const wallet = useAnchorWallet();
  const owner = wallet?.publicKey;
  const program = useMemo(() => makeProgram(wallet), [wallet]);
  const snapshot = usePoll(() => loadSnapshot(program, owner));
  const now = useChainClock(snapshot.data?.now);
  const toast = useToasts();
  const runner = useActionRunner(toast, snapshot.reload, explorerTx);
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const wills = snapshot.data?.wills ?? [];
  const mine = wills.filter((w) => rolesOf(w, owner).length > 0);
  const others = wills.filter((w) => rolesOf(w, owner).length === 0);
  const will = wills.find((w) => w.address.toBase58() === selected);

  const needWallet = () => {
    if (!wallet || !owner) throw new Error("Połącz portfel.");
    return { wallet, owner };
  };

  const withWill = useCallback(
    (action: (who: NonNullable<typeof owner>, w: Will) => Promise<ActionOutcome>) => {
      void runner.run(async () => {
        if (!will) throw new Error("Wybierz sejf.");
        return action(needWallet().owner, will);
      });
    },
    [runner, will], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onCreate = (guardian: string) =>
    void runner.run(async () => {
      const created = await createWill(program, needWallet().owner, guardian);
      setSelected(created.will.toBase58());
      return created.outcome;
    });

  return (
    <div className="app">
      <Header owner={owner} wallet={snapshot.data?.wallet} runner={runner} onClaim={() => void runner.run(() => claimTokens(needWallet().wallet))} />
      <HowItWorks />
      {snapshot.error ? <p className="banner">Nie udało się odczytać łańcucha: {snapshot.error}</p> : null}

      <div className="layout">
        <div className="stack">
          <CreatePanel owner={owner} busy={runner.busy} onCreate={onCreate} />
          <WillList title="Moje sejfy" wills={mine} now={now} me={owner} selected={selected} empty="Nie masz jeszcze sejfu ani nie jesteś w niczyim testamencie." onSelect={setSelected} />
          <WillList title="Wszystkie sejfy na łańcuchu" wills={others} now={now} me={owner} selected={selected} empty="Brak innych sejfów." onSelect={setSelected} />
        </div>
        <WillPanel
          will={will}
          now={now}
          me={owner}
          runner={runner}
          onCheckIn={() => withWill((who, w) => checkIn(program, who, w))}
          onDeposit={(amount) => withWill((who, w) => deposit(program, who, w, amount))}
          onWithdraw={(amount) => withWill((who, w) => withdraw(program, who, w, amount))}
          onGuardian={(address) => withWill((who, w) => setGuardian(program, who, w, address))}
          onCancel={() => withWill(async (who, w) => {
            const outcome = await cancelWill(program, who, w);
            setSelected(undefined);
            return outcome;
          })}
          onSaveHeirs={(drafts: readonly HeirDraft[]) => withWill((who, w) => setHeirs(program, who, w, drafts))}
          onLockHeirs={() => withWill((who, w) => lockHeirs(program, who, w))}
          onVeto={() => withWill((who, w) => veto(program, who, w))}
          onTrigger={() => withWill((who, w) => triggerDistribution(program, who, w))}
          onClaimShare={(index) => withWill((who, w) => claimShare(program, who, w, index))}
        />
      </div>
      <Toasts toasts={toast.toasts} dismiss={toast.dismiss} />
    </div>
  );
}
