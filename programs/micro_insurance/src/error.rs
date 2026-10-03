use anchor_lang::prelude::*;

#[error_code]
pub enum InsuranceError {
    #[msg("Invalid product parameters")]
    InvalidProduct,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Not enough pool shares")]
    InsufficientShares,
    #[msg("This capital backs active covers and cannot be withdrawn now")]
    CapitalReserved,
    #[msg("The pool has too little capital to cover this payout")]
    InsufficientCapacity,
    #[msg("One cover may promise at most 20% of the pool's capital")]
    CoverTooLarge,
    #[msg("The protected move must be between 0% and 90%")]
    InvalidThreshold,
    #[msg("Too late to buy: the event is sooner than the product's lead time")]
    TooLateToInsure,
    #[msg("The cover is not active")]
    PolicyNotActive,
    #[msg("The price was published outside the observation window of this cover")]
    PriceOutsideWindow,
    #[msg("The price update is not fully verified")]
    PriceNotVerified,
    #[msg("The price update is for a different feed")]
    WrongPriceFeed,
    #[msg("The price update is too old or belongs to a different feed")]
    StalePrice,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Too early to void: wait until 7 days after the event")]
    TooEarlyToVoid,
    #[msg("The pool is empty and does not accept deposits")]
    PoolInsolvent,
    #[msg("The faucet gives at most 10 000 tUSDC at a time")]
    FaucetLimit,
    #[msg("Your deposit is locked: you can withdraw after the lock-up ends")]
    LiquidityLocked,
    #[msg("The lock-up must be between 0 and 30 days")]
    InvalidLockup,
    #[msg("Math overflow")]
    MathOverflow,
}
