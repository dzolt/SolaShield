import { claimOpensAt, phaseOf, procedureStartsAt, type Phase, type Will } from "./data";
import type { Tone } from "./ui";

export interface Stage {
  readonly phase: Phase;
  /** Short name on the tracker. */
  readonly name: string;
  /** What the phase means, as a headline. */
  readonly headline: string;
  readonly tone: Tone;
}

export const STAGES: readonly Stage[] = [
  { phase: "active", name: "Aktywny", headline: "Właściciel jest aktywny", tone: "ok" },
  { phase: "pending", name: "Procedura", headline: "Cisza: trwa procedura wypłaty", tone: "warn" },
  { phase: "claimable", name: "Wypłata", headline: "Wypłatę może uruchomić każdy", tone: "bad" },
  { phase: "distributing", name: "Podział", headline: "Środki trafiają do spadkobierców", tone: "accent" },
];

export const stageOf = (phase: Phase): Stage => STAGES.find((stage) => stage.phase === phase) ?? STAGES[0];

export const stageIndex = (phase: Phase): number => STAGES.findIndex((stage) => stage.phase === phase);

export interface Countdown {
  /** Seconds left until the next phase (0 when there is no next phase). */
  readonly remaining: number;
  /** 0..1 progress through the current phase. */
  readonly fraction: number;
  readonly caption: string;
}

/** The timer that matters in each phase: time to the procedure, time to react, or nothing left to wait for. */
export function countdownOf(will: Will, now: number): Countdown {
  switch (phaseOf(will, now)) {
    case "active":
      return { remaining: procedureStartsAt(will) - now, fraction: (now - will.lastAlive) / will.inactivityPeriod, caption: "do początku procedury" };
    case "pending":
      return { remaining: claimOpensAt(will) - now, fraction: (now - procedureStartsAt(will)) / will.claimPeriod, caption: "na zameldowanie" };
    case "claimable":
      return { remaining: 0, fraction: 1, caption: "wypłata gotowa" };
    case "distributing":
      return { remaining: 0, fraction: 1, caption: "wypłata w toku" };
  }
}
