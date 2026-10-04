use anchor_lang::prelude::*;

use crate::constants::{MAX_BENEFICIARIES, TOTAL_BPS};
use crate::error::WillError;

/// Set once at deployment; there is no instruction to change it later.
#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    /// The vault token (tUSDC on devnet).
    pub mint: Pubkey,
    /// How long the owner may stay silent before the payout procedure starts (90 days in production).
    pub inactivity_period: i64,
    /// How long the procedure lasts before anyone can trigger the payout (30 days in production).
    pub claim_period: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum WillStatus {
    /// The owner controls the money; the timer runs.
    Active,
    /// The payout was triggered: the balance is frozen and only heirs' shares can leave the vault.
    Distributing,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub struct Beneficiary {
    pub wallet: Pubkey,
    /// Share of the vault in basis points (10 000 = 100%).
    pub bps: u16,
    pub claimed: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Will {
    pub owner: Pubkey,
    /// Chosen by the owner, so one wallet can keep several wills.
    pub id: u64,
    /// One person who may push the payout back while the owner is silent. Cannot touch the money.
    pub guardian: Option<Pubkey>,
    #[max_len(MAX_BENEFICIARIES)]
    pub beneficiaries: Vec<Beneficiary>,
    /// Once true, the list of heirs and their shares can never change. Deposits and withdrawals still work.
    pub beneficiaries_locked: bool,
    /// Copied from the config so the rules of this will are fixed when it is created.
    pub inactivity_period: i64,
    pub claim_period: i64,
    /// Last sign of life: any instruction signed by the owner, or a guardian veto.
    pub last_alive: i64,
    pub vetoes_used: u8,
    pub status: WillStatus,
    /// Vault balance when the payout was triggered; every share is a part of this amount.
    pub distributed_total: u64,
    pub created_at: i64,
    pub triggered_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Will {
    /// End of the inactivity period: from here on the payout procedure runs.
    pub fn procedure_starts_at(&self) -> Result<i64> {
        self.last_alive.checked_add(self.inactivity_period).ok_or(error!(WillError::MathOverflow))
    }

    /// End of the procedure: from here on anyone can trigger the payout.
    pub fn claim_opens_at(&self) -> Result<i64> {
        self.procedure_starts_at()?
            .checked_add(self.claim_period)
            .ok_or(error!(WillError::MathOverflow))
    }

    /// The owner showed up: the timer starts from zero and the guardian gets their vetoes back.
    pub fn record_alive(&mut self, now: i64) {
        self.last_alive = now;
        self.vetoes_used = 0;
    }

    /// Heir `index`'s part of the frozen balance. Rounding dust goes to the last heir, so the vault ends empty.
    pub fn share_of(&self, index: usize) -> Result<u64> {
        let total = self.distributed_total as u128;
        let floor = |b: &Beneficiary| total * b.bps as u128 / TOTAL_BPS as u128;
        let last = self.beneficiaries.len().checked_sub(1).ok_or(error!(WillError::NoBeneficiaries))?;
        let share = if index == last {
            let others: u128 = self.beneficiaries[..last].iter().map(floor).sum();
            total.checked_sub(others).ok_or(error!(WillError::MathOverflow))?
        } else {
            floor(&self.beneficiaries[index])
        };
        u64::try_from(share).map_err(|_| error!(WillError::MathOverflow))
    }
}
