use anchor_lang::prelude::*;

use crate::constants::{MAX_ITEM_NAME_LEN, MAX_WEAR_LEN};

/// Set once at deployment; there is no instruction to change it later.
#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    /// Key of the service that reads Steam and signs what it saw. It states facts; it cannot move money.
    pub attestor: Pubkey,
    /// Payment token (tUSDC on devnet).
    pub mint: Pubkey,
    /// After paying, the buyer waits at most this long for the item.
    pub delivery_window: i64,
    /// Steam lets the sender reverse a CS2 trade for 7 days, so the payment waits at least that long after delivery.
    pub protection_period: i64,
    /// Extra time after the protection period to report a reversal before the seller can be paid.
    pub grace_period: i64,
    pub deal_count: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum DealStatus {
    Listed,
    Funded,
    Delivered,
    Completed,
    Refunded,
}

/// What the attestor saw in Steam. Its number is part of the signed message.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum AttestationKind {
    /// The item is in the seller's inventory: the listing is real.
    ListedItemInSellerInventory,
    /// The item is in the buyer's inventory: delivered.
    DeliveredToBuyer,
    /// After delivery the item is back with the seller: the trade was reversed.
    ReturnedToSeller,
    /// The seller hid their inventory while a reversal was still possible.
    SellerInventoryHidden,
    /// The buyer hid their inventory after paying, before delivery was proven.
    BuyerInventoryHidden,
    /// The buyer's inventory is public, so delivery can be checked. Required to pay.
    BuyerInventoryPublic,
}

#[account]
#[derive(InitSpace)]
pub struct Deal {
    pub id: u64,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub price: u64,
    pub seller_steam_id: u64,
    pub buyer_steam_id: u64,
    /// Identity of the exact item. Name, wear and pattern survive a trade; the Steam asset id does not.
    #[max_len(MAX_ITEM_NAME_LEN)]
    pub item_name: String,
    #[max_len(MAX_WEAR_LEN)]
    pub wear: String,
    pub pattern: u32,
    /// Asset id in the seller's inventory when listed, for reference only.
    pub listed_asset_id: u64,
    pub status: DealStatus,
    pub listing_verified: bool,
    pub protection_period: i64,
    pub grace_period: i64,
    pub created_at: i64,
    pub funded_at: i64,
    pub delivery_deadline: i64,
    pub delivered_at: i64,
    pub protection_end: i64,
    pub settled_at: i64,
    /// The last attestation applied, so anyone can check the evidence a payout relied on.
    pub last_kind: Option<AttestationKind>,
    pub last_observed_at: i64,
    pub last_evidence_hash: [u8; 32],
    pub bump: u8,
    pub vault_bump: u8,
}

impl Deal {
    /// Records the attestation that moved the deal forward.
    pub fn record(&mut self, kind: AttestationKind, observed_at: i64, evidence_hash: [u8; 32]) {
        self.last_kind = Some(kind);
        self.last_observed_at = observed_at;
        self.last_evidence_hash = evidence_hash;
    }
}
