import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cancelWill, checkIn, claimShare, claimTokens, createWill, deposit, lockHeirs, setGuardian, setHeirs, triggerDistribution, veto, withdraw, type HeirDraft } from "./actions";
import { GuardianView } from "./components/guardian/GuardianView";
import { HeirView } from "./components/heir/HeirView";
import { Footer } from "./components/layout/Footer";
import { Landing } from "./components/layout/Landing";
import { TopBar } from "./components/layout/TopBar";
import { OwnerView } from "./components/owner/OwnerView";
import { explorerTx } from "./config";
import { loadSnapshot, rolesOf, type Role, type Will } from "./data";
import { useActionRunner, useChainClock, usePoll, useToasts, type ActionOutcome } from "./hooks";
import { makeProgram } from "./program";
import { roleFromUrl, willFromUrl, writeRoleToUrl, writeWillToUrl } from "./roles";
import { Toasts, TxStatus } from "./ui";

const ROLES: readonly Role[] = ["owner", "guardian", "heir"];

export function App() {
  const wallet = useAnchorWallet();
  const { setVisible } = useWalletModal();
  const me = wallet?.publicKey;
  const program = useMemo(() => makeProgram(wallet), [wallet]);
  const snapshot = usePoll(() => loadSnapshot(program, me));
  const now = useChainClock(snapshot.data?.now);
  const toast = useToasts();
  const runner = useActionRunner(toast, snapshot.reload, explorerTx);
  const [role, setRole] = useState<Role | undefined>(roleFromUrl);
  const [selected, setSelected] = useState<string | undefined>(willFromUrl);

  const wills = snapshot.data?.wills ?? [];
  const counts = useMemo(
    () => Object.fromEntries(ROLES.map((r) => [r, wills.filter((w) => rolesOf(w, me).includes(r)).length])) as Record<Role, number>,
    [wills, me],
  );
  const mine = wills.filter((w) => (role ? rolesOf(w, me).includes(role) : false));
  // The chosen will, or the newest one in this role: nobody has to click a list to see their vault.
  const will = mine.find((w) => w.address.toBase58() === selected) ?? mine[0];
  const willAddress = will?.address.toBase58();

  useEffect(() => writeWillToUrl(willAddress), [willAddress]);

  // Show the account's balances and wills right after connecting, not at the next poll.
  const reloadSnapshot = snapshot.reload;
  useEffect(() => {
    void reloadSnapshot();
  }, [me, reloadSnapshot]);

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
    writeRoleToUrl(next);
    setRole(next);
    setSelected(undefined);
  };

  const shared = {
    wills: mine,
    will,
    onSelect: setSelected,
    now,
    me,
    runner,
    onConnect: () => setVisible(true),
  };

  return (
    <>
      <TopBar
        role={role}
        onRole={pick}
        onHome={() => pick(undefined)}
        owner={me}
        wallet={snapshot.data?.wallet}
        busy={runner.busy}
        onClaim={() => void runner.run(() => claimTokens(needWallet().wallet))}
        counts={counts}
      />

      {!role ? (
        <Landing onPick={pick} />
      ) : (
        <>
          {role === "owner" ? (
            <OwnerView
              {...shared}
              walletTokens={snapshot.data?.wallet?.tokens}
              onCreate={onCreate}
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
              onClaimShare={(index) => withWill((who, w) => claimShare(program, who, w, index))}
            />
          ) : null}
          {role === "guardian" ? <GuardianView {...shared} onVeto={() => withWill((who, w) => veto(program, who, w))} /> : null}
          {role === "heir" ? (
            <HeirView
              {...shared}
              onTrigger={() => withWill((who, w) => triggerDistribution(program, who, w))}
              onClaimShare={(index) => withWill((who, w) => claimShare(program, who, w, index))}
            />
          ) : null}
          <div className="page page-footer">
            <Footer />
          </div>
        </>
      )}

      <TxStatus busy={runner.busy} state={runner.phase} />
      <Toasts toasts={toast.toasts} dismiss={toast.dismiss} />
    </>
  );
}
