import type { PublicKey } from "@solana/web3.js";
import type { HeirDraft } from "../actions";
import { explorerAddress, MAX_VETOES } from "../config";
import { phaseOf, rolesOf, type Will } from "../data";
import { formatUsdc, shortAddress } from "../format";
import type { ActionRunner } from "../hooks";
import { Card, Stat } from "../ui";
import { HeirsEditor } from "./HeirsEditor";
import { HeirsTable } from "./HeirsTable";
import { OwnerControls } from "./OwnerControls";
import { PhaseBadge, PhaseTimer } from "./PhaseInfo";

export interface WillHandlers {
  readonly onCheckIn: () => void;
  readonly onDeposit: (amount: string) => void;
  readonly onWithdraw: (amount: string) => void;
  readonly onGuardian: (address: string) => void;
  readonly onCancel: () => void;
  readonly onSaveHeirs: (drafts: readonly HeirDraft[]) => void;
  readonly onLockHeirs: () => void;
  readonly onVeto: () => void;
  readonly onTrigger: () => void;
  readonly onClaimShare: (index: number) => void;
}

interface WillPanelProps extends WillHandlers {
  readonly will: Will | undefined;
  readonly now: number;
  readonly me: PublicKey | undefined;
  readonly runner: ActionRunner;
}

export function WillPanel({ will, now, me, runner, ...handlers }: WillPanelProps) {
  if (!will) {
    return (
      <Card title="Szczegóły sejfu">
        <p className="muted">Wybierz sejf z listy albo załóż własny.</p>
      </Card>
    );
  }
  const roles = rolesOf(will, me);
  const isOwner = roles.includes("owner");
  const isGuardian = roles.includes("guardian");
  const phase = phaseOf(will, now);
  const frozen = will.distributing;

  return (
    <Card title="Szczegóły sejfu" aside={<PhaseBadge will={will} now={now} />}>
      <div className="stack">
        <div className="row">
          <Stat label={frozen ? "Do podziału" : "W sejfie"} value={formatUsdc(frozen ? will.distributedTotal : will.balance)} />
          <Stat label="Właściciel" value={<a href={explorerAddress(will.owner.toBase58())} target="_blank" rel="noreferrer">{shortAddress(will.owner)}</a>} />
          <Stat label="Strażnik" value={will.guardian ? shortAddress(will.guardian) : "brak"} />
        </div>
        <PhaseTimer will={will} now={now} />
        {will.guardian ? (
          <span className="muted">
            Weta strażnika w tym cyklu: {will.vetoesUsed} z {MAX_VETOES}.
          </span>
        ) : null}

        <HeirsTable
          will={will}
          me={me}
          canClaim={frozen && Boolean(me)}
          busy={runner.busy}
          onClaim={handlers.onClaimShare}
        />
        <p className="muted">
          {will.heirsLocked ? "Lista spadkobierców jest ostateczna. " : ""}Udziały liczone są od salda w chwili wypłaty, więc kolejne wpłaty zwiększają każdy z nich proporcjonalnie.
        </p>

        {isOwner && !frozen ? (
          <>
            <OwnerControls
              will={will}
              busy={runner.busy}
              onCheckIn={handlers.onCheckIn}
              onDeposit={handlers.onDeposit}
              onWithdraw={handlers.onWithdraw}
              onGuardian={handlers.onGuardian}
              onCancel={handlers.onCancel}
            />
            {!will.heirsLocked ? <HeirsEditor will={will} busy={runner.busy} onSave={handlers.onSaveHeirs} onLock={handlers.onLockHeirs} /> : null}
          </>
        ) : null}

        {isGuardian && !frozen ? (
          <button disabled={runner.busy || phase === "active"} onClick={handlers.onVeto}>
            Weto: właściciel żyje, zacznij odliczanie od nowa
          </button>
        ) : null}

        {phase === "claimable" ? (
          <button className="primary" disabled={runner.busy || !me} onClick={handlers.onTrigger}>
            Uruchom wypłatę (może każdy)
          </button>
        ) : null}
      </div>
    </Card>
  );
}
