use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel};

use crate::constants::*;
use crate::error::InsuranceError;
use crate::math::price_triggers;
use crate::state::{Policy, Pool, Product};
use crate::token_utils::settle_policy;

#[derive(Accounts)]
pub struct SettlePrice<'info> {
    /// Anyone may settle: the outcome depends only on the Pyth price, never on who calls.
    pub payer: Signer<'info>,

    #[account(mut, has_one = mint)]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        seeds = [PRODUCT_SEED, pool.key().as_ref(), &policy.product_id.to_le_bytes()],
        bump = product.bump
    )]
    pub product: Box<Account<'info, Product>>,

    #[account(
        mut,
        has_one = pool,
        seeds = [POLICY_SEED, pool.key().as_ref(), &policy.id.to_le_bytes()],
        bump = policy.bump
    )]
    pub policy: Box<Account<'info, Policy>>,

    /// A price update account posted by the Pyth receiver (the caller posts it in the same transaction).
    pub price_update: Box<Account<'info, PriceUpdateV2>>,

    #[account(mut, seeds = [VAULT_SEED, pool.key().as_ref()], bump, token::mint = mint, token::authority = pool)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The payout always goes to the policy holder's token account, whoever submits the transaction.
    #[account(mut, token::mint = mint, token::authority = policy.holder)]
    pub holder_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_settle_price(ctx: Context<SettlePrice>) -> Result<()> {
    let product = &ctx.accounts.product;
    let policy = &ctx.accounts.policy;
    let update = &ctx.accounts.price_update;
    require!(
        update.verification_level.gte(VerificationLevel::Full),
        InsuranceError::PriceNotVerified
    );
    // Age is checked against the policy's own window below, so no "newer than N seconds" check here.
    let price = update
        .get_price_unchecked(&product.feed_id)
        .map_err(|_| InsuranceError::WrongPriceFeed)?;

    let now = Clock::get()?.unix_timestamp;
    let window_end = policy.expiry.checked_add(OBSERVATION_WINDOW).ok_or(InsuranceError::MathOverflow)?;
    require!(
        price.publish_time >= policy.expiry && price.publish_time <= window_end && price.publish_time <= now,
        InsuranceError::PriceOutsideWindow
    );

    let triggered = price_triggers(product.trigger, price.price, price.exponent, policy.strike, policy.price_expo)?;
    let accounts = ctx.accounts;
    settle_policy(
        &mut accounts.pool,
        &mut accounts.policy,
        triggered,
        &accounts.vault,
        &accounts.holder_ata,
        &accounts.mint,
        &accounts.token_program,
    )
}
