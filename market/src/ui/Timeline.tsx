import { Check, Clock, X } from "lucide-react";
import type { ReactNode } from "react";

export type StepState = "done" | "active" | "todo" | "failed";

export interface TimelineStep {
  readonly key: string;
  readonly title: string;
  readonly detail?: ReactNode;
  readonly state: StepState;
}

const ICONS: Readonly<Record<StepState, ReactNode>> = {
  done: <Check aria-hidden="true" />,
  active: <Clock aria-hidden="true" />,
  failed: <X aria-hidden="true" />,
  todo: null,
};

/** The stages of a process, top to bottom: finished ones ticked, the current one highlighted. */
export function Timeline({ steps }: { readonly steps: readonly TimelineStep[] }) {
  return (
    <ol className="timeline">
      {steps.map((step) => (
        <li key={step.key} className="step" data-state={step.state} aria-current={step.state === "active" ? "step" : undefined}>
          <span className="step-icon">{ICONS[step.state]}</span>
          <span className="step-title">{step.title}</span>
          {step.detail ? <span className="step-detail">{step.detail}</span> : null}
        </li>
      ))}
    </ol>
  );
}
