use anchor_lang::prelude::*;

use crate::constants::MAX_NAME_LEN;

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub admin: Pubkey,
    pub mint: Pubkey,
    /// Internal accounting of pool funds (not the vault balance, so donations cannot skew the share price).
    pub total_assets: u64,
    /// Sum of payouts of active covers.
    pub reserved: u64,
    pub total_shares: u64,
    /// After each deposit the provider cannot withdraw for this long (set once at pool creation, never changed).
    pub lockup_seconds: i64,
    pub product_count: u32,
    pub policy_count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LpPosition {
    pub owner: Pubkey,
    pub shares: u64,
    /// Earliest time the provider may withdraw (unix seconds). Every new deposit pushes it back for the whole position.
    pub unlock_at: i64,
    pub bump: u8,
}

/// Which move of the Pyth price a cover protects against.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Trigger {
    /// Pays if the price at the expiry is at or below the strike (reference price lowered by the cover's threshold).
    PriceBelow,
    /// Pays if the price at the expiry is at or above the strike (reference price raised by the cover's threshold).
    PriceAbove,
}

/// Products are immutable once created: the admin can add new ones but never edit one that covers depend on.
#[account]
#[derive(InitSpace)]
pub struct Product {
    pub pool: Pubkey,
    pub id: u32,
    #[max_len(MAX_NAME_LEN)]
    pub name: String,
    pub trigger: Trigger,
    /// Pyth price feed id.
    pub feed_id: [u8; 32],
    pub premium_bps: u16,
    /// A cover must be bought at least this many seconds before its expiry.
    pub min_lead_time: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PolicyStatus {
    Active,
    PaidOut,
    Expired,
    Voided,
}

#[account]
#[derive(InitSpace)]
pub struct Policy {
    pub pool: Pubkey,
    pub id: u64,
    pub holder: Pubkey,
    pub product_id: u32,
    pub payout: u64,
    pub premium: u64,
    /// When the cover ends and the price is read (unix seconds).
    pub expiry: i64,
    /// Pyth price at purchase, read by the program itself: `reference_price` x 10^`price_expo`.
    pub reference_price: i64,
    pub price_expo: i32,
    /// Protected move in basis points (e.g. 1500 = 15%).
    pub threshold_bps: u16,
    /// Trigger level computed by the program from the reference price and the threshold.
    pub strike: i64,
    pub status: PolicyStatus,
    pub bump: u8,
}
