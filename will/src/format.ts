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

const priceFormat = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: "always" });
const priceFormatCents = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" });

/** Token amount without the unit and without needless ",00": 500000000 -> "500", 12500000 -> "12,50". */
export function formatPrice(amount: bigint): string {
  const whole = Number(amount / 10n ** BigInt(TOKEN_DECIMALS));
  const fraction = Number(amount % 10n ** BigInt(TOKEN_DECIMALS)) / 10 ** TOKEN_DECIMALS;
  const value = whole + fraction;
  return Number.isInteger(value) ? priceFormat.format(value) : priceFormatCents.format(value);
}

/** 85 -> "1:25", 3725 -> "1:02:05": a countdown in the form people read on a clock. */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number): string => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** Time left in the largest sensible unit: "89 dni", "5 godz.", or a clock for the last hour. */
export function timeLeft(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total >= 86_400) return `${Math.floor(total / 86_400)} dni`;
  if (total >= 7_200) return `${Math.floor(total / 3_600)} godz.`;
  return clock(total);
}

/** A base-unit amount as the text a person would type into an amount field: 12500000 -> "12.5". */
export function toInputAmount(amount: bigint): string {
  const whole = amount / 10n ** BigInt(TOKEN_DECIMALS);
  const fraction = (amount % 10n ** BigInt(TOKEN_DECIMALS)).toString().padStart(TOKEN_DECIMALS, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
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
  if (d > 0) return h > 0 ? `${d} dni ${h} godz.` : `${d} dni`;
  if (h > 0) return m > 0 ? `${h} godz. ${m} min` : `${h} godz.`;
  if (m > 0) return s > 0 ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}

export function parseAddress(input: string, what: string): PublicKey {
  try {
    return new PublicKey(input.trim());
  } catch {
    throw new Error(`${what}: to nie jest poprawny adres Solany.`);
  }
}
