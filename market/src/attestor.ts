// Client of the attestor (Steam reader + signer) and of its demo Steam simulator.
import { Ed25519Program, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { ATTESTOR_URL } from "./config";

export type AttestationKind =
  | "listedItemInSellerInventory"
  | "deliveredToBuyer"
  | "returnedToSeller"
  | "sellerInventoryHidden"
  | "buyerInventoryHidden"
  | "buyerInventoryPublic";
export type AttestRequest = "listing" | "delivery" | "reversal" | "seller_hidden" | "buyer_hidden" | "buyer_public";

export interface AttestResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly kind: AttestationKind;
  readonly deal: string;
  /** The Steam account that was observed; it is part of the signed message and the program checks it. */
  readonly steamId: string;
  readonly observedAt: number;
  readonly evidence: string;
  readonly evidenceHash?: string;
  readonly signature?: string;
  readonly attestor: string;
}

export interface InventoryItem {
  readonly assetid: string;
  readonly name: string;
  readonly wear: string;
  readonly pattern: number;
  readonly tradable: boolean;
  readonly type: string;
  readonly icon: string;
  readonly color: string;
}

export interface InventoryResponse {
  readonly steamId: string;
  readonly source: string;
  readonly private: boolean;
  readonly items: InventoryItem[];
}

export interface SimAccount {
  readonly steamId: string;
  readonly label: string;
  readonly private: boolean;
  readonly items: InventoryItem[];
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${ATTESTOR_URL}${path}`, body === undefined
      ? undefined
      : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error(`Atestator nie odpowiada pod ${ATTESTOR_URL}. Uruchom: npm run attestor`);
  }
  const json = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(json.error ?? `Atestator zwrócił ${response.status}`);
  return json;
}

export const getInventory = (steamId: string) => call<InventoryResponse>(`/inventory/${steamId}`);
/** `steamId` is only for "buyer_public": the buyer is checked before the deal has one. */
export const requestAttestation = (deal: string, kind: AttestRequest, steamId?: string) => call<AttestResult>("/attest", { deal, kind, steamId });
export const simAccounts = () => call<SimAccount[]>("/sim/accounts");
export const simMove = (from: string, to: string, assetid: string) => call<{ newAssetId: string }>("/sim/move", { from, to, assetid });
export const simPrivacy = (steamId: string, isPrivate: boolean) => call<{ ok: boolean }>("/sim/privacy", { steamId, private: isPrivate });
export const simReset = () => call<{ ok: boolean }>("/sim/reset", {});

// Must match programs/proofswap/src/attestation.rs: prefix | deal | kind | steam_id (u64 LE) | observed_at (i64 LE) | sha256(evidence).
const PREFIX = new TextEncoder().encode("proofswap-v2:");
const KIND_INDEX: Record<AttestationKind, number> = {
  listedItemInSellerInventory: 0,
  deliveredToBuyer: 1,
  returnedToSeller: 2,
  sellerInventoryHidden: 3,
  buyerInventoryHidden: 4,
  buyerInventoryPublic: 5,
};

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function attestationMessage(deal: PublicKey, kind: AttestationKind, steamId: string, observedAt: number, hash: Uint8Array): Uint8Array {
  const message = new Uint8Array(PREFIX.length + 32 + 1 + 8 + 8 + 32);
  const view = new DataView(message.buffer);
  message.set(PREFIX, 0);
  message.set(deal.toBytes(), PREFIX.length);
  message[PREFIX.length + 32] = KIND_INDEX[kind];
  view.setBigUint64(PREFIX.length + 33, BigInt(steamId), true);
  view.setBigInt64(PREFIX.length + 41, BigInt(observedAt), true);
  message.set(hash, PREFIX.length + 49);
  return message;
}

/** The native Ed25519 check that must sit right before the ProofSwap instruction in the same transaction. */
export function ed25519Instruction(result: AttestResult): TransactionInstruction {
  if (!result.signature || !result.evidenceHash) throw new Error("This attestation is not signed");
  return Ed25519Program.createInstructionWithPublicKey({
    publicKey: new PublicKey(result.attestor).toBytes(),
    message: attestationMessage(new PublicKey(result.deal), result.kind, result.steamId, result.observedAt, hexToBytes(result.evidenceHash)),
    signature: hexToBytes(result.signature),
  });
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
