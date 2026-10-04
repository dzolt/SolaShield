import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

interface DisclosureProps {
  readonly title: ReactNode;
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
}

/** Content the reader can open when they want the detail; closed by default to keep screens calm. */
export function Disclosure({ title, defaultOpen, children }: DisclosureProps) {
  return (
    <details className="disclosure" open={defaultOpen}>
      <summary>
        <span className="row nowrap">{title}</span>
        <ChevronDown className="chev" aria-hidden="true" />
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}
