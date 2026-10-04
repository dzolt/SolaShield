import { PublicKey } from "@solana/web3.js";
import { TOKEN_DECIMALS, TOTAL_BPS } from "./config";

const amountFormat = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" });

/** Token amount in base units -> "1 006,00 tUSDC". */
export function formatUsdc(amount: bigint): string {
  const whole = Number(amount / 10n ** BigInt(TOKEN_DECIMALS));
  const fraction = Number(amount % 10n ** BigInt(TOKEN_DECIMALS)) / 10 ** TOKEN_DECIMALS;
  return `${amountFormat.format(whole + fraction)} tUSDC`;
}

export function parseUsdc(input: string): bigint {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) throw new Error("Podaj poprawną kwotę, np. 100 lub 12,50");
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 10n ** BigInt(TOKEN_DECIMALS) + BigInt(fraction.padEnd(TOKEN_DECIMALS, "0"));
}

/** "33,5" -> 3350 basis points; at most two decimals. */
export function parsePercent(input: string): number {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error(`Niepoprawny procent: „${input}”`);
  return Math.round(Number(normalized) * 100);
}

export function formatPercent(bps: number): string {
  return `${(bps / (TOTAL_BPS / 100)).toLocaleString("pl-PL", { maximumFractionDigits: 2 })}%`;
}

export function shortAddress(address: PublicKey | string): string {
  const text = typeof address === "string" ? address : address.toBase58();
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

export function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** 125 -> "2 min 5 s", 7300 -> "2 godz. 1 min", 700000 -> "8 dni 2 godz.". */
export function formatDuration(seconds: number): string {
  const abs = Math.max(0, Math.round(seconds));
  const d = Math.floor(abs / 86400);
  const h = Math.floor((abs % 86400) / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (d > 0) return `${d} dni ${h} godz.`;
  if (h > 0) return `${h} godz. ${m} min`;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
}

export function parseAddress(input: string, what: string): PublicKey {
  try {
    return new PublicKey(input.trim());
  } catch {
    throw new Error(`${what}: to nie jest poprawny adres Solany.`);
  }
}
