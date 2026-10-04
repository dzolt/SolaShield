import type * as anchor from "@anchor-lang/core";
import { getAssociatedTokenAddressSync, unpackAccount } from "@solana/spl-token";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { MINT, PROGRAM_ID } from "./config";
import { chainNow, connection } from "./program";

export interface Heir {
  readonly wallet: PublicKey;
  readonly bps: number;
  readonly claimed: boolean;
}

export interface Will {
  readonly address: PublicKey;
  readonly vault: PublicKey;
  readonly owner: PublicKey;
  readonly id: string;
  readonly guardian: PublicKey | null;
  readonly heirs: readonly Heir[];
  readonly heirsLocked: boolean;
  readonly inactivityPeriod: number;
  readonly claimPeriod: number;
  readonly lastAlive: number;
  readonly vetoesUsed: number;
  readonly distributing: boolean;
  readonly distributedTotal: bigint;
  readonly createdAt: number;
  readonly triggeredAt: number;
  /** Current vault balance (0 once every share is paid). */
  readonly balance: bigint;
}

export interface WalletState {
  readonly sol: number;
  readonly tokens: bigint;
}

export interface Snapshot {
  readonly wills: readonly Will[];
  readonly now: number;
  readonly wallet?: WalletState;
}

/**
 * Where a will stands, judged by the chain clock exactly like the program does:
 * active -> (owner silent past the inactivity period) pending -> (claim period over) claimable -> (triggered) distributing.
 */
export type Phase = "active" | "pending" | "claimable" | "distributing";

type Decoded = Record<string, any>;
type AccountClient = { all(): Promise<{ publicKey: PublicKey; account: Decoded }[]> };

const num = (value: { toNumber(): number }): number => value.toNumber();

export function vaultAddress(will: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), will.toBuffer()], PROGRAM_ID)[0];
}

export function willAddress(owner: PublicKey, id: bigint): PublicKey {
  const seed = Buffer.alloc(8);
  seed.writeBigUInt64LE(id);
  return PublicKey.findProgramAddressSync([Buffer.from("will"), owner.toBuffer(), seed], PROGRAM_ID)[0];
}

function toWill(address: PublicKey, raw: Decoded, balance: bigint): Will {
  return {
    address,
    vault: vaultAddress(address),
    owner: raw.owner,
    id: raw.id.toString(),
    guardian: raw.guardian ?? null,
    heirs: (raw.beneficiaries as Decoded[]).map((b) => ({ wallet: b.wallet, bps: b.bps, claimed: b.claimed })),
    heirsLocked: raw.beneficiariesLocked,
    inactivityPeriod: num(raw.inactivityPeriod),
    claimPeriod: num(raw.claimPeriod),
    lastAlive: num(raw.lastAlive),
    vetoesUsed: raw.vetoesUsed,
    distributing: "distributing" in raw.status,
    distributedTotal: BigInt(raw.distributedTotal.toString()),
    createdAt: num(raw.createdAt),
    triggeredAt: num(raw.triggeredAt),
    balance,
  };
}

async function loadBalances(vaults: readonly PublicKey[]): Promise<bigint[]> {
  if (vaults.length === 0) return [];
  const infos = await connection.getMultipleAccountsInfo([...vaults]);
  return infos.map((info, i) => (info ? unpackAccount(vaults[i], info).amount : 0n));
}

async function loadWallet(owner: PublicKey): Promise<WalletState> {
  const [lamports, tokens] = await Promise.all([
    connection.getBalance(owner),
    connection
      .getTokenAccountBalance(getAssociatedTokenAddressSync(MINT, owner))
      .then((r) => BigInt(r.value.amount))
      .catch(() => 0n),
  ]);
  return { sol: lamports / LAMPORTS_PER_SOL, tokens };
}

export async function loadSnapshot(program: anchor.Program, owner: PublicKey | undefined): Promise<Snapshot> {
  const accounts = program.account as unknown as Record<string, AccountClient>;
  const [rows, now, wallet] = await Promise.all([accounts.will.all(), chainNow(), owner ? loadWallet(owner) : Promise.resolve(undefined)]);
  const balances = await loadBalances(rows.map((r) => vaultAddress(r.publicKey)));
  const wills = rows.map((r, i) => toWill(r.publicKey, r.account, balances[i])).sort((a, b) => b.createdAt - a.createdAt);
  return { wills, now, wallet };
}

export function procedureStartsAt(will: Will): number {
  return will.lastAlive + will.inactivityPeriod;
}

export function claimOpensAt(will: Will): number {
  return procedureStartsAt(will) + will.claimPeriod;
}

export function phaseOf(will: Will, now: number): Phase {
  if (will.distributing) return "distributing";
  if (now > claimOpensAt(will)) return "claimable";
  if (now > procedureStartsAt(will)) return "pending";
  return "active";
}

/** Heir `index`'s part of the frozen balance, with rounding dust going to the last heir (same rule as the program). */
export function shareOf(will: Will, index: number, total: bigint): bigint {
  const floor = (h: Heir): bigint => (total * BigInt(h.bps)) / 10_000n;
  const last = will.heirs.length - 1;
  if (index !== last) return floor(will.heirs[index]);
  return total - will.heirs.slice(0, last).reduce((sum, h) => sum + floor(h), 0n);
}

export type Role = "owner" | "guardian" | "heir";

export function rolesOf(will: Will, me: PublicKey | undefined): readonly Role[] {
  if (!me) return [];
  return [
    ...(will.owner.equals(me) ? (["owner"] as const) : []),
    ...(will.guardian?.equals(me) ? (["guardian"] as const) : []),
    ...(will.heirs.some((h) => h.wallet.equals(me)) ? (["heir"] as const) : []),
  ];
}
