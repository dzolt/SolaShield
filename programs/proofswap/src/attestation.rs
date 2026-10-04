use anchor_lang::prelude::*;
use solana_instructions_sysvar::{load_current_index_checked, load_instruction_at_checked};

use crate::constants::{ATTESTATION_PREFIX, ED25519_PROGRAM_ID, MAX_ATTESTATION_AGE};
use crate::error::ProofSwapError;
use crate::state::AttestationKind;

/// The exact bytes the attestor signs: prefix | deal | kind | steam_id (u64 LE) | observed_at (i64 LE) | sha256(evidence).
/// The Steam account is part of the message so that an observation of one account cannot stand in for another.
pub fn attestation_message(
    deal: &Pubkey,
    kind: AttestationKind,
    steam_id: u64,
    observed_at: i64,
    evidence_hash: &[u8; 32],
) -> Vec<u8> {
    let mut message = Vec::with_capacity(ATTESTATION_PREFIX.len() + 32 + 1 + 8 + 8 + 32);
    message.extend_from_slice(ATTESTATION_PREFIX);
    message.extend_from_slice(deal.as_ref());
    message.push(kind as u8);
    message.extend_from_slice(&steam_id.to_le_bytes());
    message.extend_from_slice(&observed_at.to_le_bytes());
    message.extend_from_slice(evidence_hash);
    message
}

/// The observation must not be from the future and must be at most 10 minutes old.
pub fn require_fresh(observed_at: i64, now: i64) -> Result<()> {
    require!(observed_at <= now, ProofSwapError::StaleAttestation);
    let age = now.checked_sub(observed_at).ok_or(ProofSwapError::MathOverflow)?;
    require!(age <= MAX_ATTESTATION_AGE, ProofSwapError::StaleAttestation);
    Ok(())
}

/// Checks that the instruction right before this one is the native Ed25519 program verifying the attestor's
/// signature over `expected`. That program fails the whole transaction if the signature is invalid, so here we
/// only confirm what it verified: the right key and the right message, both inside that same instruction.
pub fn require_attestation(instructions: &AccountInfo, attestor: &Pubkey, expected: &[u8]) -> Result<()> {
    let current = load_current_index_checked(instructions)?;
    require!(current > 0, ProofSwapError::MissingAttestation);
    let ix = load_instruction_at_checked(usize::from(current - 1), instructions)?;
    require_keys_eq!(ix.program_id, ED25519_PROGRAM_ID, ProofSwapError::MissingAttestation);

    // Layout: num_signatures (u8), padding (u8), then one 14-byte offsets record.
    let data = &ix.data;
    require!(data.len() >= 16 && data[0] == 1, ProofSwapError::MissingAttestation);
    let read = |at: usize| usize::from(u16::from_le_bytes([data[at], data[at + 1]]));
    let signature_ix = read(4);
    let key_offset = read(6);
    let key_ix = read(8);
    let message_offset = read(10);
    let message_size = read(12);
    let message_ix = read(14);
    // Key, signature and message must all live in this Ed25519 instruction (index u16::MAX), not elsewhere.
    let here = usize::from(u16::MAX);
    require!(
        signature_ix == here && key_ix == here && message_ix == here,
        ProofSwapError::MissingAttestation
    );
    require!(
        data.len() >= key_offset + 32 && data.len() >= message_offset + message_size,
        ProofSwapError::MissingAttestation
    );
    require!(&data[key_offset..key_offset + 32] == attestor.as_ref(), ProofSwapError::WrongAttestor);
    require!(
        &data[message_offset..message_offset + message_size] == expected,
        ProofSwapError::AttestationMismatch
    );
    Ok(())
}
