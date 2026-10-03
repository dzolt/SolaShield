/** Turns a wallet / Anchor / RPC error into one short message for the UI. */
export function explainError(error: unknown): string {
  const anchorMessage = (error as { error?: { errorMessage?: string } } | undefined)?.error?.errorMessage;
  if (anchorMessage) return anchorMessage;
  const text = error instanceof Error ? error.message : String(error);
  if (/user rejected|rejected the request|declined/i.test(text)) return "Odrzucono w portfelu.";
  if (/insufficient lamports|insufficient funds|0x1\b/i.test(text)) return "Za mało SOL na opłaty lub konta. Doładuj SOL z faucetu devnetu.";
  if (/429|Too Many Requests/i.test(text)) return "Publiczny RPC devnetu ogranicza zapytania. Spróbuj za chwilę (albo ustaw własny VITE_RPC_URL).";
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}
