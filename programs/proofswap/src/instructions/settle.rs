use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::ProofSwapError;
use crate::state::{Config, Deal, DealStatus};
use crate::token_utils::pay_from_vault;

/// Settlements decided by time alone. Anyone may trigger them once the moment has come.
#[derive(Accounts)]
pub struct Settle<'info> {
    pub submitter: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = mint)]
    pub config: Box<Account<'info, Config>>,

    #[account(mut, seeds = [DEAL_SEED, &deal.id.to_le_bytes()], bump = deal.bump)]
    pub deal: Box<Account<'info, Deal>>,

    #[account(mut, seeds = [VAULT_SEED, deal.key().as_ref()], bump = deal.vault_bump, token::mint = mint, token::authority = deal)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut, token::mint = mint, token::authority = deal.seller)]
    pub seller_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut, token::mint = mint, token::authority = deal.buyer)]
    pub buyer_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// Delivered, and nobody proved a reversal before the window closed: the seller is paid.
pub fn handle_finalize(ctx: Context<Settle>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let accounts = ctx.accounts;
    let deal = &mut accounts.deal;
    require!(deal.status == DealStatus::Delivered, ProofSwapError::WrongStatus);
    let window_end = deal
        .protection_end
        .checked_add(deal.grace_period)
        .ok_or(ProofSwapError::MathOverflow)?;
    require!(now > window_end, ProofSwapError::ProtectionNotOver);

    deal.status = DealStatus::Completed;
    deal.settled_at = now;
    let price = deal.price;
    pay_from_vault(deal, &accounts.vault, &accounts.seller_ata, &accounts.mint, &accounts.token_program, price)
}

/// Paid, but no delivery was proven before the deadline: the buyer gets the money back.
pub fn handle_refund(ctx: Context<Settle>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let accounts = ctx.accounts;
    let deal = &mut accounts.deal;
    require!(deal.status == DealStatus::Funded, ProofSwapError::WrongStatus);
    require!(now > deal.delivery_deadline, ProofSwapError::DeliveryWindowOpen);

    deal.status = DealStatus::Refunded;
    deal.settled_at = now;
    let price = deal.price;
    pay_from_vault(deal, &accounts.vault, &accounts.buyer_ata, &accounts.mint, &accounts.token_program, price)
}
