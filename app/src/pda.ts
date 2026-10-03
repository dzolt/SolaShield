import { PublicKey } from "@solana/web3.js";
import { POOL, PROGRAM_ID } from "./config";
import { BN } from "./program";

export const policyAddress = (id: number): PublicKey =>
  PublicKey.findProgramAddressSync([Buffer.from("policy"), POOL.toBuffer(), new BN(id).toArrayLike(Buffer, "le", 8)], PROGRAM_ID)[0];

export const lpAddress = (owner: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync([Buffer.from("lp"), POOL.toBuffer(), owner.toBuffer()], PROGRAM_ID)[0];

export const productAddress = (id: number): PublicKey => {
  const index = Buffer.alloc(4);
  index.writeUInt32LE(id);
  return PublicKey.findProgramAddressSync([Buffer.from("product"), POOL.toBuffer(), index], PROGRAM_ID)[0];
};
