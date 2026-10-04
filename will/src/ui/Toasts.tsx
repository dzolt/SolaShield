import { CircleAlert, CircleCheck, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import type { ToastApi } from "../hooks";
import type { PhaseState, TxPhase } from "../txPhase";

export function Toasts({ toasts, dismiss }: Pick<ToastApi, "toasts" | "dismiss">) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`} onClick={() => dismiss(toast.id)}>
          <span className="toast-icon">{toast.kind === "success" ? <CircleCheck aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}</span>
          <div className="toast-text">
            {toast.text}
            {toast.link ? (
              <>
                <br />
                <a href={toast.link} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                  Zobacz w Solana Explorer <ExternalLink size={13} style={{ verticalAlign: "-2px" }} aria-hidden="true" />
                </a>
              </>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

const PHASE_TEXT: Readonly<Record<TxPhase, string>> = {
  signing: "Czekam na podpis w portfelu",
  sending: "Wysyłam transakcję do sieci",
  confirming: "Czekam na potwierdzenie w sieci",
};

/** What the running action is waiting for, with a seconds counter, so a slow wallet popup is not mistaken for a slow app. */
export function TxStatus({ busy, state }: { readonly busy: boolean; readonly state: PhaseState | undefined }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [busy]);
  if (!busy) return null;
  const seconds = state ? Math.max(0, Math.floor((now - state.since) / 1000)) : 0;
  return (
    <div className="txstatus" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {state ? `${PHASE_TEXT[state.phase]}… ${seconds} s` : "Pracuję…"}
    </div>
  );
}
