// Smoke test of ProofSwap on a live cluster, with the attestor (npm run attestor) running.
// A: list -> verify listing -> prove the buyer's inventory is public and pay -> demo trade -> delivery proof
//    -> wait out the reversal window -> seller paid.
// B: list -> pay -> trade -> delivery proof -> seller reverses the trade -> reversal proof -> buyer refunded.
// C: the attestor refuses to sign a delivery that did not happen.
// D: nobody can pay with a hidden inventory, for an unverified listing, or with a proof made for another account.
// E: the buyer hiding their inventory pays the seller only before delivery, never inside the reversal window.
import * as anchor from "@anchor-lang/core";
import { getAccount, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Ed25519Program, Keypair, LAMPORTS_PER_SOL, PublicKey, SYSVAR_CLOCK_PUBKEY, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import BN from "bn.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AttestResult } from "../attestor/attest.ts";
import { attestationMessage, type AttestationKind } from "../attestor/sign.ts";
import { clusterFromEnv, KEYS_DIR, loadKeypair, ROOT, rpcUrl } from "./lib/env.ts";
import type { ProofSwapDeployment } from "./proofswap-setup.ts";

const ATTESTOR = process.env.ATTESTOR_URL ?? "http://localhost:8787";
const SELLER_STEAM = "76561198000000101";
const BUYER_STEAM = "76561198000000202";
const OTHER_STEAM = "76561198000000303"; // never read: only used to show a proof cannot be moved to another account
const PRICE = new BN(100 * 1_000_000);

type Decoded = Record<string, any>;
interface SimItem { assetid: string; name: string; wear: string; pattern: number; tradable: boolean }

const cluster = clusterFromEnv();
const connection = new Connection(rpcUrl(cluster), "confirmed");
const deployer = loadKeypair(join(KEYS_DIR, "deployer.json"));
const deployment = JSON.parse(readFileSync(join(ROOT, `proofswap.${cluster}.json`), "utf8")) as ProofSwapDeployment;
const mint = new PublicKey(deployment.mint);

function programFor(wallet: Keypair, idlFile: string): anchor.Program {
  const idl = JSON.parse(readFileSync(join(ROOT, "target", "idl", idlFile), "utf8")) as anchor.Idl;
  return new anchor.Program(idl, new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), { commitment: "confirmed" }));
}
const ps = (wallet: Keypair): anchor.Program => programFor(wallet, "proofswap.json");

async function http<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${ATTESTOR}${path}`, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(`${path}: ${json.error ?? response.status}`);
  return json;
}

async function chainNow(): Promise<number> {
  const clock = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "processed");
  return clock ? Number(clock.data.readBigInt64LE(32)) : Math.floor(Date.now() / 1000);
}

async function fundSol(to: PublicKey, sol: number): Promise<void> {
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: deployer.publicKey, toPubkey: to, lamports: Math.round(sol * LAMPORTS_PER_SOL) }));
  await sendAndConfirmTransaction(connection, tx, [deployer]);
}

async function faucet(user: Keypair, amount: number): Promise<void> {
  const program = programFor(user, "micro_insurance.json");
  await program.methods.faucet(new BN(amount * 1_000_000)).accounts({ user: user.publicKey, mint, tokenProgram: TOKEN_PROGRAM_ID }).rpc();
}

async function balance(owner: PublicKey): Promise<number> {
  return Number((await getAccount(connection, getAssociatedTokenAddressSync(mint, owner))).amount) / 1_000_000;
}

function ed25519For(result: AttestResult): anchor.web3.TransactionInstruction {
  const hash = Buffer.from(result.evidenceHash as string, "hex");
  const message = attestationMessage(new PublicKey(result.deal), result.kind as AttestationKind, result.steamId, result.observedAt, hash);
  return Ed25519Program.createInstructionWithPublicKey({
    publicKey: new PublicKey(result.attestor).toBytes(),
    message,
    signature: Buffer.from(result.signature as string, "hex"),
  });
}

async function getAttestation(deal: PublicKey, kind: string, steamId?: string): Promise<AttestResult> {
  const result = await http<AttestResult>("/attest", { deal: deal.toBase58(), kind, steamId });
  if (!result.ok) throw new Error(`attestor refused ${kind}: ${result.reason}`);
  return result;
}

const hashOf = (result: AttestResult): number[] => [...Buffer.from(result.evidenceHash as string, "hex")];

/** The program must reject `run` with exactly this error code; any other outcome fails the test. */
async function expectRefusal(label: string, code: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    const got = (error as { error?: { errorCode?: { code?: string } } }).error?.errorCode?.code;
    console.log(`${label} = ${got === code} (${got ?? String(error).slice(0, 120)})`);
    if (got !== code) throw error;
    return;
  }
  throw new Error(`${label}: ERROR the program accepted it`);
}

async function nextDealAddress(program: anchor.Program): Promise<PublicKey> {
  const accounts = program.account as unknown as Record<string, { fetch(a: PublicKey): Promise<Decoded> }>;
  const config = await accounts.config.fetch(new PublicKey(deployment.config));
  return PublicKey.findProgramAddressSync([Buffer.from("deal"), config.dealCount.toArrayLike(Buffer, "le", 8)], program.programId)[0];
}

async function list(seller: Keypair, item: SimItem): Promise<PublicKey> {
  const program = ps(seller);
  const deal = await nextDealAddress(program);
  await program.methods
    .createListing({ price: PRICE, sellerSteamId: new BN(SELLER_STEAM), itemName: item.name, wear: item.wear, pattern: item.pattern, listedAssetId: new BN(item.assetid) })
    .accounts({ seller: seller.publicKey, deal })
    .rpc();
  return deal;
}

/** Pays into the vault. `proof` and `steamId` can be overridden to show what the program refuses. */
async function pay(buyer: Keypair, deal: PublicKey, proof?: AttestResult, steamId = BUYER_STEAM): Promise<void> {
  const attestation = proof ?? (await getAttestation(deal, "buyer_public", steamId));
  await ps(buyer).methods
    .fund(new BN(steamId), new BN(attestation.observedAt), hashOf(attestation))
    .accounts({ buyer: buyer.publicKey, deal, mint, buyerAta: getAssociatedTokenAddressSync(mint, buyer.publicKey), tokenProgram: TOKEN_PROGRAM_ID })
    .preInstructions([ed25519For(attestation)])
    .rpc();
}

function settleAccounts(deal: PublicKey, seller: PublicKey, buyer: PublicKey) {
  return {
    deal,
    mint,
    sellerAta: getAssociatedTokenAddressSync(mint, seller),
    buyerAta: getAssociatedTokenAddressSync(mint, buyer),
    tokenProgram: TOKEN_PROGRAM_ID,
  };
}

async function main(): Promise<void> {
  console.log(`cluster ${cluster}, program ${deployment.programId}, protection ${deployment.protectionPeriod}s + grace ${deployment.gracePeriod}s`);
  const seller = Keypair.generate();
  const buyer = Keypair.generate();
  await fundSol(seller.publicKey, 0.03);
  await fundSol(buyer.publicKey, 0.02);
  await faucet(buyer, 1000);
  await faucet(seller, 1); // creates the seller's token account
  await http("/sim/reset", {});
  const inventory = await http<{ items: SimItem[] }>(`/inventory/${SELLER_STEAM}`);
  const [itemA, itemB, itemE] = inventory.items.filter((i) => i.tradable && i.wear !== "");
  const submitter = ps(deployer); // anyone can submit attestations; here the deployer pays the fee
  const dealAccount = (address: PublicKey) => (submitter.account as unknown as Record<string, { fetch(a: PublicKey): Promise<Decoded> }>).deal.fetch(address);
  const setBuyerPrivate = (isPrivate: boolean) => http("/sim/privacy", { steamId: BUYER_STEAM, private: isPrivate });

  const verifyListing = async (deal: PublicKey) => {
    const listing = await getAttestation(deal, "listing");
    await submitter.methods.attestListing(new BN(listing.observedAt), hashOf(listing)).accounts({ submitter: deployer.publicKey, deal }).preInstructions([ed25519For(listing)]).rpc();
  };
  const deliver = async (deal: PublicKey): Promise<AttestResult> => {
    const delivery = await getAttestation(deal, "delivery");
    await submitter.methods.attestDelivery(new BN(delivery.observedAt), hashOf(delivery)).accounts({ submitter: deployer.publicKey, deal }).preInstructions([ed25519For(delivery)]).rpc();
    return delivery;
  };
  const claimBuyerHidden = async (deal: PublicKey) => {
    const hidden = await getAttestation(deal, "buyer_hidden");
    await submitter.methods
      .attestBuyerHidden(new BN(hidden.observedAt), hashOf(hidden))
      .accounts({ submitter: deployer.publicKey, ...settleAccounts(deal, seller.publicKey, buyer.publicKey) })
      .preInstructions([ed25519For(hidden)])
      .rpc();
  };

  // ---- A: happy path
  const dealA = await list(seller, itemA);
  console.log(`A: listed ${itemA.name} (float ${itemA.wear}, pattern ${itemA.pattern}) as ${dealA.toBase58()}`);

  // ---- D: a buyer whose inventory is hidden gets no proof, so cannot pay
  await setBuyerPrivate(true);
  const hiddenBuyer = await http<AttestResult>("/attest", { deal: dealA.toBase58(), kind: "buyer_public", steamId: BUYER_STEAM });
  console.log(`D: no proof (so no payment) while the buyer's inventory is hidden = ${!hiddenBuyer.ok} (${hiddenBuyer.reason})`);
  await setBuyerPrivate(false);

  const buyerProof = await getAttestation(dealA, "buyer_public", BUYER_STEAM);
  await expectRefusal("D: paying before Steam confirms the listing is refused", "ListingNotVerified", () => pay(buyer, dealA, buyerProof));
  await verifyListing(dealA);
  await expectRefusal("D: a proof made for one Steam account cannot pay for another", "AttestationMismatch", () => pay(buyer, dealA, buyerProof, OTHER_STEAM));
  await pay(buyer, dealA, buyerProof);
  console.log(`A: listing verified by Steam, buyer's inventory proven public, buyer paid 100 tUSDC (buyer now ${await balance(buyer.publicKey)})`);

  const refused = await http<AttestResult>("/attest", { deal: dealA.toBase58(), kind: "delivery" });
  console.log(`C: delivery before the trade is refused = ${!refused.ok} (${refused.reason})`);

  await http("/sim/move", { from: SELLER_STEAM, to: BUYER_STEAM, assetid: itemA.assetid });
  const delivery = await deliver(dealA);
  const deal = await dealAccount(dealA);
  const windowEnd = deal.protectionEnd.toNumber() + deal.gracePeriod.toNumber();
  console.log(`A: delivered (new asset id in buyer's inventory: ${JSON.parse(delivery.evidence).match.assetid}); reversal window ends at ${windowEnd}`);

  // ---- E1: inside the reversal window the buyer's privacy settings change nothing
  await setBuyerPrivate(true);
  await expectRefusal("E: hiding the buyer's inventory inside the reversal window does not pay the seller early", "WrongStatus", () => claimBuyerHidden(dealA));
  await setBuyerPrivate(false);

  await expectRefusal("A: finalize before the window ends is refused", "ProtectionNotOver", () => submitter.methods.finalize().accounts(settleAccounts(dealA, seller.publicKey, buyer.publicKey)).rpc());

  // ---- B: reversal, started while A waits
  const dealB = await list(seller, itemB);
  await verifyListing(dealB);
  await pay(buyer, dealB);
  const moved = await http<{ newAssetId: string }>("/sim/move", { from: SELLER_STEAM, to: BUYER_STEAM, assetid: itemB.assetid });
  await deliver(dealB);
  await http("/sim/move", { from: BUYER_STEAM, to: SELLER_STEAM, assetid: moved.newAssetId }); // the seller reverses the trade
  const reversal = await getAttestation(dealB, "reversal");
  const buyerBefore = await balance(buyer.publicKey);
  await submitter.methods
    .attestReversal({ returnedToSeller: {} }, new BN(reversal.observedAt), hashOf(reversal))
    .accounts({ submitter: deployer.publicKey, ...settleAccounts(dealB, seller.publicKey, buyer.publicKey) })
    .preInstructions([ed25519For(reversal)])
    .rpc();
  console.log(`B: seller reversed the trade -> buyer refunded: ${buyerBefore} -> ${await balance(buyer.publicKey)} tUSDC`);

  // ---- E2: before delivery, a buyer who proved a public inventory and then hides it forfeits the payment
  const dealE = await list(seller, itemE);
  await verifyListing(dealE);
  await pay(buyer, dealE);
  await setBuyerPrivate(true);
  const sellerBeforeE = await balance(seller.publicKey);
  await claimBuyerHidden(dealE);
  await setBuyerPrivate(false);
  console.log(`E: buyer hid the inventory after paying, before delivery -> seller paid: ${sellerBeforeE} -> ${await balance(seller.publicKey)} tUSDC`);

  // ---- A: wait out the window, then anyone settles
  while ((await chainNow()) <= windowEnd) await new Promise((r) => setTimeout(r, 2000));
  const sellerBefore = await balance(seller.publicKey);
  await submitter.methods.finalize().accounts(settleAccounts(dealA, seller.publicKey, buyer.publicKey)).rpc();
  console.log(`A: window over, no reversal -> seller paid: ${sellerBefore} -> ${await balance(seller.publicKey)} tUSDC`);
  console.log("EVERYTHING WORKS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
