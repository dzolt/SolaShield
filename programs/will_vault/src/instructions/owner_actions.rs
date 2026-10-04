use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::WillError;
use crate::state::{Beneficiary, Will, WillStatus};

/// Settings changed by the owner. Every one of them also counts as a sign of life and resets the timer.
#[derive(Accounts)]
pub struct OwnerAction<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [WILL_SEED, owner.key().as_ref(), &will.id.to_le_bytes()],
        bump = will.bump,
        has_one = owner @ WillError::NotOwner
    )]
    pub will: Box<Account<'info, Will>>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BeneficiaryInput {
    pub wallet: Pubkey,
    pub bps: u16,
}

/// Any instruction the owner signs is proof of life: the timer and the guardian's vetoes reset.
pub fn record_owner_activity(will: &mut Will) -> Result<()> {
    require!(will.status == WillStatus::Active, WillError::WrongStatus);
    will.record_alive(Clock::get()?.unix_timestamp);
    Ok(())
}

/// "I'm still here": resets the timer, even after the procedure ended, as long as nobody triggered the payout.
pub fn handle_check_in(ctx: Context<OwnerAction>) -> Result<()> {
    record_owner_activity(&mut ctx.accounts.will)
}

fn validate_beneficiaries(owner: &Pubkey, list: &[BeneficiaryInput]) -> Result<()> {
    require!(
        (1..=MAX_BENEFICIARIES).contains(&list.len()),
        WillError::InvalidBeneficiaryCount
    );
    let mut sum: u32 = 0;
    for (i, b) in list.iter().enumerate() {
        require!(b.bps > 0, WillError::InvalidShares);
        require!(
            b.wallet != *owner && b.wallet != Pubkey::default() && list[..i].iter().all(|o| o.wallet != b.wallet),
            WillError::InvalidBeneficiary
        );
        sum += b.bps as u32;
    }
    require!(sum == TOTAL_BPS as u32, WillError::InvalidShares);
    Ok(())
}

/// Replaces the whole list of heirs. Possible until the owner makes it final.
pub fn handle_set_beneficiaries(ctx: Context<OwnerAction>, list: Vec<BeneficiaryInput>) -> Result<()> {
    let owner = ctx.accounts.owner.key();
    validate_beneficiaries(&owner, &list)?;
    let will = &mut ctx.accounts.will;
    record_owner_activity(will)?;
    require!(!will.beneficiaries_locked, WillError::BeneficiariesLocked);
    will.beneficiaries = list
        .iter()
        .map(|b| Beneficiary { wallet: b.wallet, bps: b.bps, claimed: false })
        .collect();
    Ok(())
}

/// Makes the list of heirs and their shares final. There is no instruction that undoes this.
pub fn handle_lock_beneficiaries(ctx: Context<OwnerAction>) -> Result<()> {
    let will = &mut ctx.accounts.will;
    record_owner_activity(will)?;
    require!(!will.beneficiaries.is_empty(), WillError::NoBeneficiaries);
    will.beneficiaries_locked = true;
    Ok(())
}

/// Names, replaces or removes (None) the guardian.
pub fn handle_set_guardian(ctx: Context<OwnerAction>, guardian: Option<Pubkey>) -> Result<()> {
    let owner = ctx.accounts.owner.key();
    require!(guardian != Some(owner), WillError::GuardianIsOwner);
    let will = &mut ctx.accounts.will;
    record_owner_activity(will)?;
    will.guardian = guardian;
    Ok(())
}
