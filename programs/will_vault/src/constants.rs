pub const CONFIG_SEED: &[u8] = b"config";
pub const WILL_SEED: &[u8] = b"will";
pub const VAULT_SEED: &[u8] = b"vault";

/// Shares are in basis points: 10 000 = 100%.
pub const TOTAL_BPS: u16 = 10_000;
/// Every heir is one account in the claim step, so the list stays short.
pub const MAX_BENEFICIARIES: usize = 10;
/// The guardian may push the payout back at most this many times between two signs of life from the owner.
pub const MAX_VETOES: u8 = 2;
/// Longest window the config may set (inactivity or claim period).
pub const MAX_WINDOW_SECONDS: i64 = 365 * 24 * 60 * 60;
