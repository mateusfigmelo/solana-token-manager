use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Token account not owned by the use invalidator")]
    InvalidPaymentTokenAccount,
    #[msg("Token account not owned by the issuer")]
    InvalidPayerTokenAccount,
    #[msg("Token account not owned by the issuer")]
    InvalidTokenAccount,
    #[msg("User is not permitted to use")]
    InvalidUser,
    #[msg("Invalid token manager for this use invalidator")]
    InvalidTokenManager,
    #[msg("Usages at the maximum")]
    InsufficientUsages,
    #[msg("Invalid use invalidator")]
    InvalidUseInvalidator,
    #[msg("Max usages reached")]
    MaxUsagesReached,
}