// Smoke test of the will vault on a live cluster (run `npm run will:setup` first).
// A: heirs 50/30/20 made final, deposits still work, only the owner can pay in, the guardian vetoes twice and no more,
//    the owner checks in after the procedure ended, then stays silent -> anyone triggers, each heir claims their share.
// B: the owner cancels the will and gets everything back.
import * as anchor from "@anchor-lang/core";
import { createAssociatedTokenAccountIdempotentInstruction, getAccount, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SYSVAR_CLOCK_PUBKEY, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import BN from "bn.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clusterFromEnv, KEYS_DIR, loadKeypair, ROOT, rpcUrl } from "./lib/env.ts";
import type { WillDeployment } from "./will-setup.ts";

const UNIT = 1_000_000;
/** Seconds of slack so a transaction never lands on a bank clock slightly behind the one we waited on. */
const CLOCK_MARGIN = 2;
type Decoded = Record<string, any>;

const cluster = clusterFromEnv();
const connection = new Connection(rpcUrl(cluster), "confirmed");
const deployer = loadKeypair(join(KEYS_DIR, "deployer.json"));
const deployment = JSON.parse(readFileSync(join(ROOT, `will.${cluster}.json`), "utf8")) as WillDeployment;
const mint = new PublicKey(deployment.mint);

function programFor(wallet: Keypair, idlFile: string): anchor.Program {
  const idl = JSON.parse(readFileSync(join(ROOT, "target", "idl", idlFile), "utf8")) as anchor.Idl;
  return new anchor.Program(idl, new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), { commitment: "confirmed" }));
}
const wv = (w: Keypair) => programFor(w, "will_vault.json");
const ata = (owner: PublicKey) => getAssociatedTokenAddressSync(mint, owner);

// Read at "confirmed": "processed" runs ahead of the bank clock the program judges deadlines by.
async function chainNow(): Promise<number> {
  const clock = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "confirmed");
  return clock ? Number(clock.data.readBigInt64LE(32)) : Math.floor(Date.now() / 1000);
}

async function waitUntilAfter(t: number): Promise<void> {
  while ((await chainNow()) <= t + CLOCK_MARGIN) await new Promise((r) => setTimeout(r, 1000));
}

async function fundSol(to: PublicKey, sol: number): Promise<void> {
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: deployer.publicKey, toPubkey: to, lamports: sol * LAMPORTS_PER_SOL }));
  await sendAndConfirmTransaction(connection, tx, [deployer]);
}

async function faucet(user: Keypair, amount: number): Promise<void> {
  await programFor(user, "micro_insurance.json").methods.faucet(new BN(amount * UNIT)).accounts({ user: user.publicKey, mint, tokenProgram: TOKEN_PROGRAM_ID }).rpc();
}

async function balance(owner: PublicKey): Promise<number> {
  return Number((await getAccount(connection, ata(owner))).amount) / UNIT;
}

async function refused(label: string, attempt: () => Promise<unknown>): Promise<void> {
  try {
    await attempt();
  } catch (error) {
    const reason = String((error as Error).message ?? error).match(/Error Message: ([^.]+)/)?.[1] ?? "rejected";
    console.log(`   ok, refused: ${label} (${reason})`);
    return;
  }
  throw new Error(`ERROR: ${label} was accepted`);
}

function willAddress(owner: PublicKey, id: number): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("will"), owner.toBuffer(), new BN(id).toArrayLike(Buffer, "le", 8)], new PublicKey(deployment.programId))[0];
}

async function readWill(will: PublicKey): Promise<Decoded> {
  return (wv(deployer).account as unknown as Record<string, { fetch(a: PublicKey): Promise<Decoded> }>).will.fetch(will);
}

async function main(): Promise<void> {
  console.log(`cluster ${cluster}, program ${deployment.programId}, inactivity ${deployment.inactivityPeriod}s, claim period ${deployment.claimPeriod}s`);
  const [owner, guardian, stranger, ...heirs] = Array.from({ length: 6 }, () => Keypair.generate());
  for (const k of [owner, guardian, stranger]) await fundSol(k.publicKey, 0.05);
  await faucet(owner, 1000);
  await faucet(stranger, 10);

  const id = Date.now();
  const will = willAddress(owner.publicKey, id);
  const funds = { will, mint, ownerAta: ata(owner.publicKey), tokenProgram: TOKEN_PROGRAM_ID };
  const ownerFunds = (o = owner) => ({ ...funds, owner: o.publicKey });

  // ---- A
  await wv(owner).methods.createWill(new BN(id), guardian.publicKey).accounts({ owner: owner.publicKey, mint, tokenProgram: TOKEN_PROGRAM_ID }).rpc();
  console.log(`A: will ${will.toBase58()} created, guardian ${guardian.publicKey.toBase58().slice(0, 8)}…`);

  const shares = [5000, 3000, 2000];
  const list = heirs.map((h, i) => ({ wallet: h.publicKey, bps: shares[i] }));
  await refused("shares adding up to 90%", () => wv(owner).methods.setBeneficiaries(list.map((b, i) => ({ ...b, bps: i === 0 ? 4000 : b.bps }))).accounts({ owner: owner.publicKey, will }).rpc());
  await wv(owner).methods.setBeneficiaries(list).accounts({ owner: owner.publicKey, will }).rpc();
  await wv(owner).methods.lockBeneficiaries().accounts({ owner: owner.publicKey, will }).rpc();
  console.log("A: heirs 50/30/20 set and made final");
  await refused("changing heirs after the lock", () => wv(owner).methods.setBeneficiaries([...list].reverse()).accounts({ owner: owner.publicKey, will }).rpc());

  await wv(owner).methods.deposit(new BN(300 * UNIT)).accounts(ownerFunds()).rpc();
  await wv(owner).methods.withdraw(new BN(50 * UNIT)).accounts(ownerFunds()).rpc();
  await wv(owner).methods.deposit(new BN(53 * UNIT)).accounts(ownerFunds()).rpc();
  console.log(`A: deposits after the lock still work: vault holds ${300 - 50 + 53} tUSDC`);
  await refused("a deposit by someone other than the owner", () =>
    wv(stranger).methods.deposit(new BN(1 * UNIT)).accounts({ ...funds, owner: stranger.publicKey, ownerAta: ata(stranger.publicKey) }).rpc());

  await refused("a veto while the owner is active", () => wv(guardian).methods.veto().accounts({ guardian: guardian.publicKey, will }).rpc());
  for (const n of [1, 2]) {
    await waitUntilAfter((await readWill(will)).lastAlive.toNumber() + deployment.inactivityPeriod);
    await wv(guardian).methods.veto().accounts({ guardian: guardian.publicKey, will }).rpc();
    console.log(`A: owner silent, procedure running -> guardian veto #${n}, timer reset`);
  }
  await waitUntilAfter((await readWill(will)).lastAlive.toNumber() + deployment.inactivityPeriod);
  await refused("a third veto", () => wv(guardian).methods.veto().accounts({ guardian: guardian.publicKey, will }).rpc());

  let w = await readWill(will);
  await waitUntilAfter(w.lastAlive.toNumber() + deployment.inactivityPeriod + deployment.claimPeriod);
  await wv(owner).methods.checkIn().accounts({ owner: owner.publicKey, will }).rpc();
  console.log("A: procedure over but nobody triggered it -> owner checks in, timer back to the start, vetoes restored");
  await refused("triggering right after the owner's check-in", () => wv(stranger).methods.triggerDistribution().accounts({ submitter: stranger.publicKey, will }).rpc());

  w = await readWill(will);
  await waitUntilAfter(w.lastAlive.toNumber() + deployment.inactivityPeriod + deployment.claimPeriod);
  await wv(stranger).methods.triggerDistribution().accounts({ submitter: stranger.publicKey, will }).rpc();
  console.log(`A: owner silent through both periods -> a stranger triggered the payout of ${(await readWill(will)).distributedTotal.toNumber() / UNIT} tUSDC`);
  await refused("the owner withdrawing after the trigger", () => wv(owner).methods.withdraw(new BN(1 * UNIT)).accounts(ownerFunds()).rpc());
  await refused("the owner cancelling after the trigger", () => wv(owner).methods.cancelWill().accounts(ownerFunds()).rpc());

  const claim = (i: number, to: PublicKey) =>
    wv(stranger).methods.claimShare(i).accounts({ submitter: stranger.publicKey, will, beneficiaryAta: ata(to), mint, tokenProgram: TOKEN_PROGRAM_ID })
      .preInstructions([createAssociatedTokenAccountIdempotentInstruction(stranger.publicKey, ata(to), to, mint)]).rpc();
  await refused("paying heir #0's share to someone else", () => claim(0, stranger.publicKey));
  const received: number[] = [];
  for (const [i, h] of heirs.entries()) {
    await claim(i, h.publicKey);
    received.push(await balance(h.publicKey));
  }
  console.log(`A: heirs received ${received.join(" / ")} tUSDC (sum ${received.reduce((a, b) => a + b, 0)})`);
  await refused("claiming the same share twice", () => claim(0, heirs[0].publicKey));
  const left = Number((await getAccount(connection, PublicKey.findProgramAddressSync([Buffer.from("vault"), will.toBuffer()], new PublicKey(deployment.programId))[0])).amount);
  if (left !== 0) throw new Error(`ERROR: ${left} units left in the vault`);
  console.log("A: vault empty, no rounding dust left");

  // ---- B
  const idB = id + 1;
  const willB = willAddress(owner.publicKey, idB);
  await wv(owner).methods.createWill(new BN(idB), null).accounts({ owner: owner.publicKey, mint, tokenProgram: TOKEN_PROGRAM_ID }).rpc();
  await wv(owner).methods.deposit(new BN(100 * UNIT)).accounts({ ...ownerFunds(), will: willB }).rpc();
  const before = await balance(owner.publicKey);
  await wv(owner).methods.cancelWill().accounts({ ...ownerFunds(), will: willB }).rpc();
  const closed = (await connection.getAccountInfo(willB)) === null;
  console.log(`B: owner cancelled the will: ${before} -> ${await balance(owner.publicKey)} tUSDC, will account closed = ${closed}`);
  console.log("EVERYTHING WORKS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
