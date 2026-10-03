use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::InsuranceError;
use crate::state::{Policy, PolicyStatus, Pool};
use crate::token_utils::transfer_from_vault;

#[derive(Accounts)]
pub struct VoidPolicy<'info> {
    pub payer: Signer<'info>,

    #[account(mut, has_one = mint)]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        mut,
        has_one = pool,
        seeds = [POLICY_SEED, pool.key().as_ref(), &policy.id.to_le_bytes()],
        bump = policy.bump
    )]
    pub policy: Box<Account<'info, Policy>>,

    #[account(mut, seeds = [VAULT_SEED, pool.key().as_ref()], bump, token::mint = mint, token::authority = pool)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut, token::mint = mint, token::authority = policy.holder)]
    pub holder_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// If nobody settled a policy a week after its event, anyone can void it and refund the premium to the holder.
/// This is the answer to "what if the data never arrives": the funds are never stuck.
pub fn handle_void_policy(ctx: Context<VoidPolicy>) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    require!(policy.status == PolicyStatus::Active, InsuranceError::PolicyNotActive);
    let void_at = policy.expiry.checked_add(VOID_AFTER).ok_or(InsuranceError::MathOverflow)?;
    require!(Clock::get()?.unix_timestamp >= void_at, InsuranceError::TooEarlyToVoid);

    let pool = &mut ctx.accounts.pool;
    pool.reserved = pool.reserved.checked_sub(policy.payout).ok_or(InsuranceError::MathOverflow)?;
    pool.total_assets = pool.total_assets.checked_sub(policy.premium).ok_or(InsuranceError::MathOverflow)?;
    policy.status = PolicyStatus::Voided;

    transfer_from_vault(
        pool,
        &ctx.accounts.vault,
        &ctx.accounts.holder_ata,
        &ctx.accounts.mint,
        &ctx.accounts.token_program,
        policy.premium,
    )
}
