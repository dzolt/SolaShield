import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

interface DrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Accessible name of the dialog. */
  readonly label: string;
  readonly title?: ReactNode;
  readonly children: ReactNode;
}

/** A side panel (a bottom sheet on phones): Escape and a click outside close it, and the page behind does not scroll. */
export function Drawer({ open, onClose, label, title, children }: DrawerProps) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.classList.add("locked");
    panel.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("locked");
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="drawer-root" role="dialog" aria-modal="true" aria-label={label}>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer" tabIndex={-1} ref={panel}>
        <div className="drawer-head">
          <div className="grow">{title}</div>
          <Button variant="ghost" iconOnly aria-label="Zamknij" icon={<X />} onClick={onClose} />
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}
