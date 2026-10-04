import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type Variant = "primary" | "soft" | "outline" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  readonly variant?: Variant;
  readonly size?: Size;
  readonly block?: boolean;
  readonly loading?: boolean;
  readonly icon?: ReactNode;
  readonly iconRight?: ReactNode;
  readonly iconOnly?: boolean;
}

export function Button({ variant = "outline", size = "md", block, loading, icon, iconRight, iconOnly, children, disabled, type = "button", ...rest }: ButtonProps) {
  const classes = cx("btn", `btn-${variant}`, size !== "md" && `btn-${size}`, block && "btn-block", iconOnly && "btn-icon", loading && "is-loading");
  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
}
