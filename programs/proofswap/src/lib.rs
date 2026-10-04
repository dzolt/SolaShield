pub mod attestation;
pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod token_utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("7kWKy3wvsLi37vZ5Cp3YvcrpvAkscHj5mXWopBG2JaZd");

#[program]
pub mod proofswap {
    use super::*;

    pub fn init_config(ctx: Context<InitConfig>, args: InitConfigArgs) -> Result<()> {
        instructions::init_config::handle_init_config(ctx, args)
    }

    pub fn create_listing(ctx: Context<CreateListing>, args: CreateListingArgs) -> Result<()> {
        instructions::create_listing::handle_create_listing(ctx, args)
    }

    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        instructions::cancel_listing::handle_cancel_listing(ctx)
    }

    pub fn fund(ctx: Context<Fund>, buyer_steam_id: u64, observed_at: i64, evidence_hash: [u8; 32]) -> Result<()> {
        instructions::fund::handle_fund(ctx, buyer_steam_id, observed_at, evidence_hash)
    }

    pub fn attest_listing(ctx: Context<Attest>, observed_at: i64, evidence_hash: [u8; 32]) -> Result<()> {
        instructions::attest::handle_attest_listing(ctx, observed_at, evidence_hash)
    }

    pub fn attest_delivery(ctx: Context<Attest>, observed_at: i64, evidence_hash: [u8; 32]) -> Result<()> {
        instructions::attest::handle_attest_delivery(ctx, observed_at, evidence_hash)
    }

    pub fn attest_reversal(
        ctx: Context<AttestSettle>,
        kind: AttestationKind,
        observed_at: i64,
        evidence_hash: [u8; 32],
    ) -> Result<()> {
        instructions::attest_settle::handle_attest_reversal(ctx, kind, observed_at, evidence_hash)
    }

    pub fn attest_buyer_hidden(ctx: Context<AttestSettle>, observed_at: i64, evidence_hash: [u8; 32]) -> Result<()> {
        instructions::attest_settle::handle_attest_buyer_hidden(ctx, observed_at, evidence_hash)
    }

    pub fn finalize(ctx: Context<Settle>) -> Result<()> {
        instructions::settle::handle_finalize(ctx)
    }

    pub fn refund(ctx: Context<Settle>) -> Result<()> {
        instructions::settle::handle_refund(ctx)
    }
}
