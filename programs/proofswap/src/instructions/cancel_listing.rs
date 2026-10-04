use anchor_lang::prelude::*;

use crate::error::ProofSwapError;
use crate::state::{Deal, DealStatus};

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    /// A listing nobody has paid for yet can be withdrawn; its rent goes back to the seller.
    #[account(mut, has_one = seller @ ProofSwapError::NotSeller, close = seller)]
    pub deal: Box<Account<'info, Deal>>,
}

pub fn handle_cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
    require!(ctx.accounts.deal.status == DealStatus::Listed, ProofSwapError::WrongStatus);
    Ok(())
}
