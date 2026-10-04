// The attestor's only job: look at a Steam inventory and sign what it saw. The program decides what that means.
import { PublicKey } from "@solana/web3.js";
import { attestorKey, chainNow, loadDeal } from "./chain.ts";
import { matchingItems, parseInventory } from "./inventory.ts";
import { attestationMessage, evidenceHash, signMessage, type AttestationKind } from "./sign.ts";
import { readInventory, type InventoryRead } from "./steam.ts";

/** What each request asks Steam: is the item there ("item"), is the inventory hidden ("private") or readable ("public"). */
type Check = "item" | "private" | "public";

export const REQUESTS = {
  listing: { kind: "listedItemInSellerInventory", whose: "seller", check: "item" },
  delivery: { kind: "deliveredToBuyer", whose: "buyer", check: "item" },
  reversal: { kind: "returnedToSeller", whose: "seller", check: "item" },
  seller_hidden: { kind: "sellerInventoryHidden", whose: "seller", check: "private" },
  buyer_hidden: { kind: "buyerInventoryHidden", whose: "buyer", check: "private" },
  buyer_public: { kind: "buyerInventoryPublic", whose: "buyer", check: "public" },
} as const satisfies Record<string, { kind: AttestationKind; whose: "seller" | "buyer"; check: Check }>;
export type AttestRequest = keyof typeof REQUESTS;

/** A "hidden" claim moves money, so a real Steam account must look private on two reads this far apart. */
const RECHECK_DELAY_MS = 4000;

export interface AttestResult {
  ok: boolean;
  reason?: string;
  kind: AttestationKind;
  deal: string;
  /** The Steam account that was observed; the program checks it against the deal. */
  steamId: string;
  observedAt: number;
  /** Exactly the JSON whose sha256 is signed, so anyone can recompute the hash. */
  evidence: string;
  evidenceHash?: string;
  signature?: string;
  attestor: string;
}

export function isAttestRequest(value: unknown): value is AttestRequest {
  return typeof value === "string" && value in REQUESTS;
}

/**
 * `buyerSteamId` is only used by `buyer_public`: the buyer has to be checked before the deal has a buyer.
 * Every other request observes the account recorded in the deal.
 */
export async function attest(dealAddress: string, request: AttestRequest, buyerSteamId?: string): Promise<AttestResult> {
  const address = new PublicKey(dealAddress);
  const deal = await loadDeal(address);
  const { kind, whose, check } = REQUESTS[request];
  const steamId = request === "buyer_public" ? (buyerSteamId ?? "") : whose === "buyer" ? deal.buyerSteamId : deal.sellerSteamId;
  const attestor = attestorKey.publicKey.toBase58();
  const refused = (reason: string, observedAt = 0, evidence = ""): AttestResult => ({
    ok: false, reason, kind, deal: dealAddress, steamId, observedAt, evidence, attestor,
  });

  if (!/^\d{17}$/.test(steamId)) {
    return refused(request === "buyer_public" ? "Podaj SteamID64 kupującego (17 cyfr)." : "Ta transakcja nie ma jeszcze kupującego.");
  }
  if (request === "buyer_public") {
    if (deal.status !== "listed") return refused("Ta transakcja nie czeka już na kupującego.");
    if (steamId === deal.sellerSteamId) return refused("Kupujący i sprzedający muszą mieć różne konta Steam.");
  }

  const read = await observe(steamId, check);
  const observedAt = await chainNow();
  const spec = { name: deal.itemName, wear: deal.wear, pattern: deal.pattern };
  const matches = check === "item" && read.inventory ? matchingItems(parseInventory(read.inventory), spec) : [];
  const match = matches.length === 1 ? matches[0] : undefined;
  const evidence = JSON.stringify({
    kind,
    deal: dealAddress,
    steam_id: steamId,
    source: read.source,
    observed_at: observedAt,
    inventory_private: read.private,
    ...(check === "item" ? { item: spec, match: match ? { assetid: match.assetid, name: match.name, wear: match.wear, pattern: match.pattern, tradable: match.tradable } : null } : {}),
    total_inventory_count: read.inventory?.total_inventory_count ?? null,
  });

  const reason = check === "item" ? itemRefusal(request, read, spec.wear, matches.length, match?.tradable) : visibilityRefusal(request, read);
  if (reason) return refused(reason, observedAt, evidence);

  const hash = evidenceHash(evidence);
  const signature = signMessage(attestorKey, attestationMessage(address, kind, steamId, observedAt, hash));
  return { ok: true, kind, deal: dealAddress, steamId, observedAt, evidence, evidenceHash: hash.toString("hex"), signature: signature.toString("hex"), attestor };
}

async function observe(steamId: string, check: Check): Promise<InventoryRead> {
  const first = await readInventory(steamId);
  if (check !== "private" || !first.private || first.source.startsWith("demo:")) return first;
  await new Promise((resolve) => setTimeout(resolve, RECHECK_DELAY_MS));
  return readInventory(steamId);
}

const ownerOf = (request: AttestRequest): string => (REQUESTS[request].whose === "buyer" ? "kupującego" : "sprzedającego");

/** Why the attestor will not sign a statement about visibility; undefined when the statement holds. */
function visibilityRefusal(request: AttestRequest, read: InventoryRead): string | undefined {
  if (REQUESTS[request].check === "private") return read.private ? undefined : `Inventory ${ownerOf(request)} jest publiczne.`;
  return read.private ? `Inventory ${ownerOf(request)} jest prywatne. Ustaw je jako publiczne i nie ukrywaj do końca transakcji.` : undefined;
}

/** Why the attestor will not sign that the item is in an inventory; undefined when it is there exactly once. */
function itemRefusal(request: AttestRequest, read: InventoryRead, wear: string, matchCount: number, tradable: boolean | undefined): string | undefined {
  // A float-less or ambiguous spec could be satisfied by a copy that never changed hands: never sign it.
  if (!wear) return "Przedmiot bez floatu nie jest unikalny, nie da się udowodnić przekazania.";
  if (read.private) return `Inventory ${ownerOf(request)} jest prywatne, nie da się go sprawdzić.`;
  if (matchCount > 1) return "W inventory jest kilka pasujących przedmiotów, dowód byłby niejednoznaczny.";
  if (tradable === undefined) return `W inventory ${ownerOf(request)} nie ma tego przedmiotu (nazwa, float i wzór muszą się zgadzać).`;
  if (request === "listing" && !tradable) return "Ten przedmiot nie jest wymienialny na Steamie.";
  return undefined;
}
