use anchor_lang::prelude::*;

#[error_code]
pub enum WillError {
    #[msg("Each window must be between 1 second and 365 days")]
    InvalidWindow,
    #[msg("The amount must be greater than zero")]
    ZeroAmount,
    #[msg("Only the owner can do this")]
    NotOwner,
    #[msg("Only the guardian can do this")]
    NotGuardian,
    #[msg("The guardian cannot be the owner")]
    GuardianIsOwner,
    #[msg("The will is not in the right state for this step")]
    WrongStatus,
    #[msg("The list of heirs is final and cannot be changed")]
    BeneficiariesLocked,
    #[msg("Give between 1 and 10 heirs")]
    InvalidBeneficiaryCount,
    #[msg("Every share must be above 0 and all shares must add up to 100%")]
    InvalidShares,
    #[msg("Each heir may appear once and cannot be the owner")]
    InvalidBeneficiary,
    #[msg("Name at least one heir first")]
    NoBeneficiaries,
    #[msg("The owner is still within the inactivity period, so there is nothing to veto")]
    NothingToVeto,
    #[msg("The guardian has used all vetoes; only the owner can reset the timer now")]
    NoVetoesLeft,
    #[msg("Too early: the owner still has time to check in")]
    ClaimNotOpen,
    #[msg("No heir with this number")]
    BadIndex,
    #[msg("This heir's share has already been paid")]
    AlreadyClaimed,
    #[msg("The token account does not belong to this heir")]
    WrongRecipient,
    #[msg("Not enough money in the vault")]
    InsufficientFunds,
    #[msg("Math overflow")]
    MathOverflow,
}
