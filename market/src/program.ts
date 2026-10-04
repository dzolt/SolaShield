import * as anchor from "@anchor-lang/core";
import BN from "bn.js";
import { Connection, PublicKey, SYSVAR_CLOCK_PUBKEY, Transaction, VersionedTransaction } from "@solana/web3.js";
import { faucetIdl, idl, RPC_URL } from "./config";
import { BlockhashExpiredError, recordSignDuration, setTxPhase } from "./txPhase";

const BLOCKHASH_RETRIES = 6;
const BLOCKHASH_RETRY_MS = 1_500;
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A load-balanced devnet RPC can hand out a blockhash on one node and run the pre-flight simulation on another that
 * has not seen it yet ("Blockhash not found"). Re-sending the same signed transaction fixes it without a second wallet prompt.
 */
class PatientConnection extends Connection {
  override async sendRawTransaction(...args: Parameters<Connection["sendRawTransaction"]>): Promise<string> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const signature = await super.sendRawTransaction(...args);
        setTxPhase("confirming");
        return signature;
      } catch (error) {
        const unseen = error instanceof Error && error.message.includes("Blockhash not found");
        if (!unseen) throw error;
        if (attempt >= BLOCKHASH_RETRIES) throw await this.blameExpiry(error, args[0]);
        await wait(BLOCKHASH_RETRY_MS);
      }
    }
  }

  /** Still unknown after the retries: either the blockhash really expired (a slow wallet popup) or the RPC is off. */
  private async blameExpiry(error: Error, raw: Parameters<Connection["sendRawTransaction"]>[0]): Promise<Error> {
    const { message } = VersionedTransaction.deserialize(Uint8Array.from(raw));
    const check = await this.isBlockhashValid(message.recentBlockhash, { commitment: "confirmed" }).catch(() => undefined);
    return check?.value === false ? new BlockhashExpiredError() : error;
  }
}

export const connection = new PatientConnection(RPC_URL, "confirmed");

/** Wallet shape Anchor needs; the wallet adapter's `useAnchorWallet()` returns a compatible object. */
export type SigningWallet = ConstructorParameters<typeof anchor.AnchorProvider>[1];

const readOnlyWallet: SigningWallet = {
  publicKey: PublicKey.default,
  signTransaction: <T extends Transaction | VersionedTransaction>(): Promise<T> => Promise.reject(new Error("Połącz portfel")),
  signAllTransactions: <T extends Transaction | VersionedTransaction>(): Promise<T[]> => Promise.reject(new Error("Połącz portfel")),
};

/** Reports the wallet popup as its own phase and remembers how long it took. */
function observed(wallet: SigningWallet): SigningWallet {
  const timed = async <T>(sign: () => Promise<T>): Promise<T> => {
    setTxPhase("signing");
    const started = Date.now();
    try {
      const signed = await sign();
      setTxPhase("sending");
      return signed;
    } finally {
      recordSignDuration(Date.now() - started);
    }
  };
  return {
    ...wallet,
    signTransaction: <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => timed(() => wallet.signTransaction(tx)),
    signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => timed(() => wallet.signAllTransactions(txs)),
  };
}

function provider(wallet: SigningWallet | undefined): anchor.AnchorProvider {
  return new anchor.AnchorProvider(connection, wallet ? observed(wallet) : readOnlyWallet, { commitment: "confirmed" });
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
