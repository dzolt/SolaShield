import type { ReactNode } from "react";

interface EmptyProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly action?: ReactNode;
  readonly children?: ReactNode;
}

export function Empty({ icon, title, action, children }: EmptyProps) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}
