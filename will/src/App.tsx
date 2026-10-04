import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { useCallback, useMemo, useState } from "react";
import {
  cancelWill, checkIn, claimShare, claimTokens, createWill, deposit, lockHeirs, setGuardian, setHeirs, triggerDistribution, veto, withdraw,
  type HeirDraft,
} from "./actions";
import { CreatePanel } from "./components/CreatePanel";
import { Header } from "./components/Header";
import { HowItWorks } from "./components/HowItWorks";
import { RoleBar, RolePicker } from "./components/RolePicker";
import { WillList } from "./components/WillList";
import { WillPanel } from "./components/WillPanel";
import { explorerTx } from "./config";
import { loadSnapshot, rolesOf, type Role, type Will } from "./data";
import { useActionRunner, useChainClock, usePoll, useToasts, type ActionOutcome } from "./hooks";
import { makeProgram } from "./program";
import { Card, Toasts, TxStatus } from "./ui";

const LIST_TITLES: Readonly<Record<Role, string>> = {
  owner: "Moje sejfy",
  guardian: "Sejfy, w których jestem strażnikiem",
  heir: "Testamenty, w których jestem spadkobiercą",
};

const EMPTY_TEXT: Readonly<Record<Role, string>> = {
  owner: "Nie masz jeszcze sejfu. Załóż pierwszy.",
  guardian: "Nikt jeszcze nie wyznaczył tego portfela na strażnika. Właściciel ustawia go w swoim sejfie.",
  heir: "Nikt jeszcze nie wpisał tego portfela do testamentu. Właściciel robi to w edytorze spadkobierców.",
};

export function App() {
  const wallet = useAnchorWallet();
  const me = wallet?.publicKey;
  const program = useMemo(() => makeProgram(wallet), [wallet]);
  const snapshot = usePoll(() => loadSnapshot(program, me));
  const now = useChainClock(snapshot.data?.now);
  const toast = useToasts();
  const runner = useActionRunner(toast, snapshot.reload, explorerTx);
  const [role, setRole] = useState<Role | undefined>(undefined);
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const mine = (snapshot.data?.wills ?? []).filter((w) => (role ? rolesOf(w, me).includes(role) : false));
  const will = mine.find((w) => w.address.toBase58() === selected);

  const needWallet = () => {
    if (!wallet || !me) throw new Error("Połącz portfel.");
    return { wallet, me };
  };

  const withWill = useCallback(
    (action: (who: NonNullable<typeof me>, w: Will) => Promise<ActionOutcome>) => {
      void runner.run(async () => {
        if (!will) throw new Error("Wybierz sejf.");
        return action(needWallet().me, will);
      });
    },
    [runner, will], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onCreate = (guardian: string) =>
    void runner.run(async () => {
      const created = await createWill(program, needWallet().me, guardian);
      setSelected(created.will.toBase58());
      return created.outcome;
    });

  const pick = (next: Role | undefined) => {
    setRole(next);
    setSelected(undefined);
  };

  return (
    <div className="app">
      <Header owner={me} wallet={snapshot.data?.wallet} runner={runner} onClaim={() => void runner.run(() => claimTokens(needWallet().wallet))} />
      {snapshot.error ? <p className="banner">Nie udało się odczytać łańcucha: {snapshot.error}</p> : null}

      {!role ? (
        <>
          <RolePicker onPick={pick} />
          <HowItWorks />
        </>
      ) : (
        <>
          <RoleBar role={role} onBack={() => pick(undefined)} />
          {!me ? <p className="hint">Połącz portfel (przycisk w prawym górnym rogu), żeby zobaczyć swoje sejfy i wykonywać akcje.</p> : null}
          <div className="layout">
            <div className="stack">
              {role === "owner" ? <CreatePanel owner={me} busy={runner.busy} onCreate={onCreate} /> : null}
              {me ? (
                <WillList title={LIST_TITLES[role]} wills={mine} now={now} me={me} selected={selected} empty={EMPTY_TEXT[role]} onSelect={setSelected} />
              ) : (
                <Card title={LIST_TITLES[role]}>
                  <p className="muted">Po podłączeniu portfela pojawi się tu lista.</p>
                </Card>
              )}
            </div>
            <WillPanel
              will={will}
              now={now}
              me={me}
              role={role}
              runner={runner}
              onCheckIn={() => withWill((who, w) => checkIn(program, who, w))}
              onDeposit={(amount) => withWill((who, w) => deposit(program, who, w, amount))}
              onWithdraw={(amount) => withWill((who, w) => withdraw(program, who, w, amount))}
              onGuardian={(address) => withWill((who, w) => setGuardian(program, who, w, address))}
              onCancel={() =>
                withWill(async (who, w) => {
                  const outcome = await cancelWill(program, who, w);
                  setSelected(undefined);
                  return outcome;
                })
              }
              onSaveHeirs={(drafts: readonly HeirDraft[]) => withWill((who, w) => setHeirs(program, who, w, drafts))}
              onLockHeirs={() => withWill((who, w) => lockHeirs(program, who, w))}
              onVeto={() => withWill((who, w) => veto(program, who, w))}
              onTrigger={() => withWill((who, w) => triggerDistribution(program, who, w))}
              onClaimShare={(index) => withWill((who, w) => claimShare(program, who, w, index))}
            />
          </div>
        </>
      )}
      <TxStatus busy={runner.busy} state={runner.phase} />
      <Toasts toasts={toast.toasts} dismiss={toast.dismiss} />
    </div>
  );
}
