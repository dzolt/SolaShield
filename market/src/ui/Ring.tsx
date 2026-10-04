import type { CSSProperties, ReactNode } from "react";

interface RingProps {
  /** 0..1 */
  readonly fraction: number;
  readonly size?: number;
  readonly stroke?: number;
  readonly tone?: "ok" | "warn" | "bad" | "accent";
  readonly children?: ReactNode;
}

/** A circular progress with room for a value in the middle (used for countdowns). */
export function Ring({ fraction, size = 160, stroke = 10, tone = "ok", children }: RingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, fraction)));
  return (
    <div className="ring" style={{ "--ring-size": `${size}px` } as CSSProperties}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
        <circle className={`ring-bar ${tone === "ok" ? "" : tone}`} cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Progress({ fraction, tone }: { readonly fraction: number; readonly tone?: "warn" | "bad" }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div className={`progress ${tone ?? ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
