import type { PublicKey } from "@solana/web3.js";
import type { HeirDraft } from "../actions";
import { explorerAddress, MAX_VETOES } from "../config";
import { phaseOf, rolesOf, type Role, type Will } from "../data";
import { formatUsdc, shortAddress } from "../format";
import type { ActionRunner } from "../hooks";
import { Card, Party, Section, Stat } from "../ui";
import { HeirsEditor } from "./HeirsEditor";
import { HeirsTable } from "./HeirsTable";
import { CheckInSection, DangerSection, FundsSection, GuardianSection } from "./OwnerControls";
import { PhaseBadge, PhaseTimer, PhaseTracker } from "./PhaseInfo";

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
  /** Role picked on the first screen; only its actions are shown. */
  readonly role: Role;
}

export function WillPanel({ will, now, me, runner, role, ...handlers }: WillPanelProps) {
  if (!will) {
    return (
      <Card title="Szczegóły sejfu">
        <p className="muted">Wybierz sejf z listy albo załóż własny.</p>
      </Card>
    );
  }
  const roles = rolesOf(will, me);
  const isOwner = role === "owner" && roles.includes("owner");
  const isGuardian = role === "guardian" && roles.includes("guardian");
  const isHeir = role === "heir" && roles.includes("heir");
  const phase = phaseOf(will, now);
  const frozen = will.distributing;
  const owner = will.owner.toBase58();

  return (
    <Card title="Szczegóły sejfu" aside={<PhaseBadge will={will} now={now} />}>
      <Section>
        <div className="stats">
          <Stat label={frozen ? "Do podziału" : "W sejfie"} value={formatUsdc(frozen ? will.distributedTotal : will.balance)} />
          <Stat label="Właściciel" value={<Party address={owner} short={shortAddress(will.owner)} href={explorerAddress(owner)} />} />
          <Stat
            label="Strażnik"
            value={
              will.guardian ? (
                <Party address={will.guardian.toBase58()} short={shortAddress(will.guardian)} href={explorerAddress(will.guardian.toBase58())} />
              ) : (
                "brak"
              )
            }
          />
        </div>
        <PhaseTracker will={will} now={now} />
        <PhaseTimer will={will} now={now} />
        {will.guardian ? (
          <span className="muted">
            Weta strażnika w tym cyklu: {will.vetoesUsed} z {MAX_VETOES}.
          </span>
        ) : null}
      </Section>

      <Section title="Spadkobiercy">
        <HeirsTable will={will} me={me} canClaim={frozen && isHeir} busy={runner.busy} onClaim={handlers.onClaimShare} />
        <p className="muted">
          {will.heirsLocked ? "Lista spadkobierców jest ostateczna. " : ""}Udziały liczone są od salda w chwili wypłaty, więc kolejne wpłaty zwiększają każdy z nich
          proporcjonalnie.
        </p>
      </Section>

      {isOwner && !frozen ? (
        <>
          <CheckInSection busy={runner.busy} onCheckIn={handlers.onCheckIn} />
          <FundsSection busy={runner.busy} onDeposit={handlers.onDeposit} onWithdraw={handlers.onWithdraw} />
          {!will.heirsLocked ? <HeirsEditor will={will} busy={runner.busy} onSave={handlers.onSaveHeirs} onLock={handlers.onLockHeirs} /> : null}
          <GuardianSection will={will} busy={runner.busy} onGuardian={handlers.onGuardian} />
          <DangerSection busy={runner.busy} onCancel={handlers.onCancel} />
        </>
      ) : null}

      {isGuardian && !frozen ? (
        <Section title="Weto strażnika">
          <p className="muted">
            {phase === "active"
              ? "Weto jest możliwe dopiero, gdy właściciel zamilknie na cały okres ciszy."
              : will.vetoesUsed >= MAX_VETOES
                ? "Wykorzystałeś oba weta. Licznik może zresetować już tylko właściciel."
                : "Jeśli wiesz, że właściciel żyje, użyj weta: odliczanie zacznie się od nowa."}
          </p>
          <button className="primary" disabled={runner.busy || phase === "active" || will.vetoesUsed >= MAX_VETOES} onClick={handlers.onVeto}>
            Weto: właściciel żyje, zacznij odliczanie od nowa
          </button>
        </Section>
      ) : null}

      {isHeir && !frozen ? (
        <Section title="Wypłata">
          {phase === "claimable" ? (
            <>
              <p className="muted">Okres ciszy i procedury minął. Wypłatę może uruchomić każdy, a potem każdy spadkobierca odbiera swój udział.</p>
              <button className="primary big-button" disabled={runner.busy || !me} onClick={handlers.onTrigger}>
                Uruchom wypłatę
              </button>
            </>
          ) : (
            <p className="muted">Wypłatę będzie można uruchomić po upływie okresu ciszy i procedury. Do tego czasu właściciel może się jeszcze zameldować.</p>
          )}
        </Section>
      ) : null}
    </Card>
  );
}
