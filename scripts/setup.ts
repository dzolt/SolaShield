// One-time (idempotent) setup of a cluster: the test token (tUSDC), the cover pool and its products.
// Writes deployment.<cluster>.json and copies it, with the IDL, into the web app.
import { createMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { reader } from "./lib/accounts.ts";
import {
  clusterFromEnv,
  deploymentFile,
  idlPath,
  KEYS_DIR,
  loadKeypair,
  loadOrCreateKeypair,
  makeProgram,
  ROOT,
  rpcUrl,
  type Deployment,
} from "./lib/env.ts";
import { FEEDS, feedIdBytes } from "./lib/pyth.ts";

const TOKEN_DECIMALS = 6;
/** How long a provider's deposit stays locked (chosen once, at pool creation). 10 minutes keeps the live demo short. */
const LOCKUP_SECONDS = Number(process.env.LOCKUP_SECONDS ?? 600);

interface ProductSpec {
  readonly name: string;
  readonly trigger: "priceBelow" | "priceAbove";
  readonly feed: keyof typeof FEEDS;
  readonly premiumBps: number;
  /** Seconds before the end of a cover that it must be bought. 0 keeps the live demo short (see README). */
  readonly minLeadTime: number;
}

// Order defines the product ids. The web app reads the products from the chain, so it needs no copy of this list.
const PRODUCTS: readonly ProductSpec[] = [
  { name: "SOL/USD: ochrona przed spadkiem ceny", trigger: "priceBelow", feed: "SOL/USD", premiumBps: 500, minLeadTime: 0 },
  { name: "SOL/USD: ochrona przed wzrostem ceny", trigger: "priceAbove", feed: "SOL/USD", premiumBps: 500, minLeadTime: 0 },
];

function productArgs(spec: ProductSpec) {
  return {
    name: spec.name,
    trigger: { [spec.trigger]: {} },
    feedId: feedIdBytes(FEEDS[spec.feed]),
    premiumBps: spec.premiumBps,
    minLeadTime: new BN(spec.minLeadTime),
  };
}

async function main(): Promise<void> {
  const cluster = clusterFromEnv();
  const connection = new Connection(rpcUrl(cluster), "confirmed");
  const admin = loadKeypair(join(KEYS_DIR, "deployer.json"));
  const program = makeProgram(connection, admin);
  const programId = program.programId;
  console.log(`cluster ${cluster}, program ${programId.toBase58()}, admin ${admin.publicKey.toBase58()}`);
  console.log(`admin balance ${(await connection.getBalance(admin.publicKey)) / LAMPORTS_PER_SOL} SOL`);

  if (!(await connection.getAccountInfo(programId))) throw new Error("The program is not deployed on this cluster yet.");

  const mintKeypair = loadOrCreateKeypair(join(KEYS_DIR, `tusdc-mint.${cluster}.json`));
  const [mintAuthority] = PublicKey.findProgramAddressSync([Buffer.from("mint-authority")], programId);
  if (!(await connection.getAccountInfo(mintKeypair.publicKey))) {
    await createMint(connection, admin, mintAuthority, null, TOKEN_DECIMALS, mintKeypair);
    console.log(`created tUSDC mint ${mintKeypair.publicKey.toBase58()} (mint authority: program PDA)`);
  }

  const [pool] = PublicKey.findProgramAddressSync([Buffer.from("pool"), mintKeypair.publicKey.toBuffer()], programId);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), pool.toBuffer()], programId);
  if (!(await connection.getAccountInfo(pool))) {
    await program.methods
      .initializePool(new BN(LOCKUP_SECONDS))
      .accounts({ admin: admin.publicKey, mint: mintKeypair.publicKey, tokenProgram: TOKEN_PROGRAM_ID })
      .rpc();
    console.log(`initialized pool ${pool.toBase58()} (deposits locked for ${LOCKUP_SECONDS} s)`);
  }

  const { productCount } = (await reader(program, "pool").fetch(pool)) as { productCount: number };
  for (let id = productCount; id < PRODUCTS.length; id++) {
    await program.methods.addProduct(productArgs(PRODUCTS[id])).accounts({ admin: admin.publicKey, pool }).rpc();
    console.log(`added product #${id}: ${PRODUCTS[id].name}`);
  }

  const deployment: Deployment = {
    cluster,
    programId: programId.toBase58(),
    mint: mintKeypair.publicKey.toBase58(),
    pool: pool.toBase58(),
    vault: vault.toBase58(),
    admin: admin.publicKey.toBase58(),
    lockupSeconds: ((await reader(program, "pool").fetch(pool)) as { lockupSeconds: BN }).lockupSeconds.toNumber(),
    products: PRODUCTS.map((p, id) => ({ id, name: p.name, trigger: p.trigger })),
  };
  writeFileSync(deploymentFile(cluster), `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(`wrote ${deploymentFile(cluster)}`);

  // The web app imports these two files (it must not depend on build output or key files).
  const generated = join(ROOT, "app", "src", "generated");
  mkdirSync(generated, { recursive: true });
  copyFileSync(idlPath(), join(generated, "micro_insurance.json"));
  copyFileSync(deploymentFile(cluster), join(generated, "deployment.json"));
  console.log(`copied the IDL and the deployment to ${generated}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
