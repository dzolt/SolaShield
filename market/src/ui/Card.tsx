import type { ReactNode } from "react";
import { cx } from "./cx";

interface CardProps {
  readonly title?: string;
  readonly aside?: ReactNode;
  readonly soft?: boolean;
  readonly flush?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Card({ title, aside, soft, flush, className, children }: CardProps) {
  return (
    <section className={cx("card", !flush && "card-pad", soft && "card-soft", className)}>
      {title ? (
        <div className="card-head">
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
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
