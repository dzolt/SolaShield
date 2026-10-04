use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::constants::*;
use crate::error::ProofSwapError;
use crate::state::Config;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitConfigArgs {
    pub attestor: Pubkey,
    pub delivery_window: i64,
    pub protection_period: i64,
    pub grace_period: i64,
}

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Box<Account<'info, Config>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init_config(ctx: Context<InitConfig>, args: InitConfigArgs) -> Result<()> {
    let window = 1..=MAX_WINDOW_SECONDS;
    require!(window.contains(&args.delivery_window), ProofSwapError::InvalidWindow);
    require!(window.contains(&args.protection_period), ProofSwapError::InvalidWindow);
    require!((0..=MAX_WINDOW_SECONDS).contains(&args.grace_period), ProofSwapError::InvalidWindow);

    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.attestor = args.attestor;
    config.mint = ctx.accounts.mint.key();
    config.delivery_window = args.delivery_window;
    config.protection_period = args.protection_period;
    config.grace_period = args.grace_period;
    config.deal_count = 0;
    config.bump = ctx.bumps.config;
    Ok(())
}
