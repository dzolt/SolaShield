import { useCallback, useEffect, useRef, useState } from "react";
import { POLL_MS } from "./config";
import { explainError } from "./errors";

export interface PollState<T> {
  readonly data: T | undefined;
  readonly error: string | undefined;
  readonly reload: () => Promise<void>;
}

/** Loads data immediately and then every `intervalMs`. `reload` forces a refresh. */
export function usePoll<T>(load: () => Promise<T>, intervalMs = POLL_MS): PollState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(undefined);
    } catch (e: unknown) {
      setError(explainError(e));
    }
  }, []);

  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), intervalMs);
    return () => clearInterval(timer);
  }, [reload, intervalMs]);

  return { data, error, reload };
}

/** Chain time that ticks every second between polls (the offset to the local clock is refreshed by each poll). */
export function useChainClock(chainTime: number | undefined): number {
  const offset = useRef(0);
  const [, tick] = useState(0);
  useEffect(() => {
    if (chainTime !== undefined) offset.current = chainTime - Date.now() / 1000;
  }, [chainTime]);
  useEffect(() => {
    const timer = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return Math.floor(Date.now() / 1000 + offset.current);
}

export interface Toast {
  readonly id: number;
  readonly kind: "success" | "error";
  readonly text: string;
  readonly link?: string;
}

export interface ToastApi {
  readonly toasts: readonly Toast[];
  readonly push: (toast: Omit<Toast, "id">) => void;
  readonly dismiss: (id: number) => void;
}

const MAX_TOASTS = 3;

export function useToasts(): ToastApi {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { ...toast, id }].slice(-MAX_TOASTS));
      setTimeout(() => dismiss(id), toast.kind === "error" ? 9_000 : 7_000);
    },
    [dismiss],
  );
  return { toasts, push, dismiss };
}

export interface ActionOutcome {
  readonly message: string;
  readonly signature?: string;
}

export interface ActionRunner {
  readonly busy: boolean;
  /** Runs an async action, shows a success/error toast (with an explorer link) and never throws. */
  readonly run: (action: () => Promise<ActionOutcome>) => Promise<void>;
}

export function useActionRunner(toast: ToastApi, onDone: () => Promise<void>, explorerLink: (signature: string) => string): ActionRunner {
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (action: () => Promise<ActionOutcome>) => {
      setBusy(true);
      try {
        const outcome = await action();
        toast.push({ kind: "success", text: outcome.message, link: outcome.signature ? explorerLink(outcome.signature) : undefined });
      } catch (e: unknown) {
        toast.push({ kind: "error", text: explainError(e) });
      } finally {
        setBusy(false);
        void onDone();
      }
    },
    [toast, onDone, explorerLink],
  );

  return { busy, run };
}
