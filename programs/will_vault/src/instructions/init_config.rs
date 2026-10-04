use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::constants::*;
use crate::error::WillError;
use crate::state::Config;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitConfigArgs {
    pub inactivity_period: i64,
    pub claim_period: i64,
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
    require!(window.contains(&args.inactivity_period), WillError::InvalidWindow);
    require!(window.contains(&args.claim_period), WillError::InvalidWindow);

    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.mint = ctx.accounts.mint.key();
    config.inactivity_period = args.inactivity_period;
    config.claim_period = args.claim_period;
    config.bump = ctx.bumps.config;
    Ok(())
}
