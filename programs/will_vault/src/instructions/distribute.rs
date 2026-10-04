use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::WillError;
use crate::state::{Config, Will, WillStatus};
use crate::token_utils::pay_from_vault;

#[derive(Accounts)]
pub struct TriggerDistribution<'info> {
    pub submitter: Signer<'info>,

    #[account(mut, seeds = [WILL_SEED, will.owner.as_ref(), &will.id.to_le_bytes()], bump = will.bump)]
    pub will: Box<Account<'info, Will>>,

    #[account(seeds = [VAULT_SEED, will.key().as_ref()], bump = will.vault_bump, token::authority = will)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
}

/// The owner and the guardian stayed silent through both periods: anyone may start the payout.
/// From here on the owner cannot check in, withdraw or cancel, and the balance to split is fixed.
pub fn handle_trigger_distribution(ctx: Context<TriggerDistribution>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let balance = ctx.accounts.vault.amount;
    let will = &mut ctx.accounts.will;
    require!(will.status == WillStatus::Active, WillError::WrongStatus);
    require!(!will.beneficiaries.is_empty(), WillError::NoBeneficiaries);
    require!(now > will.claim_opens_at()?, WillError::ClaimNotOpen);

    will.status = WillStatus::Distributing;
    will.distributed_total = balance;
    will.triggered_at = now;
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimShare<'info> {
    pub submitter: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = mint)]
    pub config: Box<Account<'info, Config>>,

    #[account(mut, seeds = [WILL_SEED, will.owner.as_ref(), &will.id.to_le_bytes()], bump = will.bump)]
    pub will: Box<Account<'info, Will>>,

    #[account(mut, seeds = [VAULT_SEED, will.key().as_ref()], bump = will.vault_bump, token::mint = mint, token::authority = will)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Checked against the heir's wallet in the handler: the money can only go to that heir.
    #[account(mut, token::mint = mint)]
    pub beneficiary_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// Pays one heir their share. Anyone may call it (each heir separately), so one heir without a token account
/// cannot block the others.
pub fn handle_claim_share(ctx: Context<ClaimShare>, index: u8) -> Result<()> {
    let a = ctx.accounts;
    let i = index as usize;
    require!(a.will.status == WillStatus::Distributing, WillError::WrongStatus);
    let heir = *a.will.beneficiaries.get(i).ok_or(WillError::BadIndex)?;
    require!(!heir.claimed, WillError::AlreadyClaimed);
    require!(a.beneficiary_ata.owner == heir.wallet, WillError::WrongRecipient);

    let share = a.will.share_of(i)?;
    a.will.beneficiaries[i].claimed = true;
    if share == 0 {
        return Ok(());
    }
    pay_from_vault(&a.will, &a.vault, &a.beneficiary_ata, &a.mint, &a.token_program, share)
}
