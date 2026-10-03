import type * as anchor from "@anchor-lang/core";
import type { PublicKey } from "@solana/web3.js";

type AccountName = "pool" | "product" | "policy" | "lpPosition";
// The IDL is loaded at runtime, so Anchor cannot name the account clients at compile time. Fields are decoded by the IDL.
type Decoded = Record<string, any>;

export interface AccountReader {
  fetch(address: PublicKey): Promise<Decoded>;
  fetchNullable(address: PublicKey): Promise<Decoded | null>;
  all(filters?: anchor.web3.GetProgramAccountsFilter[]): Promise<{ publicKey: PublicKey; account: Decoded }[]>;
}

export function reader(program: anchor.Program, name: AccountName): AccountReader {
  return (program.account as unknown as Record<AccountName, AccountReader>)[name];
}
