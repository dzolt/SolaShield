import type { ReactNode } from "react";
import { cx } from "./cx";

export type Tone = "neutral" | "accent" | "ok" | "warn" | "bad";

export function Badge({ tone = "neutral", dot, children }: { readonly tone?: Tone; readonly dot?: boolean; readonly children: ReactNode }) {
  return (
    <span className={cx("badge", tone !== "neutral" && `badge-${tone}`)}>
      {dot ? <i className="dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** A small fact chip such as "float 0.132". */
export function Pill({ label, children }: { readonly label?: string; readonly children: ReactNode }) {
  return (
    <span className="pill">
      {label ? <span>{label}</span> : null}
      <b>{children}</b>
    </span>
  );
}
