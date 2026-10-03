// Smoke test on a real cluster: faucet -> deposit -> buy covers -> settle them with the Pyth price -> check balances.
// Needs `npm run setup` done and a funded deployer (it funds a fresh user with a little SOL).
import { getAccount, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { join } from "node:path";
import { reader } from "./lib/accounts.ts";
import { clusterFromEnv, KEYS_DIR, loadKeypair, makeProgram, readDeployment, rpcUrl } from "./lib/env.ts";
import { decodePriceUpdate, FEEDS, pushFeedAddress } from "./lib/pyth.ts";

const tokens = (n: number) => new BN(n * 1_000_000);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const EVENT_IN_SECONDS = 20;
const SOL_FEED = pushFeedAddress(FEEDS["SOL/USD"]);

const cluster = clusterFromEnv();
const deployment = readDeployment(cluster);
const connection = new Connection(rpcUrl(cluster), "confirmed");
const admin = loadKeypair(join(KEYS_DIR, "deployer.json"));
const program = makeProgram(connection, admin);
const pool = new PublicKey(deployment.pool);
const mint = new PublicKey(deployment.mint);
const vault = new PublicKey(deployment.vault);

function assertEqual<T>(label: string, actual: T, expected: T): void {
  if (String(actual) !== String(expected)) throw new Error(`ASSERT ${label}: expected ${expected}, got ${actual}`);
  console.log(`  ok  ${label} = ${actual}`);
}

async function clusterTime(): Promise<number> {
  const time = await connection.getBlockTime(await connection.getSlot("confirmed"));
  if (time === null) throw new Error("cluster time unavailable");
  return time;
}

const policyAddress = (id: number) =>
  PublicKey.findProgramAddressSync([Buffer.from("policy"), pool.toBuffer(), new BN(id).toArrayLike(Buffer, "le", 8)], program.programId)[0];
const productAddress = (id: number) =>
  PublicKey.findProgramAddressSync([Buffer.from("product"), pool.toBuffer(), new BN(id).toArrayLike(Buffer, "le", 4)], program.programId)[0];

async function tokenBalance(owner: PublicKey): Promise<bigint> {
  return (await getAccount(connection, getAssociatedTokenAddressSync(mint, owner))).amount;
}

async function poolState() {
  return (await reader(program, "pool").fetch(pool)) as { totalAssets: BN; reserved: BN; policyCount: BN; lockupSeconds: BN };
}

async function buy(user: Keypair, productId: number, payout: number, expiry: number, thresholdBps: number): Promise<number> {
  const id = (await poolState()).policyCount.toNumber();
  await program.methods
    .buyPolicy({ productId, payout: tokens(payout), expiry: new BN(expiry), thresholdBps })
    .accounts({
      holder: user.publicKey,
      pool,
      product: productAddress(productId),
      policy: policyAddress(id),
      priceUpdate: SOL_FEED,
      holderAta: getAssociatedTokenAddressSync(mint, user.publicKey),
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([user])
    .rpc();
  return id;
}

async function settle(payer: Keypair, policyId: number, productId: number, holder: PublicKey): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await program.methods
        .settlePrice()
        .accounts({
          payer: payer.publicKey,
          pool,
          product: productAddress(productId),
          policy: policyAddress(policyId),
          priceUpdate: SOL_FEED,
          vault,
          holderAta: getAssociatedTokenAddressSync(mint, holder),
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([payer])
        .rpc();
      return;
    } catch (error) {
      // The feed may not have published since the cover ended yet: retry for a short while.
      if (attempt >= 6 || !String(error).includes("PriceOutsideWindow")) throw error;
      await sleep(4_000);
    }
  }
}

const statusOf = async (id: number) =>
  Object.keys(((await reader(program, "policy").fetch(policyAddress(id))) as { status: object }).status)[0];

async function withdraw(user: Keypair, shares: BN): Promise<void> {
  await program.methods
    .withdraw(shares)
    .accounts({ owner: user.publicKey, pool, ownerAta: getAssociatedTokenAddressSync(mint, user.publicKey), mint, tokenProgram: TOKEN_PROGRAM_ID })
    .signers([user])
    .rpc();
}

/** Right after depositing, a provider cannot leave: the program refuses the withdrawal. */
async function checkWithdrawRefused(user: Keypair): Promise<void> {
  let refused = false;
  try {
    await withdraw(user, new BN(1));
  } catch (error) {
    refused = String(error).includes("LiquidityLocked");
  }
  assertEqual("withdrawing right after the deposit is refused (LiquidityLocked)", refused, true);
}

/** The lock ends exactly at `unlock_at` (checked here only when the lock is short enough to wait for). */
async function checkLockupEnds(user: Keypair): Promise<void> {
  console.log("Lock-up of the provider's deposit:");
  const pdas = PublicKey.findProgramAddressSync([Buffer.from("lp"), pool.toBuffer(), user.publicKey.toBuffer()], program.programId)[0];
  const position = (await reader(program, "lpPosition").fetch(pdas)) as { shares: BN; unlockAt: BN };
  const lockup = (await poolState()).lockupSeconds.toNumber();
  if (lockup > 120) {
    console.log(`  (lock-up is ${lockup} s, not waiting for it to end)`);
    return;
  }
  while ((await clusterTime()) < position.unlockAt.toNumber() + 2) await sleep(2_000);
  const before = await tokenBalance(user.publicKey);
  await withdraw(user, position.shares);
  assertEqual("after the lock ends the whole position can be withdrawn", (await tokenBalance(user.publicKey)) > before, true);
}

async function main(): Promise<void> {
  console.log(`cluster ${cluster}, program ${program.programId.toBase58()}`);
  const user = Keypair.generate();
  await connection
    .sendTransaction(
      new Transaction().add(SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: user.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL })),
      [admin],
    )
    .then((sig) => connection.confirmTransaction(sig, "confirmed"));

  // The pool persists between runs on a real cluster, so every pool assertion is relative to this starting point.
  const base = await poolState();
  await program.methods.faucet(tokens(5000)).accounts({ user: user.publicKey, mint, tokenProgram: TOKEN_PROGRAM_ID }).signers([user]).rpc();
  await program.methods
    .deposit(tokens(1000))
    .accounts({ owner: user.publicKey, pool, ownerAta: getAssociatedTokenAddressSync(mint, user.publicKey), mint, tokenProgram: TOKEN_PROGRAM_ID })
    .signers([user])
    .rpc();
  await checkWithdrawRefused(user);

  const price = decodePriceUpdate((await connection.getAccountInfo(SOL_FEED))!.data);
  console.log(`SOL/USD on ${cluster} now: ${price.price} (fully verified: ${price.fullyVerified})`);

  const expiry = (await clusterTime()) + EVENT_IN_SECONDS;
  // Threshold 0: a "down" and an "up" cover on the same price. Exactly one pays (both only if the price did not move at all).
  const down = await buy(user, 0, 100, expiry, 0);
  const up = await buy(user, 1, 100, expiry, 0);
  // A 50% drop in the next seconds does not happen: this cover expires and its premium stays with the pool.
  const crash = await buy(user, 0, 100, expiry, 5000);

  console.log("After buying (premiums 5 + 5 + 5):");
  const bought = await poolState();
  assertEqual("pool total assets", bought.totalAssets.sub(base.totalAssets).toString(), tokens(1015).toString());
  assertEqual("pool reserved", bought.reserved.sub(base.reserved).toString(), tokens(300).toString());
  assertEqual("user balance", await tokenBalance(user.publicKey), BigInt(tokens(3985).toString()));
  const stored = (await reader(program, "policy").fetch(policyAddress(crash))) as { referencePrice: BN; strike: BN };
  assertEqual("strike = reference price - 50%", stored.strike.toString(), stored.referencePrice.div(new BN(2)).toString());

  console.log(`Waiting for the covers to end (about ${EVENT_IN_SECONDS + 8} s)...`);
  while ((await clusterTime()) < expiry + 6) await sleep(2_000);

  if (process.env.KEEPER) {
    // `npm run keeper` is running in another terminal: nobody settles here, the bot has to do it.
    console.log("Letting the keeper bot settle...");
    for (let i = 0; i < 40 && (await Promise.all([down, up, crash].map(statusOf))).includes("active"); i++) await sleep(3_000);
  } else {
    await settle(user, down, 0, user.publicKey);
    await settle(user, up, 1, user.publicKey);
    await settle(user, crash, 0, user.publicKey);
  }

  console.log("After settlement:");
  const statuses = [await statusOf(down), await statusOf(up)];
  const paid = statuses.filter((s) => s === "paidOut").length;
  console.log(`  down: ${statuses[0]}, up: ${statuses[1]}`);
  assertEqual("at least one of the two threshold-0 covers paid out", paid >= 1, true);
  assertEqual("50% crash cover", await statusOf(crash), "expired");
  assertEqual("user balance", await tokenBalance(user.publicKey), BigInt(tokens(3985 + 100 * paid).toString()));
  const end = await poolState();
  assertEqual("pool total assets", end.totalAssets.sub(base.totalAssets).toString(), tokens(1015 - 100 * paid).toString());
  assertEqual("pool reserved", end.reserved.sub(base.reserved).toString(), "0");
  await checkLockupEnds(user);
  console.log("\nEVERYTHING WORKS on", cluster);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
