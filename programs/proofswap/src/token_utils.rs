use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::DEAL_SEED;
use crate::state::Deal;

/// Pays out of the deal's vault. The deal PDA signs, so only this program can move the money.
pub fn pay_from_vault<'info>(
    deal: &Account<'info, Deal>,
    vault: &InterfaceAccount<'info, TokenAccount>,
    to: &InterfaceAccount<'info, TokenAccount>,
    mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
    amount: u64,
) -> Result<()> {
    let id = deal.id.to_le_bytes();
    let seeds: &[&[u8]] = &[DEAL_SEED, &id, &[deal.bump]];
    let signer = &[seeds];
    let accounts = TransferChecked {
        from: vault.to_account_info(),
        mint: mint.to_account_info(),
        to: to.to_account_info(),
        authority: deal.to_account_info(),
    };
    let ctx = CpiContext::new_with_signer(token_program.key(), accounts, signer);
    transfer_checked(ctx, amount, mint.decimals)
}

/// Moves the buyer's payment into the deal's vault (the buyer signs).
pub fn pay_into_vault<'info>(
    from: &InterfaceAccount<'info, TokenAccount>,
    vault: &InterfaceAccount<'info, TokenAccount>,
    mint: &InterfaceAccount<'info, Mint>,
    authority: &Signer<'info>,
    token_program: &Interface<'info, TokenInterface>,
    amount: u64,
) -> Result<()> {
    let accounts = TransferChecked {
        from: from.to_account_info(),
        mint: mint.to_account_info(),
        to: vault.to_account_info(),
        authority: authority.to_account_info(),
    };
    let ctx = CpiContext::new(token_program.key(), accounts);
    transfer_checked(ctx, amount, mint.decimals)
}
