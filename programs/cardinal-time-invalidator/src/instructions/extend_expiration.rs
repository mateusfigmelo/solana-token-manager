use {
  crate::{errors::*, state::*},
  anchor_lang::prelude::*,
  anchor_spl::token::{self, Token, TokenAccount, Transfer},
  cardinal_token_manager::state::{TokenManager, TokenManagerState},
};

#[derive(Accounts)]
pub struct ExtendExpirationCtx<'info> {
  #[account(constraint = token_manager.state == TokenManagerState::Claimed as u8 @ ErrorCode::InvalidTokenManager)]
  token_manager: Box<Account<'info, TokenManager>>,

  #[account(mut, constraint =
      token_manager.payment_mint != None
      && payment_token_account.owner == token_manager.key()
      && payment_token_account.mint == token_manager.payment_mint.unwrap()
      @ ErrorCode::InvalidPaymentTokenAccount,
  )]
  payment_token_account: Box<Account<'info, TokenAccount>>,

  #[account(mut)]
  payer: Signer<'info>,
  #[account(mut, constraint =
      payer_token_account.owner == payer.key()
      && payer_token_account.mint == token_manager.payment_mint.unwrap()
      @ ErrorCode::InvalidPayerTokenAccount
  )]
  payer_token_account: Box<Account<'info, TokenAccount>>,

  token_program: Program<'info, Token>,
  system_program: Program<'info, System>,

  #[account(mut, constraint = time_invalidator.token_manager == token_manager.key() @ ErrorCode::InvalidTimeInvalidator)]
  time_invalidator: Box<Account<'info, TimeInvalidator>>,
}

pub fn handler(ctx: Context<ExtendExpirationCtx>, payment_amount: u64) -> ProgramResult {
  let time_invalidator = &mut ctx.accounts.time_invalidator;

  if time_invalidator.extension_payment_amount.is_none()
    || time_invalidator.extension_duration.is_none()
  {
    return Err(ErrorCode::InvalidTimeInvalidator.into());
  }

  let cpi_accounts = Transfer {
    from: ctx.accounts.payer_token_account.to_account_info(),
    to: ctx.accounts.payment_token_account.to_account_info(),
    authority: ctx.accounts.payer.to_account_info(),
  };

  let cpi_program = ctx.accounts.token_program.to_account_info();
  let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
  token::transfer(cpi_context, payment_amount)?;

  let time_to_add = payment_amount * time_invalidator.extension_duration.unwrap()
    / time_invalidator.extension_payment_amount.unwrap();
  time_invalidator.expiration = Some(time_invalidator.expiration.unwrap() + time_to_add as i64);
  return Ok(());
}
