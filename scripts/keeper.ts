// Optional "keeper" bot: settles covers right after they end, so nobody has to watch the clock.
// It has NO special rights. `settle_price` is open to everybody and the program alone decides the outcome and where
// the money goes, so this bot is just another caller that pays a tiny transaction fee. If it stops, anyone else
// (the owner, a pool provider, another bot) can settle the same covers.
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { join } from "node:path";
import { reader } from "./lib/accounts.ts";
import { clusterFromEnv, KEYS_DIR, loadKeypair, makeProgram, readDeployment, rpcUrl } from "./lib/env.ts";
import { pushFeedAddress } from "./lib/pyth.ts";

const POLL_MS = Number(process.env.KEEPER_POLL_MS ?? 4_000);
/** Mirrors OBSERVATION_WINDOW in programs/micro_insurance/src/constants.rs. */
const OBSERVATION_WINDOW_SECONDS = 600;

const cluster = clusterFromEnv();
const deployment = readDeployment(cluster);
const connection = new Connection(rpcUrl(cluster), "confirmed");
const keeper = loadKeypair(process.env.KEEPER_KEY ?? join(KEYS_DIR, "deployer.json"));
const program = makeProgram(connection, keeper);
const pool = new PublicKey(deployment.pool);
const mint = new PublicKey(deployment.mint);
const vault = new PublicKey(deployment.vault);
const POOL_FILTER = [{ memcmp: { offset: 8, bytes: pool.toBase58() } }];

const productAddress = (id: number) =>
  PublicKey.findProgramAddressSync([Buffer.from("product"), pool.toBuffer(), new BN(id).toArrayLike(Buffer, "le", 4)], program.programId)[0];

async function chainTime(): Promise<number> {
  const time = await connection.getBlockTime(await connection.getSlot("confirmed"));
  return time ?? Math.floor(Date.now() / 1000);
}

const log = (message: string) => console.log(`${new Date().toISOString()} ${message}`);

async function settle(policy: PublicKey, account: Record<string, any>, feedHex: string): Promise<void> {
  try {
    const signature = await program.methods
      .settlePrice()
      .accounts({
        payer: keeper.publicKey,
        pool,
        product: productAddress(account.productId),
        policy,
        priceUpdate: pushFeedAddress(feedHex),
        vault,
        holderAta: getAssociatedTokenAddressSync(mint, account.holder),
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    const status = Object.keys(((await reader(program, "policy").fetch(policy)) as { status: object }).status)[0];
    log(`cover #${account.id} settled: ${status} (${signature.slice(0, 12)}…)`);
  } catch (error) {
    const code = (error as { error?: { errorCode?: { code?: string } } }).error?.errorCode?.code;
    // PriceOutsideWindow just means the feed has not published since the cover ended: try again on the next tick.
    if (code !== "PriceOutsideWindow") log(`cover #${account.id}: ${code ?? String(error).slice(0, 160)}`);
  }
}

async function tick(): Promise<void> {
  const [policies, products, now] = await Promise.all([
    reader(program, "policy").all(POOL_FILTER),
    reader(program, "product").all(POOL_FILTER),
    chainTime(),
  ]);
  const feedOf = new Map(products.map(({ account }) => [account.id as number, Buffer.from(account.feedId).toString("hex")]));
  for (const { publicKey, account } of policies) {
    if (!("active" in account.status)) continue;
    const expiry = (account.expiry as BN).toNumber();
    if (now < expiry) continue;
    if (now > expiry + OBSERVATION_WINDOW_SECONDS) continue; // window missed: only void_policy (after 7 days) is left
    const feed = feedOf.get(account.productId as number);
    if (feed) await settle(publicKey, account, feed);
  }
}

log(`keeper ${keeper.publicKey.toBase58()} watching ${cluster}, pool ${pool.toBase58()}`);
setInterval(() => void tick().catch((error) => log(`tick failed: ${String(error).slice(0, 160)}`)), POLL_MS);
void tick();
