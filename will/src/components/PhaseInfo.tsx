import { claimOpensAt, phaseOf, procedureStartsAt, type Phase, type Will } from "../data";
import { formatDuration, formatTime } from "../format";
import { Badge, Progress } from "../ui";

const LABELS: Readonly<Record<Phase, { text: string; tone: "ok" | "warn" | "bad" | "info" }>> = {
  active: { text: "Właściciel aktywny", tone: "ok" },
  pending: { text: "Procedura wypłaty trwa", tone: "warn" },
  claimable: { text: "Wypłatę może uruchomić każdy", tone: "bad" },
  distributing: { text: "Wypłata dla spadkobierców", tone: "info" },
};

export function PhaseBadge({ will, now }: { readonly will: Will; readonly now: number }) {
  const label = LABELS[phaseOf(will, now)];
  return <Badge tone={label.tone}>{label.text}</Badge>;
}

/** The timer the owner has to beat, with a bar that fills up as the silence goes on. */
export function PhaseTimer({ will, now }: { readonly will: Will; readonly now: number }) {
  const phase = phaseOf(will, now);
  if (phase === "distributing") {
    return <p className="muted">Wypłatę uruchomiono {formatTime(will.triggeredAt)}. Właściciel nie może już niczego zmienić.</p>;
  }
  if (phase === "active") {
    const left = procedureStartsAt(will) - now;
    return (
      <div className="stack">
        <span className="small">
          Procedura wypłaty ruszy za <b>{formatDuration(left)}</b>, jeśli właściciel się nie odezwie.
        </span>
        <Progress fraction={(now - will.lastAlive) / will.inactivityPeriod} />
      </div>
    );
  }
  if (phase === "pending") {
    const left = claimOpensAt(will) - now;
    return (
      <div className="stack">
        <span className="small">
          Właściciel milczy. Ma jeszcze <b>{formatDuration(left)}</b>, żeby się zameldować, potem wypłatę będzie mógł uruchomić każdy.
        </span>
        <Progress fraction={(now - procedureStartsAt(will)) / will.claimPeriod} tone="warn" />
      </div>
    );
  }
  return (
    <span className="small">
      Procedura minęła {formatTime(claimOpensAt(will))}. Dopóki nikt nie uruchomi wypłaty, właściciel nadal może się zameldować.
    </span>
  );
}
