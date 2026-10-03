import * as anchor from "@anchor-lang/core";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const KEYS_DIR = join(ROOT, "keys");

export type Cluster = "devnet" | "localnet";

export const CLUSTER_URLS: Readonly<Record<Cluster, string>> = {
  devnet: "https://api.devnet.solana.com",
  localnet: "http://127.0.0.1:8899",
};

export function clusterFromEnv(): Cluster {
  const value = process.env.CLUSTER ?? "devnet";
  if (value !== "devnet" && value !== "localnet") throw new Error(`CLUSTER must be devnet or localnet, got "${value}"`);
  return value;
}

export function rpcUrl(cluster: Cluster): string {
  return process.env.RPC_URL ?? CLUSTER_URLS[cluster];
}

export function loadKeypair(file: string): Keypair {
  if (!existsSync(file)) throw new Error(`Missing key file ${file}`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(file, "utf8")) as number[]));
}

/** Loads a key file or creates it (mode 600). Key files live in keys/ and are git-ignored. */
export function loadOrCreateKeypair(file: string): Keypair {
  if (existsSync(file)) return loadKeypair(file);
  const keypair = Keypair.generate();
  writeFileSync(file, JSON.stringify([...keypair.secretKey]), { mode: 0o600 });
  return keypair;
}

export function idlPath(): string {
  return join(ROOT, "target", "idl", "micro_insurance.json");
}

export function loadIdl(): anchor.Idl {
  const file = idlPath();
  if (!existsSync(file)) throw new Error(`Missing IDL ${file}. Run \`anchor build\` first.`);
  return JSON.parse(readFileSync(file, "utf8")) as anchor.Idl;
}

export function makeProgram(connection: Connection, payer: Keypair): anchor.Program {
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(payer), { commitment: "confirmed" });
  return new anchor.Program(loadIdl(), provider);
}

export interface Deployment {
  readonly cluster: Cluster;
  readonly programId: string;
  readonly mint: string;
  readonly pool: string;
  readonly vault: string;
  readonly admin: string;
  readonly lockupSeconds: number;
  readonly products: readonly { readonly id: number; readonly name: string; readonly trigger: string }[];
}

export function deploymentFile(cluster: Cluster): string {
  return join(ROOT, `deployment.${cluster}.json`);
}

export function readDeployment(cluster: Cluster): Deployment {
  const file = deploymentFile(cluster);
  if (!existsSync(file)) throw new Error(`Missing ${file}. Run \`npm run setup\` first.`);
  return JSON.parse(readFileSync(file, "utf8")) as Deployment;
}

export const pubkey = (value: string): PublicKey => new PublicKey(value);
