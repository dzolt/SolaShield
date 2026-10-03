use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{mint_to, Mint, MintTo, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::InsuranceError;

#[derive(Accounts)]
pub struct Faucet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    /// The test token (tUSDC). Its mint authority is this program's PDA, which is what makes the faucet open.
    #[account(mut, mint::authority = mint_authority, mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: PDA that only signs mint_to calls made by this program.
    #[account(seeds = [MINT_AUTHORITY_SEED], bump)]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user,
        associated_token::token_program = token_program
    )]
    pub user_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Devnet-only convenience: anyone can mint test tokens to themselves (up to a cap per call).
pub fn handle_faucet(ctx: Context<Faucet>, amount: u64) -> Result<()> {
    require!(amount > 0, InsuranceError::ZeroAmount);
    require!(amount <= FAUCET_MAX, InsuranceError::FaucetLimit);

    let seeds: &[&[u8]] = &[MINT_AUTHORITY_SEED, &[ctx.bumps.mint_authority]];
    let signer = &[seeds];
    let accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.user_ata.to_account_info(),
        authority: ctx.accounts.mint_authority.to_account_info(),
    };
    let cpi = CpiContext::new_with_signer(ctx.accounts.token_program.key(), accounts, signer);
    mint_to(cpi, amount)
}
