import type * as anchor from "@anchor-lang/core";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { MARKET_SINCE, MINT } from "./config";
import { chainNow, connection } from "./program";

export type DealStatus = "listed" | "funded" | "delivered" | "completed" | "refunded";

export interface Deal {
  readonly address: PublicKey;
  readonly id: number;
  readonly seller: PublicKey;
  readonly buyer: PublicKey | null;
  readonly price: bigint;
  readonly sellerSteamId: string;
  readonly buyerSteamId: string;
  readonly itemName: string;
  readonly wear: string;
  readonly pattern: number;
  readonly listedAssetId: string;
  readonly status: DealStatus;
  readonly listingVerified: boolean;
  readonly protectionPeriod: number;
  readonly gracePeriod: number;
  readonly createdAt: number;
  readonly fundedAt: number;
  readonly deliveryDeadline: number;
  readonly deliveredAt: number;
  readonly protectionEnd: number;
  readonly settledAt: number;
  readonly lastKind: string | null;
  readonly lastObservedAt: number;
  readonly lastEvidenceHash: string;
}

export interface WalletState {
  readonly sol: number;
  readonly tokens: bigint;
}

export interface Snapshot {
  readonly deals: readonly Deal[];
  readonly now: number;
  readonly wallet?: WalletState;
}

type Decoded = Record<string, any>;
type AccountClient = { all(): Promise<{ publicKey: PublicKey; account: Decoded }[]> };

const num = (value: { toNumber(): number }): number => value.toNumber();

function toDeal(address: PublicKey, raw: Decoded): Deal {
  const buyer = raw.buyer as PublicKey;
  return {
    address,
    id: num(raw.id),
    seller: raw.seller,
    buyer: buyer.equals(PublicKey.default) ? null : buyer,
    price: BigInt(raw.price.toString()),
    sellerSteamId: raw.sellerSteamId.toString(),
    buyerSteamId: raw.buyerSteamId.toString(),
    itemName: raw.itemName,
    wear: raw.wear,
    pattern: raw.pattern,
    listedAssetId: raw.listedAssetId.toString(),
    status: Object.keys(raw.status)[0] as DealStatus,
    listingVerified: raw.listingVerified,
    protectionPeriod: num(raw.protectionPeriod),
    gracePeriod: num(raw.gracePeriod),
    createdAt: num(raw.createdAt),
    fundedAt: num(raw.fundedAt),
    deliveryDeadline: num(raw.deliveryDeadline),
    deliveredAt: num(raw.deliveredAt),
    protectionEnd: num(raw.protectionEnd),
    settledAt: num(raw.settledAt),
    lastKind: raw.lastKind ? Object.keys(raw.lastKind)[0] : null,
    lastObservedAt: num(raw.lastObservedAt),
    lastEvidenceHash: (raw.lastEvidenceHash as number[]).map((b) => b.toString(16).padStart(2, "0")).join(""),
  };
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
  const [rows, now, wallet] = await Promise.all([accounts.deal.all(), chainNow(), owner ? loadWallet(owner) : Promise.resolve(undefined)]);
  const deals = rows
    .map((r) => toDeal(r.publicKey, r.account))
    .filter((deal) => deal.createdAt >= MARKET_SINCE)
    .sort((a, b) => b.id - a.id);
  return { deals, now, wallet };
}

/** When the seller can be paid: after the reversal window (protection + grace) closes. */
export function windowEnd(deal: Deal): number {
  return deal.protectionEnd + deal.gracePeriod;
}
