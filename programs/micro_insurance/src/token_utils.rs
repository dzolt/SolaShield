use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::POOL_SEED;
use crate::error::InsuranceError;
use crate::state::{Policy, PolicyStatus, Pool};

/// Moves tokens out of the pool vault. The pool PDA signs, so only this program can do it.
pub fn transfer_from_vault<'info>(
    pool: &Account<'info, Pool>,
    vault: &InterfaceAccount<'info, TokenAccount>,
    to: &InterfaceAccount<'info, TokenAccount>,
    mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
    amount: u64,
) -> Result<()> {
    let seeds: &[&[u8]] = &[POOL_SEED, pool.mint.as_ref(), &[pool.bump]];
    let signer = &[seeds];
    let accounts = TransferChecked {
        from: vault.to_account_info(),
        mint: mint.to_account_info(),
        to: to.to_account_info(),
        authority: pool.to_account_info(),
    };
    let ctx = CpiContext::new_with_signer(token_program.key(), accounts, signer);
    transfer_checked(ctx, amount, mint.decimals)
}

/// Moves tokens from a user's account into the pool vault (the user signs).
pub fn transfer_to_vault<'info>(
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

/// Closes an active policy. Frees the reserved capital and, when the trigger was met, pays the holder from the vault.
/// The only place where a cover pays out: the payout rule exists in exactly one place.
pub fn settle_policy<'info>(
    pool: &mut Account<'info, Pool>,
    policy: &mut Account<'info, Policy>,
    triggered: bool,
    vault: &InterfaceAccount<'info, TokenAccount>,
    holder_ata: &InterfaceAccount<'info, TokenAccount>,
    mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
) -> Result<()> {
    require!(policy.status == PolicyStatus::Active, InsuranceError::PolicyNotActive);
    pool.reserved = pool.reserved.checked_sub(policy.payout).ok_or(InsuranceError::MathOverflow)?;
    if triggered {
        pool.total_assets = pool.total_assets.checked_sub(policy.payout).ok_or(InsuranceError::MathOverflow)?;
        policy.status = PolicyStatus::PaidOut;
        transfer_from_vault(pool, vault, holder_ata, mint, token_program, policy.payout)?;
    } else {
        policy.status = PolicyStatus::Expired;
    }
    Ok(())
}
