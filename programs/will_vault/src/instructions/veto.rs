use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::WillError;
use crate::state::{Will, WillStatus};

#[derive(Accounts)]
pub struct Veto<'info> {
    pub guardian: Signer<'info>,

    #[account(mut, seeds = [WILL_SEED, will.owner.as_ref(), &will.id.to_le_bytes()], bump = will.bump)]
    pub will: Box<Account<'info, Will>>,
}

/// The guardian believes the owner is alive but away: the timer starts again from zero.
/// Only once the owner has gone quiet, and at most MAX_VETOES times until the owner shows up again,
/// so a guardian cannot keep the heirs waiting forever.
pub fn handle_veto(ctx: Context<Veto>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let will = &mut ctx.accounts.will;
    require!(will.guardian == Some(ctx.accounts.guardian.key()), WillError::NotGuardian);
    require!(will.status == WillStatus::Active, WillError::WrongStatus);
    require!(now > will.procedure_starts_at()?, WillError::NothingToVeto);
    require!(will.vetoes_used < MAX_VETOES, WillError::NoVetoesLeft);

    will.last_alive = now;
    will.vetoes_used += 1;
    Ok(())
}
