use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::ProofSwapError;
use crate::state::{Config, Deal, DealStatus};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateListingArgs {
    pub price: u64,
    pub seller_steam_id: u64,
    pub item_name: String,
    pub wear: String,
    pub pattern: u32,
    pub listed_asset_id: u64,
}

#[derive(Accounts)]
pub struct CreateListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,

    #[account(
        init,
        payer = seller,
        space = 8 + Deal::INIT_SPACE,
        seeds = [DEAL_SEED, &config.deal_count.to_le_bytes()],
        bump
    )]
    pub deal: Box<Account<'info, Deal>>,

    pub system_program: Program<'info, System>,
}

/// A Steam Wear Rating as Steam prints it: "0." followed by digits (floats are in [0, 1)).
fn is_wear_rating(wear: &str) -> bool {
    wear.len() > 2 && wear.starts_with("0.") && wear[2..].bytes().all(|b| b.is_ascii_digit())
}

pub fn handle_create_listing(ctx: Context<CreateListing>, args: CreateListingArgs) -> Result<()> {
    require!(args.price > 0, ProofSwapError::ZeroPrice);
    require!(args.seller_steam_id != 0, ProofSwapError::MissingSteamId);
    require!(
        !args.item_name.is_empty() && args.item_name.len() <= MAX_ITEM_NAME_LEN && args.wear.len() <= MAX_WEAR_LEN,
        ProofSwapError::FieldTooLong
    );
    // Only items with a wear (float) are unique copies; a float-less item could be "delivered" by any copy.
    require!(is_wear_rating(&args.wear), ProofSwapError::InvalidWear);

    let config = &mut ctx.accounts.config;
    let deal = &mut ctx.accounts.deal;
    deal.id = config.deal_count;
    deal.seller = ctx.accounts.seller.key();
    deal.buyer = Pubkey::default();
    deal.price = args.price;
    deal.seller_steam_id = args.seller_steam_id;
    deal.buyer_steam_id = 0;
    deal.item_name = args.item_name;
    deal.wear = args.wear;
    deal.pattern = args.pattern;
    deal.listed_asset_id = args.listed_asset_id;
    deal.status = DealStatus::Listed;
    deal.listing_verified = false;
    // Copied from the config so the rules of this deal are fixed when it is created.
    deal.protection_period = config.protection_period;
    deal.grace_period = config.grace_period;
    deal.created_at = Clock::get()?.unix_timestamp;
    deal.last_kind = None;
    deal.bump = ctx.bumps.deal;

    config.deal_count = config.deal_count.checked_add(1).ok_or(ProofSwapError::MathOverflow)?;
    Ok(())
}
