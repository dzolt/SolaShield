use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::attestation::{attestation_message, require_attestation, require_fresh};
use crate::constants::*;
use crate::error::ProofSwapError;
use crate::state::{AttestationKind, Config, Deal, DealStatus};
use crate::token_utils::pay_from_vault;

/// Attestations that settle a deal: the money goes to the buyer or the seller, never anywhere else.
#[derive(Accounts)]
pub struct AttestSettle<'info> {
    /// Anyone may submit; the payout target is fixed by the deal, not by the submitter.
    pub submitter: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = mint)]
    pub config: Box<Account<'info, Config>>,

    #[account(mut, seeds = [DEAL_SEED, &deal.id.to_le_bytes()], bump = deal.bump)]
    pub deal: Box<Account<'info, Deal>>,

    #[account(mut, seeds = [VAULT_SEED, deal.key().as_ref()], bump = deal.vault_bump, token::mint = mint, token::authority = deal)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut, token::mint = mint, token::authority = deal.seller)]
    pub seller_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut, token::mint = mint, token::authority = deal.buyer)]
    pub buyer_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,

    /// CHECK: the instructions sysvar, fixed by address; read to find the Ed25519 signature check.
    #[account(address = INSTRUCTIONS_SYSVAR_ID)]
    pub instructions: UncheckedAccount<'info>,
}

/// During the reversal window Steam shows the item back with the seller, or the seller hid their inventory:
/// the buyer gets the payment back.
pub fn handle_attest_reversal(
    ctx: Context<AttestSettle>,
    kind: AttestationKind,
    observed_at: i64,
    evidence_hash: [u8; 32],
) -> Result<()> {
    require!(
        matches!(kind, AttestationKind::ReturnedToSeller | AttestationKind::SellerInventoryHidden),
        ProofSwapError::WrongAttestationKind
    );
    let now = Clock::get()?.unix_timestamp;
    let attestor = ctx.accounts.config.attestor;
    let instructions = ctx.accounts.instructions.to_account_info();
    let accounts = ctx.accounts;
    let deal = &mut accounts.deal;
    require!(deal.status == DealStatus::Delivered, ProofSwapError::WrongStatus);
    require_fresh(observed_at, now)?;
    let window_end = deal
        .protection_end
        .checked_add(deal.grace_period)
        .ok_or(ProofSwapError::MathOverflow)?;
    require!(
        observed_at >= deal.delivered_at && observed_at <= window_end,
        ProofSwapError::OutsideWindow
    );

    // Both reversal kinds are observations of the seller's account.
    let message = attestation_message(&deal.key(), kind, deal.seller_steam_id, observed_at, &evidence_hash);
    require_attestation(&instructions, &attestor, &message)?;

    deal.status = DealStatus::Refunded;
    deal.settled_at = now;
    deal.record(kind, observed_at, evidence_hash);
    let price = deal.price;
    pay_from_vault(deal, &accounts.vault, &accounts.buyer_ata, &accounts.mint, &accounts.token_program, price)
}

/// The buyer hid their inventory after paying and before delivery was proven, so delivery can no longer be
/// checked: the seller is paid. The buyer had to show a public inventory to pay (see `fund`), so hiding it is a
/// choice. Only before delivery: once delivery is proven, the reversal window protects the buyer and only the
/// seller's inventory matters, so the buyer's privacy settings must not let the seller skip that window.
pub fn handle_attest_buyer_hidden(ctx: Context<AttestSettle>, observed_at: i64, evidence_hash: [u8; 32]) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let attestor = ctx.accounts.config.attestor;
    let instructions = ctx.accounts.instructions.to_account_info();
    let accounts = ctx.accounts;
    let deal = &mut accounts.deal;
    require!(deal.status == DealStatus::Funded, ProofSwapError::WrongStatus);
    require_fresh(observed_at, now)?;
    require!(observed_at >= deal.funded_at, ProofSwapError::OutsideWindow);

    let kind = AttestationKind::BuyerInventoryHidden;
    let message = attestation_message(&deal.key(), kind, deal.buyer_steam_id, observed_at, &evidence_hash);
    require_attestation(&instructions, &attestor, &message)?;

    deal.status = DealStatus::Completed;
    deal.settled_at = now;
    deal.record(kind, observed_at, evidence_hash);
    let price = deal.price;
    pay_from_vault(deal, &accounts.vault, &accounts.seller_ata, &accounts.mint, &accounts.token_program, price)
}
