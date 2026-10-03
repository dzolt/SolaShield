// Local stand-in for the Pyth SOL/USD price account on a surfnet started with `--offline`.
// It writes a fully verified `PriceUpdateV2` account (same layout and owner as Pyth's) and refreshes it every few
// seconds, so the program reads it exactly like the real feed. The price can be changed while it runs:
//   echo 130 > keys/local-price.txt
// This exists only for local testing: devnet has the real feed, and the program never knows the difference.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CLUSTER_URLS, KEYS_DIR } from "./lib/env.ts";
import { FEEDS, pushFeedAddress } from "./lib/pyth.ts";

const RECEIVER_PROGRAM = "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";
const PRICE_FILE = join(KEYS_DIR, "local-price.txt");
const REFRESH_MS = 5_000;
const EXPONENT = -8;
const ACCOUNT_SIZE = 134;
const LAMPORTS = 2_000_000;

const rpcUrl = process.env.RPC_URL ?? CLUSTER_URLS.localnet;
const address = pushFeedAddress(FEEDS["SOL/USD"]).toBase58();
let price = Number(process.env.START_PRICE ?? 120);

function currentPrice(): number {
  if (!existsSync(PRICE_FILE)) return price;
  const fromFile = Number(readFileSync(PRICE_FILE, "utf8").trim());
  if (Number.isFinite(fromFile) && fromFile > 0) price = fromFile;
  return price;
}

/** PriceUpdateV2: discriminator, write authority, verification level (Full), price message, posted slot. */
function encode(usd: number, now: number): Buffer {
  const data = Buffer.alloc(ACCOUNT_SIZE);
  let o = createHash("sha256").update("account:PriceUpdateV2").digest().subarray(0, 8).copy(data, 0);
  o += 32; // write authority (unused)
  data[o++] = 1; // VerificationLevel::Full
  Buffer.from(FEEDS["SOL/USD"], "hex").copy(data, o);
  o += 32;
  data.writeBigInt64LE(BigInt(Math.round(usd * 10 ** -EXPONENT)), o);
  o += 8;
  data.writeBigUInt64LE(10_000n, o); // confidence
  o += 8;
  data.writeInt32LE(EXPONENT, o);
  o += 4;
  data.writeBigInt64LE(BigInt(now), o); // publish time
  o += 8;
  data.writeBigInt64LE(BigInt(now - 1), o); // previous publish time
  return data;
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await response.json()) as { result?: unknown; error?: { message: string } };
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

/** The program compares publish times with the cluster clock, which on a local validator differs from the host's. */
async function chainTime(): Promise<number> {
  // "processed": the default (finalized) lags the clock programs see by many seconds.
  const slot = (await rpc("getSlot", [{ commitment: "processed" }])) as number;
  return ((await rpc("getBlockTime", [slot])) as number | null) ?? Math.floor(Date.now() / 1000);
}

async function publish(): Promise<void> {
  const usd = currentPrice();
  const now = await chainTime();
  await rpc("surfnet_setAccount", [address, { lamports: LAMPORTS, data: encode(usd, now).toString("hex"), owner: RECEIVER_PROGRAM, executable: false }]);
  console.log(`${new Date().toISOString()} SOL/USD = ${usd}`);
}

await publish();
setInterval(() => void publish().catch((error) => console.error(String(error))), REFRESH_MS);
