use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::attestation::{attestation_message, require_attestation, require_fresh};
use crate::constants::*;
use crate::error::ProofSwapError;
use crate::state::{AttestationKind, Config, Deal, DealStatus};
use crate::token_utils::pay_into_vault;

#[derive(Accounts)]
pub struct Fund<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = mint)]
    pub config: Box<Account<'info, Config>>,

    #[account(mut, seeds = [DEAL_SEED, &deal.id.to_le_bytes()], bump = deal.bump)]
    pub deal: Box<Account<'info, Deal>>,

    /// The deal's own vault. Its authority is the deal PDA, so no key, ours included, can move the payment.
    #[account(
        init,
        payer = buyer,
        seeds = [VAULT_SEED, deal.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = deal,
        token::token_program = token_program
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut, token::mint = mint, token::authority = buyer)]
    pub buyer_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,

    /// CHECK: the instructions sysvar, fixed by address; read to find the Ed25519 signature check.
    #[account(address = INSTRUCTIONS_SYSVAR_ID)]
    pub instructions: UncheckedAccount<'info>,
}

/// The buyer pays into the vault. The attestor must have just seen the buyer's inventory public: delivery can only be
/// proven from a public inventory, so paying with a hidden one (or a mistyped SteamID) is refused up front.
pub fn handle_fund(ctx: Context<Fund>, buyer_steam_id: u64, observed_at: i64, evidence_hash: [u8; 32]) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let delivery_window = ctx.accounts.config.delivery_window;
    let attestor = ctx.accounts.config.attestor;
    let instructions = ctx.accounts.instructions.to_account_info();
    let deal = &mut ctx.accounts.deal;
    require!(deal.status == DealStatus::Listed, ProofSwapError::WrongStatus);
    // Steam must first show the item in the seller's inventory. Otherwise a seller could list an item the buyer
    // already owns, and "delivery" would be attested without anything changing hands.
    require!(deal.listing_verified, ProofSwapError::ListingNotVerified);
    require!(buyer_steam_id != 0, ProofSwapError::MissingSteamId);
    require!(
        ctx.accounts.buyer.key() != deal.seller && buyer_steam_id != deal.seller_steam_id,
        ProofSwapError::SameParty
    );
    require_fresh(observed_at, now)?;
    let kind = AttestationKind::BuyerInventoryPublic;
    let message = attestation_message(&deal.key(), kind, buyer_steam_id, observed_at, &evidence_hash);
    require_attestation(&instructions, &attestor, &message)?;

    deal.record(kind, observed_at, evidence_hash);
    deal.buyer = ctx.accounts.buyer.key();
    deal.buyer_steam_id = buyer_steam_id;
    deal.funded_at = now;
    deal.delivery_deadline = now.checked_add(delivery_window).ok_or(ProofSwapError::MathOverflow)?;
    deal.status = DealStatus::Funded;
    deal.vault_bump = ctx.bumps.vault;
    let price = deal.price;

    pay_into_vault(
        &ctx.accounts.buyer_ata,
        &ctx.accounts.vault,
        &ctx.accounts.mint,
        &ctx.accounts.buyer,
        &ctx.accounts.token_program,
        price,
    )
}
