use anchor_lang::prelude::*;

#[error_code]
pub enum ProofSwapError {
    #[msg("The price must be greater than zero")]
    ZeroPrice,
    #[msg("The item name or wear is too long")]
    FieldTooLong,
    #[msg("A Steam ID is missing")]
    MissingSteamId,
    #[msg("Only items with a wear rating (float, e.g. 0.1320) are unique and can be listed")]
    InvalidWear,
    #[msg("Steam has not yet confirmed that the item is in the seller's inventory")]
    ListingNotVerified,
    #[msg("Each window must be between 1 second and 30 days (grace may be 0)")]
    InvalidWindow,
    #[msg("The deal is not in the right state for this step")]
    WrongStatus,
    #[msg("The buyer and the seller must be different people and Steam accounts")]
    SameParty,
    #[msg("Only the seller can do this")]
    NotSeller,
    #[msg("Missing attestation: the previous instruction must be the Ed25519 check of the attestor's signature")]
    MissingAttestation,
    #[msg("The attestation was signed by a key that is not the configured attestor")]
    WrongAttestor,
    #[msg("The signed attestation does not match this deal, step, time or evidence")]
    AttestationMismatch,
    #[msg("The observation is in the future or older than 10 minutes")]
    StaleAttestation,
    #[msg("The observation is outside the time window of this step")]
    OutsideWindow,
    #[msg("This kind of attestation cannot be used for this step")]
    WrongAttestationKind,
    #[msg("Too early: the reversal window (protection plus grace) is still open")]
    ProtectionNotOver,
    #[msg("Too early: the seller still has time to deliver")]
    DeliveryWindowOpen,
    #[msg("Math overflow")]
    MathOverflow,
}
