// One-time (idempotent) setup of the will vault on a cluster: config with the two periods, and the deployment file.
import * as anchor from "@anchor-lang/core";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { clusterFromEnv, KEYS_DIR, loadKeypair, readDeployment, ROOT, rpcUrl } from "./lib/env.ts";

// Demo-friendly defaults (seconds). In production: 90 days of inactivity, then a 30-day procedure.
const INACTIVITY_PERIOD = Number(process.env.INACTIVITY ?? 20);
const CLAIM_PERIOD = Number(process.env.CLAIM ?? 10);

type Decoded = Record<string, any>;

export interface WillDeployment {
  readonly cluster: string;
  readonly programId: string;
  readonly config: string;
  readonly mint: string;
  readonly inactivityPeriod: number;
  readonly claimPeriod: number;
  /** Program with the open tUSDC faucet (the SolaShield deployment). */
  readonly faucetProgramId: string;
}

export function willDeploymentFile(cluster: string): string {
  return join(ROOT, `will.${cluster}.json`);
}

async function main(): Promise<void> {
  const cluster = clusterFromEnv();
  const connection = new Connection(rpcUrl(cluster), "confirmed");
  const admin = loadKeypair(join(KEYS_DIR, "deployer.json"));
  const idlPath = join(ROOT, "target", "idl", "will_vault.json");
  const program = new anchor.Program(
    JSON.parse(readFileSync(idlPath, "utf8")) as anchor.Idl,
    new anchor.AnchorProvider(connection, new anchor.Wallet(admin), { commitment: "confirmed" }),
  );
  if (!(await connection.getAccountInfo(program.programId))) throw new Error("will_vault is not deployed on this cluster yet.");

  // Savings use the existing test token and its open faucet.
  const tusdc = readDeployment(cluster);
  const mint = new PublicKey(tusdc.mint);
  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
  if (!(await connection.getAccountInfo(config))) {
    await program.methods
      .initConfig({ inactivityPeriod: new BN(INACTIVITY_PERIOD), claimPeriod: new BN(CLAIM_PERIOD) })
      .accounts({ admin: admin.publicKey, mint })
      .rpc();
    console.log(`config created: inactivity ${INACTIVITY_PERIOD}s, claim period ${CLAIM_PERIOD}s`);
  }

  const accounts = program.account as unknown as Record<string, { fetch(a: PublicKey): Promise<Decoded> }>;
  const raw = await accounts.config.fetch(config);
  const deployment: WillDeployment = {
    cluster,
    programId: program.programId.toBase58(),
    config: config.toBase58(),
    mint: raw.mint.toBase58(),
    inactivityPeriod: raw.inactivityPeriod.toNumber(),
    claimPeriod: raw.claimPeriod.toNumber(),
    faucetProgramId: tusdc.programId,
  };
  writeFileSync(willDeploymentFile(cluster), `${JSON.stringify(deployment, null, 2)}\n`);

  // The web app (will/) imports these three files.
  const generated = join(ROOT, "will", "src", "generated");
  mkdirSync(generated, { recursive: true });
  copyFileSync(idlPath, join(generated, "will_vault.json"));
  copyFileSync(join(ROOT, "target", "idl", "micro_insurance.json"), join(generated, "faucet.json"));
  copyFileSync(willDeploymentFile(cluster), join(generated, "deployment.json"));
  console.log(`wrote ${willDeploymentFile(cluster)} and copied the IDLs to ${generated}`);
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
