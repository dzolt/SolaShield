// Read-only access to ProofSwap deals. The attestor never signs transactions, only messages.
import * as anchor from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clusterFromEnv, KEYS_DIR, loadKeypair, ROOT, rpcUrl } from "../scripts/lib/env.ts";

export const cluster = clusterFromEnv();
export const connection = new Connection(rpcUrl(cluster), "confirmed");

const idl = JSON.parse(readFileSync(join(ROOT, "target", "idl", "proofswap.json"), "utf8")) as anchor.Idl;
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(Keypair.generate()), { commitment: "confirmed" });
export const program = new anchor.Program(idl, provider);
export const attestorKey = loadKeypair(join(KEYS_DIR, "attestor.json"));

export interface DealView {
  seller: PublicKey;
  buyer: PublicKey;
  sellerSteamId: string;
  buyerSteamId: string;
  itemName: string;
  wear: string;
  pattern: number;
  status: string;
}

type Decoded = Record<string, any>;

export async function loadDeal(address: PublicKey): Promise<DealView> {
  const accounts = program.account as unknown as Record<string, { fetch(a: PublicKey): Promise<Decoded> }>;
  const raw = await accounts.deal.fetch(address);
  return {
    seller: raw.seller,
    buyer: raw.buyer,
    sellerSteamId: raw.sellerSteamId.toString(),
    buyerSteamId: raw.buyerSteamId.toString(),
    itemName: raw.itemName,
    wear: raw.wear,
    pattern: raw.pattern,
    status: Object.keys(raw.status)[0],
  };
}

/**
 * The program's own clock (Clock sysvar, unix_timestamp at byte 32), so an observation never looks "in the future".
 * Read at "confirmed": clients simulate their transaction against a confirmed bank, which can lag the newest one.
 */
export async function chainNow(): Promise<number> {
  const clock = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "confirmed");
  if (!clock) throw new Error("Cannot read the Clock sysvar");
  return Number(clock.data.readBigInt64LE(32));
}
