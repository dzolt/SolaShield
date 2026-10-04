import type { ReactNode } from "react";
import { cx } from "./cx";

export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly count?: number;
}

interface SegmentedProps<T extends string> {
  readonly value: T;
  readonly options: readonly SegmentOption<T>[];
  readonly onChange: (value: T) => void;
  readonly label: string;
  /** "pill" is the rounded switch; "line" is an underlined tab bar. */
  readonly variant?: "pill" | "line";
}

export function Segmented<T extends string>({ value, options, onChange, label, variant = "pill" }: SegmentedProps<T>) {
  const line = variant === "line";
  return (
    <div role="tablist" aria-label={label} className={line ? "tabs-line" : "segmented"}>
      {options.map((option) => (
        <button key={option.value} role="tab" type="button" aria-selected={option.value === value} className={cx(line ? "tab" : "seg")} onClick={() => onChange(option.value)}>
          {option.icon}
          {option.label}
          {option.count ? <span className="seg-count">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
