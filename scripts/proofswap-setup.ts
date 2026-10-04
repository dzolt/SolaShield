// One-time (idempotent) setup of ProofSwap on a cluster: attestor key, config, and the files the web app imports.
import * as anchor from "@anchor-lang/core";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { clusterFromEnv, KEYS_DIR, loadKeypair, loadOrCreateKeypair, readDeployment, ROOT, rpcUrl } from "./lib/env.ts";

// Demo-friendly defaults. On mainnet the protection period must be at least Steam's 7 days.
const DELIVERY_WINDOW = Number(process.env.DELIVERY_WINDOW ?? 600);
const PROTECTION_PERIOD = Number(process.env.PROTECTION ?? 120);
const GRACE_PERIOD = Number(process.env.GRACE ?? 30);

type Decoded = Record<string, any>;

export interface ProofSwapDeployment {
  readonly cluster: string;
  readonly programId: string;
  readonly config: string;
  readonly mint: string;
  readonly attestor: string;
  readonly deliveryWindow: number;
  readonly protectionPeriod: number;
  readonly gracePeriod: number;
  /** Program with the open tUSDC faucet (the SolaShield deployment). */
  readonly faucetProgramId: string;
}

export function proofswapDeploymentFile(cluster: string): string {
  return join(ROOT, `proofswap.${cluster}.json`);
}

async function main(): Promise<void> {
  const cluster = clusterFromEnv();
  const connection = new Connection(rpcUrl(cluster), "confirmed");
  const admin = loadKeypair(join(KEYS_DIR, "deployer.json"));
  const attestor = loadOrCreateKeypair(join(KEYS_DIR, "attestor.json"));
  const idlPath = join(ROOT, "target", "idl", "proofswap.json");
  const program = new anchor.Program(
    JSON.parse(readFileSync(idlPath, "utf8")) as anchor.Idl,
    new anchor.AnchorProvider(connection, new anchor.Wallet(admin), { commitment: "confirmed" }),
  );
  if (!(await connection.getAccountInfo(program.programId))) throw new Error("ProofSwap is not deployed on this cluster yet.");

  // Payments use the existing test token and its open faucet.
  const tusdc = readDeployment(cluster);
  const mint = new PublicKey(tusdc.mint);
  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
  if (!(await connection.getAccountInfo(config))) {
    await program.methods
      .initConfig({
        attestor: attestor.publicKey,
        deliveryWindow: new BN(DELIVERY_WINDOW),
        protectionPeriod: new BN(PROTECTION_PERIOD),
        gracePeriod: new BN(GRACE_PERIOD),
      })
      .accounts({ admin: admin.publicKey, mint })
      .rpc();
    console.log(`config created: delivery ${DELIVERY_WINDOW}s, protection ${PROTECTION_PERIOD}s, grace ${GRACE_PERIOD}s`);
  }

  const accounts = program.account as unknown as Record<string, { fetch(a: PublicKey): Promise<Decoded> }>;
  const raw = await accounts.config.fetch(config);
  if (!raw.attestor.equals(attestor.publicKey)) {
    console.warn(`WARNING: the config trusts attestor ${raw.attestor.toBase58()}, but keys/attestor.json is ${attestor.publicKey.toBase58()}`);
  }
  const deployment: ProofSwapDeployment = {
    cluster,
    programId: program.programId.toBase58(),
    config: config.toBase58(),
    mint: mint.toBase58(),
    attestor: raw.attestor.toBase58(),
    deliveryWindow: raw.deliveryWindow.toNumber(),
    protectionPeriod: raw.protectionPeriod.toNumber(),
    gracePeriod: raw.gracePeriod.toNumber(),
    faucetProgramId: tusdc.programId,
  };
  writeFileSync(proofswapDeploymentFile(cluster), `${JSON.stringify(deployment, null, 2)}\n`);

  const generated = join(ROOT, "market", "src", "generated");
  mkdirSync(generated, { recursive: true });
  copyFileSync(idlPath, join(generated, "proofswap.json"));
  copyFileSync(join(ROOT, "target", "idl", "micro_insurance.json"), join(generated, "faucet.json"));
  copyFileSync(proofswapDeploymentFile(cluster), join(generated, "deployment.json"));
  console.log(`wrote ${proofswapDeploymentFile(cluster)} and copied the IDLs to ${generated}`);
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
