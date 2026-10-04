import { BlockhashExpiredError } from "./txPhase";

/** Turns a wallet / Anchor / RPC error into one short message for the UI. */
export function explainError(error: unknown): string {
  if (error instanceof BlockhashExpiredError) {
    return `Transakcja wygasła, zanim trafiła do sieci: podpis w portfelu trwał ${error.signSeconds} s, a transakcja jest ważna tylko około pół minuty. Spróbuj jeszcze raz i zatwierdź w Phantomie od razu.`;
  }
  const anchorMessage = (error as { error?: { errorMessage?: string } } | undefined)?.error?.errorMessage;
  if (anchorMessage) return anchorMessage;
  const text = error instanceof Error ? error.message : String(error);
  if (/user rejected|rejected the request|declined/i.test(text)) return "Odrzucono w portfelu.";
  if (/insufficient lamports|insufficient funds|0x1\b/i.test(text)) return "Za mało SOL albo tUSDC. Odbierz testowe tUSDC lub doładuj SOL z faucetu devnetu.";
  if (/AccountNotInitialized|could not find account|account does not exist/i.test(text)) return "Brakuje konta tUSDC. Kliknij najpierw „Odbierz testowe tUSDC”.";
  if (/429|Too Many Requests/i.test(text)) return "RPC ogranicza zapytania. Spróbuj za chwilę.";
  if (/simulation failed|custom program error|Instruction \d+/i.test(text)) {
    const reason = text.match(/Error Message: ([^."\\]+)/)?.[1];
    return reason ? `Program odrzucił transakcję: ${reason.trim()}.` : "Program odrzucił tę transakcję. Odśwież stronę i spróbuj jeszcze raz.";
  }
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}
