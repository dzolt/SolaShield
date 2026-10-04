use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::WillError;
use crate::instructions::owner_actions::record_owner_activity;
use crate::state::{Config, Will, WillStatus};
use crate::token_utils::{close_vault, pay_from_vault, pay_into_vault};

/// Money moved by the owner. Only the owner can pay in, so nobody else can keep the will alive with dust deposits.
#[derive(Accounts)]
pub struct OwnerFunds<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = mint)]
    pub config: Box<Account<'info, Config>>,

    #[account(
        mut,
        seeds = [WILL_SEED, owner.key().as_ref(), &will.id.to_le_bytes()],
        bump = will.bump,
        has_one = owner @ WillError::NotOwner
    )]
    pub will: Box<Account<'info, Will>>,

    #[account(mut, seeds = [VAULT_SEED, will.key().as_ref()], bump = will.vault_bump, token::mint = mint, token::authority = will)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut, token::mint = mint, token::authority = owner)]
    pub owner_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_deposit(ctx: Context<OwnerFunds>, amount: u64) -> Result<()> {
    require!(amount > 0, WillError::ZeroAmount);
    let a = ctx.accounts;
    record_owner_activity(&mut a.will)?;
    pay_into_vault(&a.owner_ata, &a.vault, &a.mint, &a.owner, &a.token_program, amount)
}

pub fn handle_withdraw(ctx: Context<OwnerFunds>, amount: u64) -> Result<()> {
    require!(amount > 0, WillError::ZeroAmount);
    let a = ctx.accounts;
    require!(a.vault.amount >= amount, WillError::InsufficientFunds);
    record_owner_activity(&mut a.will)?;
    pay_from_vault(&a.will, &a.vault, &a.owner_ata, &a.mint, &a.token_program, amount)
}

/// The owner calls the whole thing off: all money and all rent go back, both accounts are closed.
/// Allowed at any time before somebody triggers the payout.
pub fn handle_cancel_will(ctx: Context<OwnerFunds>) -> Result<()> {
    let a = ctx.accounts;
    require!(a.will.status == WillStatus::Active, WillError::WrongStatus);
    let balance = a.vault.amount;
    if balance > 0 {
        pay_from_vault(&a.will, &a.vault, &a.owner_ata, &a.mint, &a.token_program, balance)?;
    }
    close_vault(&a.will, &a.vault, &a.owner.to_account_info(), &a.token_program)?;
    a.will.close(a.owner.to_account_info())
}
