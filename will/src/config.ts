import { PublicKey } from "@solana/web3.js";
import deployment from "./generated/deployment.json";
import faucetIdl from "./generated/faucet.json";
import idl from "./generated/will_vault.json";

/** Written by `npm run will:setup` (scripts/will-setup.ts), together with the IDL copies next to it. */
export { deployment, faucetIdl, idl };

export const IS_DEVNET = deployment.cluster === "devnet";

export const RPC_URL: string = IS_DEVNET
  ? ((import.meta.env.VITE_RPC_URL as string | undefined) ?? "https://api.devnet.solana.com")
  : "http://127.0.0.1:8899";

export const PROGRAM_ID = new PublicKey(deployment.programId);
export const MINT = new PublicKey(deployment.mint);

export const TOKEN_DECIMALS = 6;
export const POLL_MS = 4_000;
export const FAUCET_TOKENS = 1_000;

/** Mirrors the program's constants (programs/will_vault/src/constants.rs). */
export const TOTAL_BPS = 10_000;
export const MAX_BENEFICIARIES = 10;
export const MAX_VETOES = 2;

const clusterQuery = IS_DEVNET ? "devnet" : `custom&customUrl=${encodeURIComponent(RPC_URL)}`;
export const explorerTx = (signature: string): string => `https://explorer.solana.com/tx/${signature}?cluster=${clusterQuery}`;
export const explorerAddress = (address: string): string => `https://explorer.solana.com/address/${address}?cluster=${clusterQuery}`;
