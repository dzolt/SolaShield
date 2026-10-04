import type { PublicKey } from "@solana/web3.js";
import { Plus, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { phaseOf, type Will } from "../../data";
import type { ActionRunner } from "../../hooks";
import { Button, Card, Empty, Notice, Segmented } from "../../ui";
import type { WillActions } from "../../views";
import { HeirsList } from "../heirs/HeirsList";
import { WillHero } from "../overview/WillHero";
import { WillPicker } from "../overview/WillPicker";
import { CheckInCard } from "./CheckInCard";
import { Checklist, type OwnerTab } from "./Checklist";
import { CreateCard } from "./CreateCard";
import { FundsPanel } from "./FundsPanel";
import { HeirsEditor } from "./HeirsEditor";
import { SettingsPanel } from "./SettingsPanel";

interface OwnerViewProps extends Omit<WillActions, "onVeto" | "onTrigger"> {
  readonly wills: readonly Will[];
  readonly will: Will | undefined;
  readonly onSelect: (address: string) => void;
  readonly now: number;
  readonly me: PublicKey | undefined;
  readonly runner: ActionRunner;
  readonly walletTokens: bigint | undefined;
  readonly onCreate: (guardian: string) => void;
  readonly onConnect: () => void;
}

/** The owner's workspace: create a vault, or manage the selected one in four calm tabs. */
export function OwnerView(props: OwnerViewProps) {
  const { wills, will, me, now, runner, onSelect } = props;
  const [tab, setTab] = useState<OwnerTab>("overview");
  const [creating, setCreating] = useState(false);
  const address = will?.address.toBase58();

  // A freshly created or newly selected vault starts on its overview.
  useEffect(() => {
    setCreating(false);
    setTab("overview");
  }, [address]);

  const head = (
    <div className="page-head">
      <div>
        <h1>Mój sejf</h1>
        <p className="lead">Wpłacaj, wskaż bliskich i melduj się od czasu do czasu. Resztą zajmie się program.</p>
      </div>
      {wills.length > 0 ? (
        <Button variant="soft" icon={<Plus />} onClick={() => setCreating((value) => !value)}>
          {creating ? "Wróć do sejfu" : "Nowy sejf"}
        </Button>
      ) : null}
    </div>
  );

  if (!me) {
    return (
      <main className="page">
        {head}
        <Card>
          <Empty
            icon={<Wallet />}
            title="Połącz portfel"
            action={
              <Button variant="primary" size="lg" icon={<Wallet />} onClick={props.onConnect}>
                Połącz portfel
              </Button>
            }
          >
            Sejf należy do Twojego konta, więc najpierw je połącz. Zaraz potem możesz założyć nowy sejf.
          </Empty>
        </Card>
      </main>
    );
  }

  if (!will || creating) {
    return (
      <main className="page">
        {head}
        <CreateCard connected busy={runner.busy} onCreate={props.onCreate} onConnect={props.onConnect} />
      </main>
    );
  }

  const phase = phaseOf(will, now);
  const frozen = will.distributing;
  const tabs = [
    { value: "overview" as const, label: "Przegląd" },
    { value: "heirs" as const, label: "Spadkobiercy", count: will.heirs.length },
    { value: "funds" as const, label: "Środki" },
    { value: "settings" as const, label: "Ustawienia" },
  ];

  return (
    <main className="page">
      {head}
      <WillPicker wills={wills} selected={address} onSelect={onSelect} />
      <WillHero will={will} now={now} role="owner" />
      {frozen ? (
        <Notice tone="warn">Wypłata ruszyła, więc nie można już niczego zmienić. Każdy spadkobierca odbiera swój udział osobno.</Notice>
      ) : (
        <Segmented variant="line" value={tab} options={tabs} onChange={setTab} label="Sekcje sejfu" />
      )}

      {frozen || tab === "overview" ? (
        <div className="stack loose">
          {frozen ? null : <Checklist will={will} onGo={setTab} />}
          {frozen ? null : <CheckInCard phase={phase} busy={runner.busy} onCheckIn={props.onCheckIn} />}
          <Card title="Spadkobiercy">
            <HeirsList will={will} me={me} canClaim={frozen} busy={runner.busy} onClaim={props.onClaimShare} />
          </Card>
        </div>
      ) : null}
      {!frozen && tab === "heirs" ? <HeirsEditor will={will} busy={runner.busy} onSave={props.onSaveHeirs} onLock={props.onLockHeirs} /> : null}
      {!frozen && tab === "funds" ? <FundsPanel busy={runner.busy} walletTokens={props.walletTokens} vaultBalance={will.balance} onDeposit={props.onDeposit} onWithdraw={props.onWithdraw} /> : null}
      {!frozen && tab === "settings" ? <SettingsPanel will={will} busy={runner.busy} onGuardian={props.onGuardian} onCancel={props.onCancel} /> : null}
    </main>
  );
}
