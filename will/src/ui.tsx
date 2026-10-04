import type { ReactNode } from "react";
import type { ToastApi } from "./hooks";

export function Card({ title, aside, children }: { readonly title?: string; readonly aside?: ReactNode; readonly children: ReactNode }) {
  return (
    <section className="card">
      {title ? (
        <div className="row between card-head">
          <h2>{title}</h2>
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value }: { readonly label: string; readonly value: ReactNode }) {
  return (
    <div className="stat">
      <span className="muted">{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function Badge({ tone = "info", children }: { readonly tone?: "ok" | "warn" | "bad" | "info"; readonly children: ReactNode }) {
  return <span className={`badge ${tone === "info" ? "" : tone}`}>{children}</span>;
}

export function Progress({ fraction, tone }: { readonly fraction: number; readonly tone?: "warn" | "bad" }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div className={`progress ${tone ?? ""}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Toasts({ toasts, dismiss }: Pick<ToastApi, "toasts" | "dismiss">) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)}>
          {t.text}{" "}
          {t.link ? (
            <a href={t.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              Zobacz w Solana Explorer
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}
