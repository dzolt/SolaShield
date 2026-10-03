use anchor_lang::prelude::*;

use crate::constants::{BPS, MAX_EXPONENT_GAP};
use crate::error::InsuranceError;
use crate::state::Trigger;

/// Premium as a share of the payout (rounded down).
pub fn premium_for(payout: u64, premium_bps: u16) -> Result<u64> {
    let premium = (payout as u128)
        .checked_mul(premium_bps as u128)
        .ok_or(InsuranceError::MathOverflow)?
        / BPS as u128;
    u64::try_from(premium).map_err(|_| InsuranceError::MathOverflow.into())
}

/// Shares minted for a deposit at the current share price (1:1 for the first deposit).
pub fn shares_for_deposit(amount: u64, total_assets: u64, total_shares: u64) -> Result<u64> {
    if total_shares == 0 {
        return Ok(amount);
    }
    require!(total_assets > 0, InsuranceError::PoolInsolvent);
    let shares = (amount as u128)
        .checked_mul(total_shares as u128)
        .ok_or(InsuranceError::MathOverflow)?
        / total_assets as u128;
    require!(shares > 0, InsuranceError::ZeroAmount);
    u64::try_from(shares).map_err(|_| InsuranceError::MathOverflow.into())
}

/// Tokens a number of shares is worth at the current share price (rounded down).
pub fn assets_for_shares(shares: u64, total_assets: u64, total_shares: u64) -> Result<u64> {
    require!(total_shares > 0, InsuranceError::InsufficientShares);
    let assets = (shares as u128)
        .checked_mul(total_assets as u128)
        .ok_or(InsuranceError::MathOverflow)?
        / total_shares as u128;
    u64::try_from(assets).map_err(|_| InsuranceError::MathOverflow.into())
}

/// Compares `price x 10^price_expo` with `strike x 10^strike_expo` without losing precision.
fn scaled_pair(price: i64, price_expo: i32, strike: i64, strike_expo: i32) -> Result<(i128, i128)> {
    let gap = price_expo.abs_diff(strike_expo);
    require!(gap <= MAX_EXPONENT_GAP, InsuranceError::InvalidPrice);
    let factor = 10i128.pow(gap);
    let (price, strike) = (price as i128, strike as i128);
    if price_expo >= strike_expo {
        Ok((price.checked_mul(factor).ok_or(InsuranceError::MathOverflow)?, strike))
    } else {
        Ok((price, strike.checked_mul(factor).ok_or(InsuranceError::MathOverflow)?))
    }
}

/// Trigger level: the reference price lowered (below-covers) or raised (above-covers) by the threshold.
pub fn strike_for(trigger: Trigger, reference_price: i64, threshold_bps: u16) -> Result<i64> {
    let factor = match trigger {
        Trigger::PriceBelow => BPS - threshold_bps as u64,
        Trigger::PriceAbove => BPS + threshold_bps as u64,
    };
    let strike = (reference_price as i128)
        .checked_mul(factor as i128)
        .ok_or(InsuranceError::MathOverflow)?
        / BPS as i128;
    i64::try_from(strike).map_err(|_| InsuranceError::MathOverflow.into())
}

/// Whether a Pyth price satisfies a price trigger against the policy's strike.
pub fn price_triggers(
    trigger: Trigger,
    price: i64,
    price_expo: i32,
    strike: i64,
    strike_expo: i32,
) -> Result<bool> {
    require!(price > 0, InsuranceError::InvalidPrice);
    let (p, s) = scaled_pair(price, price_expo, strike, strike_expo)?;
    match trigger {
        Trigger::PriceBelow => Ok(p <= s),
        Trigger::PriceAbove => Ok(p >= s),
    }
}
