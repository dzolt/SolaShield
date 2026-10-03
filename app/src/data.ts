import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import type * as anchor from "@anchor-lang/core";
import type BN from "bn.js";
import { decodePriceUpdate, pushFeedAddress } from "../../scripts/lib/pyth";
import { reader } from "../../scripts/lib/accounts";
import { MINT, POOL } from "./config";
import { lpAddress } from "./pda";
import { chainNow, connection } from "./program";

export type TriggerKind = "priceBelow" | "priceAbove";
export type PolicyStatus = "active" | "paidOut" | "expired" | "voided";

export interface PoolView {
  readonly admin: string;
  readonly policyCount: number;
  readonly lockupSeconds: number;
  readonly totalAssets: bigint;
  readonly reserved: bigint;
  readonly free: bigint;
  readonly totalShares: bigint;
}

export interface ProductView {
  readonly id: number;
  readonly name: string;
  readonly trigger: TriggerKind;
  readonly feedHex: string;
  readonly premiumBps: number;
  readonly minLeadTime: number;
}

export interface PolicyView {
  readonly id: number;
  readonly address: PublicKey;
  readonly holder: PublicKey;
  readonly productId: number;
  readonly payout: bigint;
  readonly premium: bigint;
  readonly expiry: number;
  /** Pyth price read by the program at purchase, and the trigger level it computed (both in USD). */
  readonly referencePrice: number;
  readonly strike: number;
  readonly thresholdBps: number;
  readonly status: PolicyStatus;
}

export interface PriceView {
  readonly price: number;
  readonly exponent: number;
  readonly publishTime: number;
}

export interface WalletView {
  readonly sol: number;
  readonly tokens: bigint;
  readonly hasTokenAccount: boolean;
  readonly shares: bigint;
  readonly shareValue: bigint;
  /** Unix seconds before which the provider cannot withdraw (0 when there is no position). */
  readonly unlockAt: number;
}

export interface Snapshot {
  readonly now: number;
  readonly pool: PoolView;
  readonly products: readonly ProductView[];
  readonly policies: readonly PolicyView[];
  /** Latest Pyth price per feed id (hex), for price products. */
  readonly prices: Readonly<Record<string, PriceView>>;
  readonly wallet: WalletView | undefined;
}

const big = (value: BN): bigint => BigInt(value.toString());
const variant = (value: object): string => Object.keys(value)[0];
const hex = (bytes: ArrayLike<number>): string => Buffer.from(Array.from(bytes)).toString("hex");
const byId = <T extends { id: number }>(a: T, b: T): number => a.id - b.id;

/** Account filter: the pool is the first field of products and policies (right after the 8-byte discriminator). */
const POOL_FILTER = [{ memcmp: { offset: 8, bytes: POOL.toBase58() } }];

async function loadPool(program: anchor.Program): Promise<PoolView> {
  const pool = (await reader(program, "pool").fetch(POOL)) as Record<string, any>;
  const totalAssets = big(pool.totalAssets);
  const reserved = big(pool.reserved);
  return {
    admin: (pool.admin as PublicKey).toBase58(),
    policyCount: (pool.policyCount as BN).toNumber(),
    lockupSeconds: (pool.lockupSeconds as BN).toNumber(),
    totalAssets,
    reserved,
    free: totalAssets - reserved,
    totalShares: big(pool.totalShares),
  };
}

async function loadProducts(program: anchor.Program): Promise<readonly ProductView[]> {
  const accounts = await reader(program, "product").all(POOL_FILTER);
  return accounts
    .map(({ account }) => {
      const p = account as Record<string, any>;
      return {
        id: p.id as number,
        name: p.name as string,
        trigger: variant(p.trigger) as TriggerKind,
        feedHex: hex(p.feedId),
        premiumBps: p.premiumBps as number,
        minLeadTime: (p.minLeadTime as BN).toNumber(),
      };
    })
    .sort(byId);
}

async function loadPolicies(program: anchor.Program): Promise<readonly PolicyView[]> {
  const accounts = await reader(program, "policy").all(POOL_FILTER);
  return accounts
    .map(({ publicKey, account }) => {
      const p = account as Record<string, any>;
      return {
        id: (p.id as BN).toNumber(),
        address: publicKey,
        holder: p.holder as PublicKey,
        productId: p.productId as number,
        payout: big(p.payout),
        premium: big(p.premium),
        expiry: (p.expiry as BN).toNumber(),
        referencePrice: Number(big(p.referencePrice)) * 10 ** (p.priceExpo as number),
        strike: Number(big(p.strike)) * 10 ** (p.priceExpo as number),
        thresholdBps: p.thresholdBps as number,
        status: variant(p.status) as PolicyStatus,
      };
    })
    .sort(byId);
}

async function loadPrices(products: readonly ProductView[]): Promise<Readonly<Record<string, PriceView>>> {
  const feeds = [...new Set(products.map((p) => p.feedHex))];
  if (feeds.length === 0) return {};
  const infos = await connection.getMultipleAccountsInfo(feeds.map(pushFeedAddress));
  const entries = feeds.flatMap((feed, i) => {
    const info = infos[i];
    if (!info) return [];
    const decoded = decodePriceUpdate(info.data);
    return [[feed, { price: decoded.price, exponent: decoded.exponent, publishTime: decoded.publishTime }] as const];
  });
  return Object.fromEntries(entries);
}

async function loadWallet(program: anchor.Program, owner: PublicKey, pool: PoolView): Promise<WalletView> {
  const ata = getAssociatedTokenAddressSync(MINT, owner);
  const [sol, token, position] = await Promise.all([
    connection.getBalance(owner),
    connection.getTokenAccountBalance(ata).catch(() => undefined),
    reader(program, "lpPosition").fetchNullable(lpAddress(owner)),
  ]);
  const shares = position ? big((position as Record<string, BN>).shares) : 0n;
  const unlockAt = position ? (position as Record<string, BN>).unlockAt.toNumber() : 0;
  return {
    sol: sol / 1e9,
    tokens: token ? BigInt(token.value.amount) : 0n,
    hasTokenAccount: token !== undefined,
    shares,
    shareValue: pool.totalShares === 0n ? 0n : (shares * pool.totalAssets) / pool.totalShares,
    unlockAt,
  };
}

export async function loadSnapshot(program: anchor.Program, owner: PublicKey | undefined): Promise<Snapshot> {
  const pool = await loadPool(program);
  const [products, policies, wallet] = await Promise.all([
    loadProducts(program),
    loadPolicies(program),
    owner ? loadWallet(program, owner, pool) : Promise.resolve(undefined),
  ]);
  const [prices, now] = await Promise.all([loadPrices(products), chainNow()]);
  return { now, pool, products, policies, prices, wallet };
}
