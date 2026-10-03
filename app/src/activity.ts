const STORAGE_KEY = "fwi-solana-activity";
const MAX_ENTRIES = 30;

export interface ActivityEntry {
  readonly signature: string;
  readonly text: string;
  readonly at: number;
}

export function loadActivity(): readonly ActivityEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ActivityEntry[]) : [];
  } catch {
    return [];
  }
}

/** Returns a new list with the entry first (the log only lives in this browser; the chain is the real record). */
export function withEntry(entries: readonly ActivityEntry[], entry: ActivityEntry): readonly ActivityEntry[] {
  const next = [entry, ...entries].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable (private mode); the log is a convenience only.
  }
  return next;
}
