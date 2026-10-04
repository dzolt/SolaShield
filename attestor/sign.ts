// What the attestor signs. Must match programs/proofswap/src/attestation.rs byte for byte.
import { createHash, createPrivateKey, sign } from "node:crypto";
import type { Keypair, PublicKey } from "@solana/web3.js";

// The position in this list is the kind's number in the signed message (and in the program's enum).
export const ATTESTATION_KINDS = [
  "listedItemInSellerInventory",
  "deliveredToBuyer",
  "returnedToSeller",
  "sellerInventoryHidden",
  "buyerInventoryHidden",
  "buyerInventoryPublic",
] as const;
export type AttestationKind = (typeof ATTESTATION_KINDS)[number];

const PREFIX = Buffer.from("proofswap-v2:");
// PKCS#8 header for a raw 32-byte Ed25519 seed, so Node's crypto can sign with a Solana keypair.
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export function evidenceHash(evidence: string): Buffer {
  return createHash("sha256").update(evidence).digest();
}

/** prefix | deal | kind | steam_id (u64 LE) | observed_at (i64 LE) | sha256(evidence): the account is signed too. */
export function attestationMessage(deal: PublicKey, kind: AttestationKind, steamId: string, observedAt: number, hash: Buffer): Buffer {
  const account = Buffer.alloc(8);
  account.writeBigUInt64LE(BigInt(steamId));
  const time = Buffer.alloc(8);
  time.writeBigInt64LE(BigInt(observedAt));
  return Buffer.concat([PREFIX, deal.toBuffer(), Buffer.from([ATTESTATION_KINDS.indexOf(kind)]), account, time, hash]);
}

export function signMessage(keypair: Keypair, message: Buffer): Buffer {
  const seed = Buffer.from(keypair.secretKey.slice(0, 32));
  const key = createPrivateKey({ key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]), format: "der", type: "pkcs8" });
  return sign(null, message, key);
}
