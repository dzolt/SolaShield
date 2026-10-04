// Where a transaction currently is, so the UI can say "waiting for Phantom" instead of a bare spinner, and so a
// blockhash that expired while the wallet popup was open can be told apart from an RPC hiccup.
export type TxPhase = "signing" | "sending" | "confirming";

export interface PhaseState {
  readonly phase: TxPhase;
  readonly since: number;
}

type Listener = (state: PhaseState | undefined) => void;

const listeners = new Set<Listener>();
let lastSignMs = 0;

export function setTxPhase(phase: TxPhase | undefined): void {
  const state = phase ? { phase, since: Date.now() } : undefined;
  listeners.forEach((listener) => listener(state));
}

export function subscribeTxPhase(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function recordSignDuration(ms: number): void {
  lastSignMs = ms;
}

/** The transaction's blockhash was already gone when it reached the network. */
export class BlockhashExpiredError extends Error {
  readonly signSeconds: number;

  constructor() {
    super("Blockhash expired before the transaction was sent");
    this.signSeconds = Math.round(lastSignMs / 1000);
  }
}
