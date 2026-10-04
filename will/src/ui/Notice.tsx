import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

type NoticeTone = "info" | "warn" | "bad" | "ok";

const ICONS: Readonly<Record<NoticeTone, ReactNode>> = {
  info: <Info aria-hidden="true" />,
  warn: <TriangleAlert aria-hidden="true" />,
  bad: <CircleAlert aria-hidden="true" />,
  ok: <CircleCheck aria-hidden="true" />,
};

export function Notice({ tone = "info", action, children }: { readonly tone?: NoticeTone; readonly action?: ReactNode; readonly children: ReactNode }) {
  return (
    <div className={cx("notice", tone !== "info" && `notice-${tone}`)} role={tone === "bad" ? "alert" : undefined}>
      {ICONS[tone]}
      <div className="notice-body">{children}</div>
      {action}
    </div>
  );
}
