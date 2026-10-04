import { claimOpensAt, phaseOf, procedureStartsAt, type Phase, type Will } from "../data";
import { formatDuration, formatTime } from "../format";
import { Badge, Progress } from "../ui";

type Tone = "ok" | "warn" | "bad" | "info";

interface Stage {
  readonly phase: Phase;
  readonly title: string;
  readonly caption: string;
  readonly tone: Tone;
  readonly badge: string;
}

const STAGES: readonly Stage[] = [
  { phase: "active", title: "Właściciel aktywny", caption: "każde zameldowanie zeruje licznik", tone: "ok", badge: "Właściciel aktywny" },
  { phase: "pending", title: "Procedura wypłaty", caption: "ostatni czas na zameldowanie", tone: "warn", badge: "Procedura wypłaty trwa" },
  { phase: "claimable", title: "Wypłata możliwa", caption: "uruchamia ją każdy", tone: "bad", badge: "Wypłatę może uruchomić każdy" },
  { phase: "distributing", title: "Wypłata trwa", caption: "każdy odbiera swój udział", tone: "info", badge: "Wypłata dla spadkobierców" },
];

const stageOf = (phase: Phase): Stage => STAGES.find((s) => s.phase === phase) ?? STAGES[0];

export function PhaseBadge({ will, now }: { readonly will: Will; readonly now: number }) {
  const stage = stageOf(phaseOf(will, now));
  return <Badge tone={stage.tone}>{stage.badge}</Badge>;
}

/** The four phases of a will, with the current one highlighted and the finished ones ticked. */
export function PhaseTracker({ will, now }: { readonly will: Will; readonly now: number }) {
  const current = STAGES.findIndex((s) => s.phase === phaseOf(will, now));
  return (
    <div className="phases">
      {STAGES.map((stage, index) => (
        <div key={stage.phase} className={`phase ${index < current ? "past" : index === current ? `current ${stage.tone}` : ""}`}>
          <b>{stage.title}</b>
          <span>{stage.caption}</span>
        </div>
      ))}
    </div>
  );
}

/** The timer the owner has to beat, with a bar that fills up as the silence goes on. */
export function PhaseTimer({ will, now }: { readonly will: Will; readonly now: number }) {
  const phase = phaseOf(will, now);
  if (phase === "distributing") {
    return (
      <div className="countdown">
        <span className="muted small">Wypłatę uruchomiono {formatTime(will.triggeredAt)}</span>
        <span>Właściciel nie może już niczego zmienić. Każdy spadkobierca odbiera swój udział osobno.</span>
      </div>
    );
  }
  if (phase === "active") {
    return (
      <div className="countdown">
        <span className="muted small">Procedura wypłaty ruszy za</span>
        <span className="countdown-value">{formatDuration(procedureStartsAt(will) - now)}</span>
        <Progress fraction={(now - will.lastAlive) / will.inactivityPeriod} />
        <span className="muted small">jeśli właściciel się nie odezwie</span>
      </div>
    );
  }
  if (phase === "pending") {
    return (
      <div className="countdown warn">
        <span className="small">Właściciel milczy. Czas na zameldowanie:</span>
        <span className="countdown-value">{formatDuration(claimOpensAt(will) - now)}</span>
        <Progress fraction={(now - procedureStartsAt(will)) / will.claimPeriod} tone="warn" />
        <span className="muted small">Potem wypłatę będzie mógł uruchomić każdy.</span>
      </div>
    );
  }
  return (
    <div className="countdown bad">
      <span className="small">Procedura minęła {formatTime(claimOpensAt(will))}</span>
      <span className="countdown-value">Wypłata gotowa</span>
      <span className="muted small">Uruchomić ją może każdy. Dopóki nikt tego nie zrobi, właściciel nadal może się zameldować.</span>
    </div>
  );
}
