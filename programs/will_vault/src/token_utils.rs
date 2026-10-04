use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::WILL_SEED;
use crate::state::Will;

fn will_seeds(will: &Will) -> ([u8; 8], [u8; 1]) {
    (will.id.to_le_bytes(), [will.bump])
}

/// Pays out of the will's vault. The will PDA signs, so only this program can move the money.
pub fn pay_from_vault<'info>(
    will: &Account<'info, Will>,
    vault: &InterfaceAccount<'info, TokenAccount>,
    to: &InterfaceAccount<'info, TokenAccount>,
    mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
    amount: u64,
) -> Result<()> {
    let (id, bump) = will_seeds(will);
    let seeds: &[&[u8]] = &[WILL_SEED, will.owner.as_ref(), &id, &bump];
    let signer = &[seeds];
    let accounts = TransferChecked {
        from: vault.to_account_info(),
        mint: mint.to_account_info(),
        to: to.to_account_info(),
        authority: will.to_account_info(),
    };
    let ctx = CpiContext::new_with_signer(token_program.key(), accounts, signer);
    transfer_checked(ctx, amount, mint.decimals)
}

/// Closes the (empty) vault and returns its rent to `rent_to`.
pub fn close_vault<'info>(
    will: &Account<'info, Will>,
    vault: &InterfaceAccount<'info, TokenAccount>,
    rent_to: &AccountInfo<'info>,
    token_program: &Interface<'info, TokenInterface>,
) -> Result<()> {
    let (id, bump) = will_seeds(will);
    let seeds: &[&[u8]] = &[WILL_SEED, will.owner.as_ref(), &id, &bump];
    let signer = &[seeds];
    let accounts = CloseAccount {
        account: vault.to_account_info(),
        destination: rent_to.clone(),
        authority: will.to_account_info(),
    };
    close_account(CpiContext::new_with_signer(token_program.key(), accounts, signer))
}

/// Moves the owner's money into the vault (the owner signs).
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
