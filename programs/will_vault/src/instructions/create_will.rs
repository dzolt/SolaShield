use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::WillError;
use crate::state::{Config, Will, WillStatus};

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct CreateWill<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = mint)]
    pub config: Box<Account<'info, Config>>,

    #[account(
        init,
        payer = owner,
        space = 8 + Will::INIT_SPACE,
        seeds = [WILL_SEED, owner.key().as_ref(), &id.to_le_bytes()],
        bump
    )]
    pub will: Box<Account<'info, Will>>,

    /// The will's own vault, separate from every other will and from the insurance pool.
    /// Its authority is the will PDA, so no key, ours included, can move the money.
    #[account(
        init,
        payer = owner,
        seeds = [VAULT_SEED, will.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = will,
        token::token_program = token_program
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_will(ctx: Context<CreateWill>, id: u64, guardian: Option<Pubkey>) -> Result<()> {
    let owner = ctx.accounts.owner.key();
    require!(guardian != Some(owner), WillError::GuardianIsOwner);

    let now = Clock::get()?.unix_timestamp;
    let config = &ctx.accounts.config;
    let will = &mut ctx.accounts.will;
    will.owner = owner;
    will.id = id;
    will.guardian = guardian;
    will.beneficiaries = Vec::new();
    will.beneficiaries_locked = false;
    will.inactivity_period = config.inactivity_period;
    will.claim_period = config.claim_period;
    will.vetoes_used = 0;
    will.status = WillStatus::Active;
    will.distributed_total = 0;
    will.created_at = now;
    will.triggered_at = 0;
    will.bump = ctx.bumps.will;
    will.vault_bump = ctx.bumps.vault;
    will.record_alive(now);
    Ok(())
}
