import * as anchor from "@anchor-lang/core";
import BN from "bn.js";
import { Connection, PublicKey, SYSVAR_CLOCK_PUBKEY, Transaction, VersionedTransaction } from "@solana/web3.js";
import { faucetIdl, idl, RPC_URL } from "./config";

export const connection = new Connection(RPC_URL, "confirmed");

/** Wallet shape Anchor needs; the wallet adapter's `useAnchorWallet()` returns a compatible object. */
export type SigningWallet = ConstructorParameters<typeof anchor.AnchorProvider>[1];

const readOnlyWallet: SigningWallet = {
  publicKey: PublicKey.default,
  signTransaction: <T extends Transaction | VersionedTransaction>(): Promise<T> => Promise.reject(new Error("Połącz portfel")),
  signAllTransactions: <T extends Transaction | VersionedTransaction>(): Promise<T[]> => Promise.reject(new Error("Połącz portfel")),
};

function provider(wallet: SigningWallet | undefined): anchor.AnchorProvider {
  return new anchor.AnchorProvider(connection, wallet ?? readOnlyWallet, { commitment: "confirmed" });
}

export function makeProgram(wallet: SigningWallet | undefined): anchor.Program {
  return new anchor.Program(idl as anchor.Idl, provider(wallet));
}

/** The open tUSDC faucet lives in the SolaShield program. */
export function makeFaucet(wallet: SigningWallet): anchor.Program {
  return new anchor.Program(faucetIdl as anchor.Idl, provider(wallet));
}

export { BN };

/** The program's own clock (Clock sysvar, unix_timestamp at byte 32): deadlines are judged by it, not by this computer. */
export async function chainNow(): Promise<number> {
  const clock = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "processed");
  return clock ? Number(clock.data.readBigInt64LE(32)) : Math.floor(Date.now() / 1000);
}
