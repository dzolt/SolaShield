use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::InsuranceError;
use crate::state::Pool;

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = admin,
        space = 8 + Pool::INIT_SPACE,
        seeds = [POOL_SEED, mint.key().as_ref()],
        bump
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// The pool's only token account. Its authority is the pool PDA, so no key can move funds out of it.
    #[account(
        init,
        payer = admin,
        seeds = [VAULT_SEED, pool.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = pool,
        token::token_program = token_program
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_pool(ctx: Context<InitializePool>, lockup_seconds: i64) -> Result<()> {
    require!((0..=MAX_LOCKUP_SECONDS).contains(&lockup_seconds), InsuranceError::InvalidLockup);
    let pool = &mut ctx.accounts.pool;
    pool.admin = ctx.accounts.admin.key();
    pool.mint = ctx.accounts.mint.key();
    pool.total_assets = 0;
    pool.reserved = 0;
    pool.total_shares = 0;
    pool.lockup_seconds = lockup_seconds;
    pool.product_count = 0;
    pool.policy_count = 0;
    pool.bump = ctx.bumps.pool;
    Ok(())
}
