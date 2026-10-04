import { Check } from "lucide-react";
import { phaseOf, type Will } from "../../data";
import { stageIndex, STAGES } from "../../phases";

/** The four phases of a will in a row: finished ones ticked, the current one highlighted. */
export function PhaseTrack({ will, now }: { readonly will: Will; readonly now: number }) {
  const current = stageIndex(phaseOf(will, now));
  return (
    <ol className="phase-track" aria-label="Fazy sejfu">
      {STAGES.map((stage, index) => {
        const state = index < current ? "done" : index === current ? "current" : "todo";
        return (
          <li key={stage.phase} data-state={state} data-tone={stage.tone} aria-current={state === "current" ? "step" : undefined}>
            <span className="phase-dot">{state === "done" ? <Check aria-hidden="true" /> : index + 1}</span>
            <span className="phase-name">{stage.name}</span>
          </li>
        );
      })}
    </ol>
  );
}
