use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel};

use crate::constants::*;
use crate::error::InsuranceError;
use crate::math::{premium_for, strike_for};
use crate::state::{Policy, PolicyStatus, Pool, Product};
use crate::token_utils::transfer_to_vault;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BuyPolicyArgs {
    pub product_id: u32,
    pub payout: u64,
    /// When the cover ends and the price is read (unix seconds).
    pub expiry: i64,
    /// Protected move in basis points (1500 = 15%). The program turns it into a strike using the price it reads itself.
    pub threshold_bps: u16,
}

#[derive(Accounts)]
#[instruction(args: BuyPolicyArgs)]
pub struct BuyPolicy<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,

    #[account(mut, has_one = mint)]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        seeds = [PRODUCT_SEED, pool.key().as_ref(), &args.product_id.to_le_bytes()],
        bump = product.bump
    )]
    pub product: Box<Account<'info, Product>>,

    #[account(
        init,
        payer = holder,
        space = 8 + Policy::INIT_SPACE,
        seeds = [POLICY_SEED, pool.key().as_ref(), &pool.policy_count.to_le_bytes()],
        bump
    )]
    pub policy: Box<Account<'info, Policy>>,

    /// The Pyth price account of the product's feed. The program reads the reference price from it, not the buyer.
    pub price_update: Box<Account<'info, PriceUpdateV2>>,

    #[account(mut, seeds = [VAULT_SEED, pool.key().as_ref()], bump, token::mint = mint, token::authority = pool)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut, token::mint = mint, token::authority = holder)]
    pub holder_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_buy_policy(ctx: Context<BuyPolicy>, args: BuyPolicyArgs) -> Result<()> {
    require!(args.payout > 0, InsuranceError::ZeroAmount);
    require!(args.threshold_bps <= MAX_THRESHOLD_BPS, InsuranceError::InvalidThreshold);
    let product = &ctx.accounts.product;
    let clock = Clock::get()?;
    let earliest = clock.unix_timestamp.checked_add(product.min_lead_time).ok_or(InsuranceError::MathOverflow)?;
    require!(args.expiry >= earliest, InsuranceError::TooLateToInsure);

    // The reference price comes from Pyth, read here by the program: the buyer cannot choose or fake it.
    let update = &ctx.accounts.price_update;
    require!(update.verification_level.gte(VerificationLevel::Full), InsuranceError::PriceNotVerified);
    let reference = update
        .get_price_no_older_than(&clock, MAX_PRICE_AGE, &product.feed_id)
        .map_err(|_| InsuranceError::StalePrice)?;
    require!(reference.price > 0, InsuranceError::InvalidPrice);
    let strike = strike_for(product.trigger, reference.price, args.threshold_bps)?;

    let premium = premium_for(args.payout, product.premium_bps)?;
    require!(premium > 0, InsuranceError::ZeroAmount);

    // Solvency: the pool (including this premium) must be able to pay every active cover at once,
    // and no single cover may be a large share of it.
    let pool = &mut ctx.accounts.pool;
    let reserved = pool.reserved.checked_add(args.payout).ok_or(InsuranceError::MathOverflow)?;
    let capacity = pool.total_assets.checked_add(premium).ok_or(InsuranceError::MathOverflow)?;
    require!(reserved <= capacity, InsuranceError::InsufficientCapacity);
    require!(
        (args.payout as u128) * (BPS as u128) <= (MAX_COVER_SHARE_BPS as u128) * (capacity as u128),
        InsuranceError::CoverTooLarge
    );

    let policy = &mut ctx.accounts.policy;
    policy.pool = pool.key();
    policy.id = pool.policy_count;
    policy.holder = ctx.accounts.holder.key();
    policy.product_id = product.id;
    policy.payout = args.payout;
    policy.premium = premium;
    policy.expiry = args.expiry;
    policy.reference_price = reference.price;
    policy.price_expo = reference.exponent;
    policy.threshold_bps = args.threshold_bps;
    policy.strike = strike;
    policy.status = PolicyStatus::Active;
    policy.bump = ctx.bumps.policy;

    pool.total_assets = capacity;
    pool.reserved = reserved;
    pool.policy_count = pool.policy_count.checked_add(1).ok_or(InsuranceError::MathOverflow)?;

    transfer_to_vault(
        &ctx.accounts.holder_ata,
        &ctx.accounts.vault,
        &ctx.accounts.mint,
        &ctx.accounts.holder,
        &ctx.accounts.token_program,
        premium,
    )
}
