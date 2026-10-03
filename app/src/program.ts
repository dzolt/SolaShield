import * as anchor from "@anchor-lang/core";
import BN from "bn.js";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { idl, RPC_URL } from "./config";

export const connection = new Connection(RPC_URL, "confirmed");

/** Wallet shape Anchor needs; the wallet adapter's `useAnchorWallet()` returns a compatible object. */
export type SigningWallet = ConstructorParameters<typeof anchor.AnchorProvider>[1];

const readOnlyWallet: SigningWallet = {
  publicKey: PublicKey.default,
  signTransaction: <T extends Transaction | VersionedTransaction>(): Promise<T> => Promise.reject(new Error("Połącz portfel")),
  signAllTransactions: <T extends Transaction | VersionedTransaction>(): Promise<T[]> => Promise.reject(new Error("Połącz portfel")),
};

export function makeProgram(wallet: SigningWallet | undefined): anchor.Program {
  const provider = new anchor.AnchorProvider(connection, wallet ?? readOnlyWallet, { commitment: "confirmed" });
  return new anchor.Program(idl as anchor.Idl, provider);
}

export { BN };

/**
 * The program judges every deadline by the cluster's clock, which can differ from this computer's by many seconds
 * (and does on a local validator). The UI therefore reads time from the chain too.
 */
export async function chainNow(): Promise<number> {
  const time = await connection.getBlockTime(await connection.getSlot());
  return time ?? Math.floor(Date.now() / 1000);
}
