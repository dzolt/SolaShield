import type * as anchor from "@anchor-lang/core";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { ed25519Instruction, hexToBytes, requestAttestation, type AttestRequest, type AttestResult, type InventoryItem } from "./attestor";
import { CONFIG, FAUCET_TOKENS, MINT, TOKEN_DECIMALS } from "./config";
import type { Deal } from "./data";
import { formatUsdc, parseUsdc } from "./format";
import type { ActionOutcome } from "./hooks";
import { BN, makeFaucet, type SigningWallet } from "./program";

type Decoded = Record<string, any>;
const ata = (owner: PublicKey): PublicKey => getAssociatedTokenAddressSync(MINT, owner);

export async function claimTokens(wallet: SigningWallet): Promise<ActionOutcome> {
  const signature = await makeFaucet(wallet)
    .methods.faucet(new BN(FAUCET_TOKENS * 10 ** TOKEN_DECIMALS))
    .accounts({ user: wallet.publicKey, mint: MINT, tokenProgram: TOKEN_PROGRAM_ID })
    .rpc();
  return { message: `Dostałeś ${FAUCET_TOKENS} testowych tUSDC.`, signature };
}

async function nextDealAddress(program: anchor.Program): Promise<PublicKey> {
  const accounts = program.account as unknown as Record<string, { fetch(a: PublicKey): Promise<Decoded> }>;
  const config = await accounts.config.fetch(CONFIG);
  const id = config.dealCount.toArrayLike(Buffer, "le", 8) as Buffer;
  return PublicKey.findProgramAddressSync([Buffer.from("deal"), id], program.programId)[0];
}

export function validSteamId(steamId: string): boolean {
  return /^\d{17}$/.test(steamId.trim());
}

export async function createListing(
  program: anchor.Program,
  seller: PublicKey,
  steamId: string,
  item: InventoryItem,
  priceInput: string,
): Promise<{ outcome: ActionOutcome; deal: PublicKey }> {
  if (!validSteamId(steamId)) throw new Error("SteamID64 ma 17 cyfr.");
  if (!item.wear) throw new Error("Wystawić można tylko skina z floatem: to on (z wzorem) jednoznacznie identyfikuje egzemplarz.");
  const price = parseUsdc(priceInput);
  if (price <= 0n) throw new Error("Cena musi być większa od zera.");
  const deal = await nextDealAddress(program);
  const signature = await program.methods
    .createListing({
      price: new BN(price.toString()),
      sellerSteamId: new BN(steamId.trim()),
      itemName: item.name,
      wear: item.wear,
      pattern: item.pattern,
      listedAssetId: new BN(item.assetid),
    })
    .accounts({ seller, deal })
    .rpc();
  return { outcome: { message: `Wystawiono ${item.name} za ${formatUsdc(price)}.`, signature }, deal };
}

export async function cancelListing(program: anchor.Program, seller: PublicKey, deal: Deal): Promise<ActionOutcome> {
  const signature = await program.methods.cancelListing().accounts({ seller, deal: deal.address }).rpc();
  return { message: "Ogłoszenie wycofane.", signature };
}

/**
 * Steam must first show the buyer's inventory public (delivery can only be proven from a public one); the program
 * refuses to take the payment without that signed observation, so a hidden inventory or a mistyped SteamID fails here.
 */
export async function fund(
  program: anchor.Program,
  buyer: PublicKey,
  deal: Deal,
  buyerSteamId: string,
): Promise<{ outcome: ActionOutcome; attestation: AttestResult }> {
  if (!validSteamId(buyerSteamId)) throw new Error("Podaj swój SteamID64 (17 cyfr): na to konto sprzedający wyśle przedmiot.");
  const steamId = buyerSteamId.trim();
  const attestation = await requestAttestation(deal.address.toBase58(), "buyer_public", steamId);
  if (!attestation.ok || !attestation.evidenceHash) throw new Error(`Atestator nie podpisał: ${attestation.reason ?? "brak dowodu"}`);
  const signature = await program.methods
    .fund(new BN(steamId), new BN(attestation.observedAt), Array.from(hexToBytes(attestation.evidenceHash)))
    .accounts({ buyer, deal: deal.address, mint: MINT, buyerAta: ata(buyer), tokenProgram: TOKEN_PROGRAM_ID })
    .preInstructions([ed25519Instruction(attestation)])
    .rpc();
  return {
    outcome: { message: `Zapłacono ${formatUsdc(deal.price)}. Inventory kupującego jest publiczne, pieniądze leżą w sejfie programu do czasu dostawy.`, signature },
    attestation,
  };
}

function settleAccounts(deal: Deal) {
  if (!deal.buyer) throw new Error("Ta transakcja nie ma kupującego.");
  return { deal: deal.address, mint: MINT, sellerAta: ata(deal.seller), buyerAta: ata(deal.buyer), tokenProgram: TOKEN_PROGRAM_ID };
}

/** The payout may go to the seller's token account; create it if the seller never had one (anyone may pay for it). */
function ensureSellerAta(payer: PublicKey, deal: Deal): TransactionInstruction {
  return createAssociatedTokenAccountIdempotentInstruction(payer, ata(deal.seller), deal.seller, MINT);
}

const ATTESTATION_MESSAGES: Record<AttestRequest, string> = {
  listing: "Steam potwierdził: przedmiot jest w inventory sprzedającego.",
  delivery: "Steam potwierdził dostawę. Ruszyło okno, w którym sprzedający mógłby cofnąć wymianę.",
  reversal: "Steam pokazał przedmiot z powrotem u sprzedającego: wymiana cofnięta, pieniądze wróciły do kupującego.",
  seller_hidden: "Sprzedający ukrył inventory w oknie cofnięcia: pieniądze wróciły do kupującego.",
  buyer_hidden: "Kupujący ukrył inventory po zapłacie, przed dostawą: pieniądze trafiły do sprzedającego.",
  buyer_public: "Steam potwierdził, że inventory kupującego jest publiczne.",
};

/** Asks the attestor what Steam shows, then sends its signed observation to the program (anyone may send it). */
export async function submitAttestation(
  program: anchor.Program,
  submitter: PublicKey,
  deal: Deal,
  request: AttestRequest,
): Promise<{ outcome: ActionOutcome; attestation: AttestResult }> {
  const attestation = await requestAttestation(deal.address.toBase58(), request);
  if (!attestation.ok || !attestation.evidenceHash) throw new Error(`Atestator nie podpisał: ${attestation.reason ?? "brak dowodu"}`);
  const observedAt = new BN(attestation.observedAt);
  const hash = Array.from(hexToBytes(attestation.evidenceHash));
  const check = ed25519Instruction(attestation);

  let builder;
  if (request === "listing" || request === "delivery") {
    const method = request === "listing" ? program.methods.attestListing : program.methods.attestDelivery;
    builder = method(observedAt, hash).accounts({ submitter, deal: deal.address }).preInstructions([check]);
  } else if (request === "buyer_hidden") {
    builder = program.methods
      .attestBuyerHidden(observedAt, hash)
      .accounts({ submitter, ...settleAccounts(deal) })
      .preInstructions([ensureSellerAta(submitter, deal), check]);
  } else {
    const kind = request === "reversal" ? { returnedToSeller: {} } : { sellerInventoryHidden: {} };
    builder = program.methods
      .attestReversal(kind, observedAt, hash)
      .accounts({ submitter, ...settleAccounts(deal) })
      .preInstructions([ensureSellerAta(submitter, deal), check]);
  }
  const signature = await builder.rpc();
  return { outcome: { message: ATTESTATION_MESSAGES[request], signature }, attestation };
}

/** Right after listing: Steam confirms the item is in the seller's inventory (only the deal address is needed). */
export async function verifyListing(
  program: anchor.Program,
  submitter: PublicKey,
  deal: PublicKey,
): Promise<{ outcome: ActionOutcome; attestation: AttestResult }> {
  const attestation = await requestAttestation(deal.toBase58(), "listing");
  if (!attestation.ok || !attestation.evidenceHash) throw new Error(`Atestator nie podpisał: ${attestation.reason ?? "brak dowodu"}`);
  const signature = await program.methods
    .attestListing(new BN(attestation.observedAt), Array.from(hexToBytes(attestation.evidenceHash)))
    .accounts({ submitter, deal })
    .preInstructions([ed25519Instruction(attestation)])
    .rpc();
  return { outcome: { message: ATTESTATION_MESSAGES.listing, signature }, attestation };
}

export async function finalize(program: anchor.Program, submitter: PublicKey, deal: Deal): Promise<ActionOutcome> {
  const signature = await program.methods
    .finalize()
    .accounts({ submitter, ...settleAccounts(deal) })
    .preInstructions([ensureSellerAta(submitter, deal)])
    .rpc();
  return { message: `Okno cofnięcia minęło bez cofnięcia. Sprzedający dostał ${formatUsdc(deal.price)}.`, signature };
}

export async function refund(program: anchor.Program, submitter: PublicKey, deal: Deal): Promise<ActionOutcome> {
  const signature = await program.methods
    .refund()
    .accounts({ submitter, ...settleAccounts(deal) })
    .preInstructions([ensureSellerAta(submitter, deal)])
    .rpc();
  return { message: `Sprzedający nie dostarczył na czas. Kupujący dostał zwrot ${formatUsdc(deal.price)}.`, signature };
}
