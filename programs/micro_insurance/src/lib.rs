pub mod constants;
pub mod error;
pub mod instructions;
pub mod math;
pub mod state;
pub mod token_utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("GHrWtBXvB126xq3JTaZkpziobURgi7XA29JisS1Ra18R");

#[program]
pub mod micro_insurance {
    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>, lockup_seconds: i64) -> Result<()> {
        instructions::initialize_pool::handle_initialize_pool(ctx, lockup_seconds)
    }

    pub fn add_product(ctx: Context<AddProduct>, args: AddProductArgs) -> Result<()> {
        instructions::add_product::handle_add_product(ctx, args)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handle_deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
        instructions::withdraw::handle_withdraw(ctx, shares)
    }

    pub fn buy_policy(ctx: Context<BuyPolicy>, args: BuyPolicyArgs) -> Result<()> {
        instructions::buy_policy::handle_buy_policy(ctx, args)
    }

    pub fn settle_price(ctx: Context<SettlePrice>) -> Result<()> {
        instructions::settle_price::handle_settle_price(ctx)
    }

    pub fn void_policy(ctx: Context<VoidPolicy>) -> Result<()> {
        instructions::void_policy::handle_void_policy(ctx)
    }

    pub fn faucet(ctx: Context<Faucet>, amount: u64) -> Result<()> {
        instructions::faucet::handle_faucet(ctx, amount)
    }
}
