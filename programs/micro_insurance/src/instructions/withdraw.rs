use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::InsuranceError;
use crate::math::assets_for_shares;
use crate::state::{LpPosition, Pool};
use crate::token_utils::transfer_from_vault;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, has_one = mint)]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        mut,
        seeds = [LP_SEED, pool.key().as_ref(), owner.key().as_ref()],
        bump = position.bump,
        has_one = owner
    )]
    pub position: Box<Account<'info, LpPosition>>,

    #[account(mut, seeds = [VAULT_SEED, pool.key().as_ref()], bump, token::mint = mint, token::authority = pool)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut, token::mint = mint, token::authority = owner)]
    pub owner_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// Burns shares for their share of the pool. Capital that backs active policies stays locked.
pub fn handle_withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
    require!(shares > 0, InsuranceError::ZeroAmount);
    let position = &mut ctx.accounts.position;
    require!(shares <= position.shares, InsuranceError::InsufficientShares);
    require!(Clock::get()?.unix_timestamp >= position.unlock_at, InsuranceError::LiquidityLocked);

    let pool = &mut ctx.accounts.pool;
    let amount = assets_for_shares(shares, pool.total_assets, pool.total_shares)?;
    require!(amount > 0, InsuranceError::ZeroAmount);
    let remaining_assets = pool.total_assets.checked_sub(amount).ok_or(InsuranceError::MathOverflow)?;
    require!(remaining_assets >= pool.reserved, InsuranceError::CapitalReserved);

    position.shares -= shares;
    pool.total_shares -= shares;
    pool.total_assets = remaining_assets;

    transfer_from_vault(
        pool,
        &ctx.accounts.vault,
        &ctx.accounts.owner_ata,
        &ctx.accounts.mint,
        &ctx.accounts.token_program,
        amount,
    )
}
