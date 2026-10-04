import { PublicKey } from "@solana/web3.js";
import deployment from "./generated/deployment.json";
import faucetIdl from "./generated/faucet.json";
import idl from "./generated/proofswap.json";

/** Written by `npm run ps:setup` (scripts/proofswap-setup.ts), together with the IDL copies next to it. */
export { deployment, faucetIdl, idl };

export const IS_DEVNET = deployment.cluster === "devnet";

/** VITE_RPC_URL may be a path such as "/rpc" (a reverse proxy on the same origin keeps the provider key off the page). */
const rpcFromEnv = import.meta.env.VITE_RPC_URL as string | undefined;

export const RPC_URL: string = IS_DEVNET
  ? (rpcFromEnv ? new URL(rpcFromEnv, window.location.origin).toString() : "https://api.devnet.solana.com")
  : "http://127.0.0.1:8899";

/**
 * Deals created before this unix time are hidden. Accounts on a chain cannot be deleted, so this is how a clean market
 * is shown after test runs; the old deals stay visible in the Explorer. The default hides the development test runs
 * (a clone gets a clean market); VITE_MARKET_SINCE overrides it, and 0 shows everything. Not needed after a fresh deployment.
 */
const DEFAULT_MARKET_SINCE = 1791101452;
export const MARKET_SINCE = Number((import.meta.env.VITE_MARKET_SINCE as string | undefined) ?? DEFAULT_MARKET_SINCE);

/** The attestor reads Steam and signs what it saw (npm run attestor). */
export const ATTESTOR_URL: string = (import.meta.env.VITE_ATTESTOR_URL as string | undefined) ?? "http://localhost:8787";

export const PROGRAM_ID = new PublicKey(deployment.programId);
export const CONFIG = new PublicKey(deployment.config);
export const MINT = new PublicKey(deployment.mint);
export const ATTESTOR_KEY = new PublicKey(deployment.attestor);

export const TOKEN_DECIMALS = 6;
export const POLL_MS = 4_000;
export const FAUCET_TOKENS = 1_000;

/** Demo Steam accounts served by the attestor's simulator (attestor/fixtures/sim-accounts.json). */
export const DEMO_SELLER_STEAM = "76561198000000101";
export const DEMO_BUYER_STEAM = "76561198000000202";

export const steamImage = (icon: string): string => `https://community.cloudflare.steamstatic.com/economy/image/${icon}/128fx128f`;

const clusterQuery = IS_DEVNET ? "devnet" : `custom&customUrl=${encodeURIComponent(RPC_URL)}`;
export const explorerTx = (signature: string): string => `https://explorer.solana.com/tx/${signature}?cluster=${clusterQuery}`;
export const explorerAddress = (address: string): string => `https://explorer.solana.com/address/${address}?cluster=${clusterQuery}`;
