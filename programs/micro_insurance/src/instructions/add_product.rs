use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::InsuranceError;
use crate::state::{Pool, Product, Trigger};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AddProductArgs {
    pub name: String,
    pub trigger: Trigger,
    pub feed_id: [u8; 32],
    pub premium_bps: u16,
    pub min_lead_time: i64,
}

#[derive(Accounts)]
pub struct AddProduct<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut, has_one = admin)]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        init,
        payer = admin,
        space = 8 + Product::INIT_SPACE,
        seeds = [PRODUCT_SEED, pool.key().as_ref(), &pool.product_count.to_le_bytes()],
        bump
    )]
    pub product: Box<Account<'info, Product>>,

    pub system_program: Program<'info, System>,
}

/// Products are immutable once created: the admin can add new ones but never edit one that covers depend on.
pub fn handle_add_product(ctx: Context<AddProduct>, args: AddProductArgs) -> Result<()> {
    require!(args.name.len() <= MAX_NAME_LEN, InsuranceError::InvalidProduct);
    require!(args.premium_bps > 0 && (args.premium_bps as u64) < BPS, InsuranceError::InvalidProduct);
    require!(args.min_lead_time >= 0, InsuranceError::InvalidProduct);
    require!(args.feed_id != [0u8; 32], InsuranceError::InvalidProduct);

    let pool = &mut ctx.accounts.pool;
    let product = &mut ctx.accounts.product;
    product.pool = pool.key();
    product.id = pool.product_count;
    product.name = args.name;
    product.trigger = args.trigger;
    product.feed_id = args.feed_id;
    product.premium_bps = args.premium_bps;
    product.min_lead_time = args.min_lead_time;
    product.bump = ctx.bumps.product;
    pool.product_count = pool.product_count.checked_add(1).ok_or(InsuranceError::MathOverflow)?;
    Ok(())
}
