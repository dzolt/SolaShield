import type * as anchor from "@anchor-lang/core";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { reader } from "../../scripts/lib/accounts";
import { pushFeedAddress } from "../../scripts/lib/pyth";
import { FAUCET_TOKENS, MINT, POOL, TOKEN_DECIMALS } from "./config";
import type { PolicyView, ProductView, Snapshot } from "./data";
import { formatUsdc, parseUsdc } from "./format";
import { policyAddress, productAddress } from "./pda";
import { BN, chainNow, connection } from "./program";

export interface ActionContext {
  readonly program: anchor.Program;
  readonly owner: PublicKey;
}

export interface ActionResult {
  readonly message: string;
  readonly signature?: string;
}

const ata = (owner: PublicKey): PublicKey => getAssociatedTokenAddressSync(MINT, owner);

export async function claimFaucet({ program, owner }: ActionContext): Promise<ActionResult> {
  const amount = new BN(FAUCET_TOKENS).mul(new BN(10).pow(new BN(TOKEN_DECIMALS)));
  const signature = await program.methods
    .faucet(amount)
    .accounts({ user: owner, mint: MINT, tokenProgram: TOKEN_PROGRAM_ID })
    .rpc();
  return { message: `Odebrano ${FAUCET_TOKENS} testowych tUSDC.`, signature };
}

export async function depositLiquidity({ program, owner }: ActionContext, amountText: string): Promise<ActionResult> {
  const amount = parseUsdc(amountText);
  const signature = await program.methods
    .deposit(new BN(amount.toString()))
    .accounts({ owner, pool: POOL, ownerAta: ata(owner), mint: MINT, tokenProgram: TOKEN_PROGRAM_ID })
    .rpc();
  return { message: `Wpłata do puli: ${formatUsdc(amount)}.`, signature };
}

/** Converts a token amount into pool shares at the current share price and withdraws them. */
export async function withdrawLiquidity(
  { program, owner }: ActionContext,
  amountText: string,
  snapshot: Snapshot,
): Promise<ActionResult> {
  const amount = parseUsdc(amountText);
  const { pool, wallet } = snapshot;
  if (pool.totalAssets === 0n) throw new Error("Pula jest pusta.");
  const wanted = (amount * pool.totalShares) / pool.totalAssets;
  const shares = wallet && wanted > wallet.shares ? wallet.shares : wanted;
  const signature = await program.methods
    .withdraw(new BN(shares.toString()))
    .accounts({ owner, pool: POOL, ownerAta: ata(owner), mint: MINT, tokenProgram: TOKEN_PROGRAM_ID })
    .rpc();
  return { message: `Wypłata z puli: ok. ${formatUsdc(amount)}.`, signature };
}

export interface CoverOrder {
  readonly product: ProductView;
  readonly payoutText: string;
  readonly startsInSeconds: number;
  /** Protected move in percent (15 = the cover pays after a 15% move). */
  readonly thresholdPercent: number;
}

/** The program reads the reference price from Pyth itself; the buyer only chooses the size of the protected move. */
export async function buyCover({ program, owner }: ActionContext, order: CoverOrder): Promise<ActionResult> {
  // Checked on the chain, not in the snapshot: right after the faucet the snapshot is still a few seconds old.
  const tokenAccount = await connection.getTokenAccountBalance(ata(owner)).catch(() => undefined);
  if (!tokenAccount) throw new Error("Najpierw odbierz testowe tUSDC (faucet).");
  if (!Number.isFinite(order.thresholdPercent) || order.thresholdPercent < 0 || order.thresholdPercent > 90) {
    throw new Error("Próg ochrony musi być między 0% a 90%.");
  }
  const payout = parseUsdc(order.payoutText);
  // The new cover's address depends on the pool's counter: read it now, the snapshot may be a few seconds old.
  const id = ((await reader(program, "pool").fetch(POOL)) as { policyCount: BN }).policyCount.toNumber();
  const signature = await program.methods
    .buyPolicy({
      productId: order.product.id,
      payout: new BN(payout.toString()),
      expiry: new BN((await chainNow()) + order.startsInSeconds),
      thresholdBps: Math.round(order.thresholdPercent * 100),
    })
    .accounts({
      holder: owner,
      pool: POOL,
      product: productAddress(order.product.id),
      policy: policyAddress(id),
      priceUpdate: pushFeedAddress(order.product.feedHex),
      holderAta: ata(owner),
      mint: MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  const premium = (payout * BigInt(order.product.premiumBps)) / 10_000n;
  return { message: `Kupiono ochronę #${id}: składka ${formatUsdc(premium)}, możliwa wypłata ${formatUsdc(payout)}.`, signature };
}

/** Anyone can call this: the program reads the Pyth price account itself and decides alone. */
export async function settleCover({ program, owner }: ActionContext, policy: PolicyView, product: ProductView): Promise<ActionResult> {
  const signature = await program.methods
    .settlePrice()
    .accounts({
      payer: owner,
      pool: POOL,
      product: productAddress(product.id),
      policy: policy.address,
      priceUpdate: pushFeedAddress(product.feedHex),
      holderAta: ata(policy.holder),
      mint: MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  return { message: `Ochrona #${policy.id} rozliczona przez program na podstawie ceny Pytha.`, signature };
}

export async function voidCover({ program, owner }: ActionContext, policy: PolicyView): Promise<ActionResult> {
  const signature = await program.methods
    .voidPolicy()
    .accounts({ payer: owner, pool: POOL, policy: policy.address, holderAta: ata(policy.holder), mint: MINT, tokenProgram: TOKEN_PROGRAM_ID })
    .rpc();
  return { message: `Ochrona #${policy.id} unieważniona, składka wróciła do właściciela.`, signature };
}
