import type { InputHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "prefix"> {
  readonly label?: string;
  readonly hint?: ReactNode;
  readonly error?: string;
  readonly icon?: ReactNode;
  readonly suffix?: ReactNode;
  readonly mono?: boolean;
  readonly large?: boolean;
}

/** A labelled text input; the label wraps the input, so clicking it focuses the field. */
export function Field({ label, hint, error, icon, suffix, mono, large, ...input }: FieldProps) {
  return (
    <label className="field">
      {label ? <span className="field-label">{label}</span> : null}
      <span className={cx("input-wrap", mono && "is-mono", large && "input-lg", error && "is-invalid")}>
        {icon}
        <input {...input} aria-invalid={error ? true : undefined} />
        {suffix ? <span className="input-affix">{suffix}</span> : null}
      </span>
      {error ? <span className="field-hint is-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
