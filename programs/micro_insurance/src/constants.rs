use anchor_lang::prelude::*;

pub const POOL_SEED: &[u8] = b"pool";
pub const VAULT_SEED: &[u8] = b"vault";
pub const PRODUCT_SEED: &[u8] = b"product";
pub const POLICY_SEED: &[u8] = b"policy";
pub const LP_SEED: &[u8] = b"lp";
pub const MINT_AUTHORITY_SEED: &[u8] = b"mint-authority";

pub const BPS: u64 = 10_000;
/// If nobody settles a cover this long after its expiry, anyone can void it and refund the premium.
pub const VOID_AFTER: i64 = 7 * 24 * 60 * 60;
/// A Pyth price counts for a cover only if it was published within this many seconds after the expiry.
pub const OBSERVATION_WINDOW: i64 = 10 * 60;
/// The reference price read at purchase must be at most this many seconds old.
pub const MAX_PRICE_AGE: u64 = 60;
pub const MAX_NAME_LEN: usize = 48;
/// One cover may promise at most this share of the pool's capital (limits the damage of a correlated crash).
pub const MAX_COVER_SHARE_BPS: u64 = 2_000;
/// The protected move may be at most 90% (an unreachable threshold would be a free premium, not a protection).
pub const MAX_THRESHOLD_BPS: u16 = 9_000;
/// The longest lock-up an admin can set when creating a pool.
pub const MAX_LOCKUP_SECONDS: i64 = 30 * 24 * 60 * 60;
/// Devnet faucet: at most 10 000 tUSDC (6 decimals) per call.
pub const FAUCET_MAX: u64 = 10_000 * 1_000_000;
/// Largest exponent difference accepted when comparing a price with a strike.
pub const MAX_EXPONENT_GAP: u32 = 18;

#[constant]
pub const TOKEN_DECIMALS: u8 = 6;
