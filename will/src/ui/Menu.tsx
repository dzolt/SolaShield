import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/** Calls `onDismiss` on Escape or on a pointer press outside the returned element. */
export function useDismiss<T extends HTMLElement>(open: boolean, onDismiss: () => void) {
  const ref = useRef<T>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) dismiss.current();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") dismiss.current();
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return ref;
}

interface MenuItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  readonly icon?: ReactNode;
}

export function MenuItem({ icon, children, type = "button", ...rest }: MenuItemProps) {
  return (
    <button type={type} role="menuitem" className="menu-item" {...rest}>
      {icon}
      {children}
    </button>
  );
}
