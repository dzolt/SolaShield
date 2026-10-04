// Read-only view of the newest ProofSwap deals on a cluster: status, whether Steam confirmed the listing, parties.
import * as anchor from "@anchor-lang/core";
import { Connection, Keypair } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clusterFromEnv, ROOT, rpcUrl } from "./lib/env.ts";

const SHOWN = Number(process.env.DEALS ?? 8);

async function main(): Promise<void> {
  const connection = new Connection(rpcUrl(clusterFromEnv()), "confirmed");
  const idl = JSON.parse(readFileSync(join(ROOT, "target", "idl", "proofswap.json"), "utf8")) as anchor.Idl;
  const program = new anchor.Program(idl, new anchor.AnchorProvider(connection, new anchor.Wallet(Keypair.generate()), {}));
  const deals = await (program.account as unknown as Record<string, { all(): Promise<{ publicKey: anchor.web3.PublicKey; account: Record<string, any> }[]> }>).deal.all();
  deals.sort((a, b) => b.account.createdAt.toNumber() - a.account.createdAt.toNumber());
  for (const { publicKey, account } of deals.slice(0, SHOWN)) {
    const buyer = account.buyerSteamId.toString() === "0" ? "-" : account.buyer.toBase58().slice(0, 6);
    console.log(
      publicKey.toBase58().slice(0, 8),
      new Date(account.createdAt.toNumber() * 1000).toISOString(),
      `status=${Object.keys(account.status)[0]}`,
      `verified=${account.listingVerified}`,
      `seller=${account.seller.toBase58().slice(0, 6)}`,
      `buyer=${buyer}`,
      account.itemName,
    );
  }
  console.log(`total deals: ${deals.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
