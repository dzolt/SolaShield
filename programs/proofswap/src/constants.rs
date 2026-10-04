use anchor_lang::prelude::*;

pub const CONFIG_SEED: &[u8] = b"config";
pub const DEAL_SEED: &[u8] = b"deal";
pub const VAULT_SEED: &[u8] = b"vault";

/// Every message the attestor signs starts with this, so a signature made for anything else cannot be replayed here.
pub const ATTESTATION_PREFIX: &[u8] = b"proofswap-v2:";
/// An observation counts only if it is at most this old when it reaches the program.
pub const MAX_ATTESTATION_AGE: i64 = 10 * 60;
/// Longest window the config may set (delivery, protection or grace).
pub const MAX_WINDOW_SECONDS: i64 = 30 * 24 * 60 * 60;
pub const MAX_ITEM_NAME_LEN: usize = 64;
pub const MAX_WEAR_LEN: usize = 24;

/// The native program that checks Ed25519 signatures; the attestation must be verified by it in the same transaction.
pub const ED25519_PROGRAM_ID: Pubkey = pubkey!("Ed25519SigVerify111111111111111111111111111");
/// The instructions sysvar, read to find that signature check.
pub const INSTRUCTIONS_SYSVAR_ID: Pubkey = pubkey!("Sysvar1nstructions1111111111111111111111111");
