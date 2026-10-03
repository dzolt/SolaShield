import { PublicKey } from "@solana/web3.js";
import idl from "./generated/micro_insurance.json";
import deployment from "./generated/deployment.json";

/** Written by `npm run setup` (scripts/setup.ts), together with the IDL copy next to it. */
export { deployment, idl };

export const IS_DEVNET = deployment.cluster === "devnet";

export const RPC_URL: string =
  (import.meta.env.VITE_RPC_URL as string | undefined) ?? (IS_DEVNET ? "https://api.devnet.solana.com" : "http://127.0.0.1:8899");

export const POOL = new PublicKey(deployment.pool);
export const MINT = new PublicKey(deployment.mint);
export const VAULT = new PublicKey(deployment.vault);
export const PROGRAM_ID = new PublicKey(deployment.programId);

export const TOKEN_DECIMALS = 6;
export const POLL_MS = 4_000;
/** Mirrors the on-chain constants (programs/micro_insurance/src/constants.rs). */
export const VOID_AFTER_SECONDS = 7 * 24 * 3600;
export const OBSERVATION_WINDOW_SECONDS = 10 * 60;
export const FAUCET_TOKENS = 5_000;
export const MAX_COVER_SHARE = 0.2;

const clusterQuery = IS_DEVNET ? "devnet" : `custom&customUrl=${encodeURIComponent(RPC_URL)}`;
export const explorerTx = (signature: string): string => `https://explorer.solana.com/tx/${signature}?cluster=${clusterQuery}`;
export const explorerAddress = (address: string): string => `https://explorer.solana.com/address/${address}?cluster=${clusterQuery}`;
