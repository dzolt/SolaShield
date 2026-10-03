import { PublicKey } from "@solana/web3.js";

/** Pyth's sponsored "push" price feeds: price update accounts at fixed addresses, readable on-chain with no API key. */
export const PYTH_PUSH_PROGRAM = new PublicKey("pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT");
const SHARD_ID = 0;

export const FEEDS = {
  "SOL/USD": "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  "BTC/USD": "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
} as const;

export const feedIdBytes = (hex: string): number[] => [...Buffer.from(hex, "hex")];

export function pushFeedAddress(feedIdHex: string): PublicKey {
  const shard = Buffer.alloc(2);
  shard.writeUInt16LE(SHARD_ID);
  return PublicKey.findProgramAddressSync([shard, Buffer.from(feedIdHex, "hex")], PYTH_PUSH_PROGRAM)[0];
}

export interface PythPrice {
  readonly price: number;
  readonly exponent: number;
  readonly mantissa: bigint;
  readonly publishTime: number;
  readonly fullyVerified: boolean;
}

/** Decodes a `PriceUpdateV2` account (Anchor discriminator, write authority, verification level, price message). */
export function decodePriceUpdate(data: Uint8Array): PythPrice {
  const view = Buffer.from(data);
  let offset = 8 + 32;
  const fullyVerified = view[offset] === 1;
  offset += fullyVerified ? 1 : 2;
  offset += 32; // feed id
  const mantissa = view.readBigInt64LE(offset);
  offset += 16; // price + confidence
  const exponent = view.readInt32LE(offset);
  offset += 4;
  const publishTime = Number(view.readBigInt64LE(offset));
  return { price: Number(mantissa) * 10 ** exponent, exponent, mantissa, publishTime, fullyVerified };
}
