use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::InsuranceError;
use crate::math::shares_for_deposit;
use crate::state::{LpPosition, Pool};
use crate::token_utils::transfer_to_vault;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, has_one = mint)]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + LpPosition::INIT_SPACE,
        seeds = [LP_SEED, pool.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub position: Box<Account<'info, LpPosition>>,

    #[account(mut, seeds = [VAULT_SEED, pool.key().as_ref()], bump, token::mint = mint, token::authority = pool)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut, token::mint = mint, token::authority = owner)]
    pub owner_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, InsuranceError::ZeroAmount);
    let pool = &mut ctx.accounts.pool;
    let shares = shares_for_deposit(amount, pool.total_assets, pool.total_shares)?;

    pool.total_assets = pool.total_assets.checked_add(amount).ok_or(InsuranceError::MathOverflow)?;
    pool.total_shares = pool.total_shares.checked_add(shares).ok_or(InsuranceError::MathOverflow)?;

    // The lock restarts for the whole position, so a provider cannot top up and then leave with the older money.
    let unlock_at = Clock::get()?
        .unix_timestamp
        .checked_add(pool.lockup_seconds)
        .ok_or(InsuranceError::MathOverflow)?;

    let position = &mut ctx.accounts.position;
    position.unlock_at = position.unlock_at.max(unlock_at);
    position.owner = ctx.accounts.owner.key();
    position.bump = ctx.bumps.position;
    position.shares = position.shares.checked_add(shares).ok_or(InsuranceError::MathOverflow)?;

    transfer_to_vault(
        &ctx.accounts.owner_ata,
        &ctx.accounts.vault,
        &ctx.accounts.mint,
        &ctx.accounts.owner,
        &ctx.accounts.token_program,
        amount,
    )
}
