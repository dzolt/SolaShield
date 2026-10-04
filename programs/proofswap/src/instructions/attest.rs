use anchor_lang::prelude::*;

use crate::attestation::{attestation_message, require_attestation, require_fresh};
use crate::constants::*;
use crate::error::ProofSwapError;
use crate::state::{AttestationKind, Config, Deal, DealStatus};

/// Attestations that move a deal forward without moving money.
#[derive(Accounts)]
pub struct Attest<'info> {
    /// Anyone may submit an attestation: what counts is the attestor's signature, not who sends it.
    pub submitter: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,

    #[account(mut, seeds = [DEAL_SEED, &deal.id.to_le_bytes()], bump = deal.bump)]
    pub deal: Box<Account<'info, Deal>>,

    /// CHECK: the instructions sysvar, fixed by address; read to find the Ed25519 signature check.
    #[account(address = INSTRUCTIONS_SYSVAR_ID)]
    pub instructions: UncheckedAccount<'info>,
}

/// Steam shows the listed item in the seller's inventory: the listing is real.
pub fn handle_attest_listing(ctx: Context<Attest>, observed_at: i64, evidence_hash: [u8; 32]) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let attestor = ctx.accounts.config.attestor;
    let instructions = ctx.accounts.instructions.to_account_info();
    let deal = &mut ctx.accounts.deal;
    require!(deal.status == DealStatus::Listed, ProofSwapError::WrongStatus);
    require_fresh(observed_at, now)?;
    require!(observed_at >= deal.created_at, ProofSwapError::OutsideWindow);

    let kind = AttestationKind::ListedItemInSellerInventory;
    let message = attestation_message(&deal.key(), kind, deal.seller_steam_id, observed_at, &evidence_hash);
    require_attestation(&instructions, &attestor, &message)?;

    deal.listing_verified = true;
    deal.record(kind, observed_at, evidence_hash);
    Ok(())
}

/// Steam shows the item in the buyer's inventory: delivered. The payment now waits out the reversal window.
pub fn handle_attest_delivery(ctx: Context<Attest>, observed_at: i64, evidence_hash: [u8; 32]) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let attestor = ctx.accounts.config.attestor;
    let instructions = ctx.accounts.instructions.to_account_info();
    let deal = &mut ctx.accounts.deal;
    require!(deal.status == DealStatus::Funded, ProofSwapError::WrongStatus);
    require_fresh(observed_at, now)?;
    require!(
        observed_at >= deal.funded_at && observed_at <= deal.delivery_deadline,
        ProofSwapError::OutsideWindow
    );

    let kind = AttestationKind::DeliveredToBuyer;
    let message = attestation_message(&deal.key(), kind, deal.buyer_steam_id, observed_at, &evidence_hash);
    require_attestation(&instructions, &attestor, &message)?;

    deal.status = DealStatus::Delivered;
    deal.delivered_at = observed_at;
    // Steam's reversal window starts at the trade, which happened before this observation, so ours ends later than Steam's.
    deal.protection_end = observed_at
        .checked_add(deal.protection_period)
        .ok_or(ProofSwapError::MathOverflow)?;
    deal.record(kind, observed_at, evidence_hash);
    Ok(())
}
