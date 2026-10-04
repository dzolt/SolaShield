pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod token_utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("2nW3VAQxwqAaWfDcskHzvPgVn48WJyaFMbAZMTWavCxe");

#[program]
pub mod will_vault {
    use super::*;

    pub fn init_config(ctx: Context<InitConfig>, args: InitConfigArgs) -> Result<()> {
        instructions::init_config::handle_init_config(ctx, args)
    }

    pub fn create_will(ctx: Context<CreateWill>, id: u64, guardian: Option<Pubkey>) -> Result<()> {
        instructions::create_will::handle_create_will(ctx, id, guardian)
    }

    pub fn check_in(ctx: Context<OwnerAction>) -> Result<()> {
        instructions::owner_actions::handle_check_in(ctx)
    }

    pub fn set_beneficiaries(ctx: Context<OwnerAction>, list: Vec<BeneficiaryInput>) -> Result<()> {
        instructions::owner_actions::handle_set_beneficiaries(ctx, list)
    }

    pub fn lock_beneficiaries(ctx: Context<OwnerAction>) -> Result<()> {
        instructions::owner_actions::handle_lock_beneficiaries(ctx)
    }

    pub fn set_guardian(ctx: Context<OwnerAction>, guardian: Option<Pubkey>) -> Result<()> {
        instructions::owner_actions::handle_set_guardian(ctx, guardian)
    }

    pub fn deposit(ctx: Context<OwnerFunds>, amount: u64) -> Result<()> {
        instructions::owner_funds::handle_deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<OwnerFunds>, amount: u64) -> Result<()> {
        instructions::owner_funds::handle_withdraw(ctx, amount)
    }

    pub fn cancel_will(ctx: Context<OwnerFunds>) -> Result<()> {
        instructions::owner_funds::handle_cancel_will(ctx)
    }

    pub fn veto(ctx: Context<Veto>) -> Result<()> {
        instructions::veto::handle_veto(ctx)
    }

    pub fn trigger_distribution(ctx: Context<TriggerDistribution>) -> Result<()> {
        instructions::distribute::handle_trigger_distribution(ctx)
    }

    pub fn claim_share(ctx: Context<ClaimShare>, index: u8) -> Result<()> {
        instructions::distribute::handle_claim_share(ctx, index)
    }
}
