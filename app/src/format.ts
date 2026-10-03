import { PublicKey } from "@solana/web3.js";
import { TOKEN_DECIMALS } from "./config";

const plnFormat = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" });

/** Token amount in base units -> "1 006,00 tUSDC". */
export function formatUsdc(amount: bigint): string {
  const whole = Number(amount / 10n ** BigInt(TOKEN_DECIMALS));
  const fraction = Number(amount % 10n ** BigInt(TOKEN_DECIMALS)) / 10 ** TOKEN_DECIMALS;
  return `${plnFormat.format(whole + fraction)} tUSDC`;
}

export function parseUsdc(input: string): bigint {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) throw new Error("Podaj poprawną kwotę, np. 100 lub 12,50");
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 10n ** BigInt(TOKEN_DECIMALS) + BigInt(fraction.padEnd(TOKEN_DECIMALS, "0"));
}

export function shortAddress(address: PublicKey | string): string {
  const text = typeof address === "string" ? address : address.toBase58();
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

export function formatDateTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** 125 -> "2 min 5 s", 7300 -> "2 godz. 1 min". */
export function formatDuration(seconds: number): string {
  const abs = Math.abs(Math.round(seconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) return `${h} godz. ${m} min`;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
}

export function formatUsd(value: number): string {
  return `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: value < 10 ? 4 : 2 }).format(value)} USD`;
}
