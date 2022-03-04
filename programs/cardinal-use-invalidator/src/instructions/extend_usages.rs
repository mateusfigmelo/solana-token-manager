use {
    crate::{errors::ErrorCode, state::*},
    anchor_lang::prelude::*,
    anchor_spl::token::{self, Token, TokenAccount, Transfer},
    cardinal_token_manager::state::{TokenManager, TokenManagerState},
  };
  
  #[derive(Accounts)]
  pub struct ExtendUsagesCtx<'info> {
    #[account(constraint = token_manager.state == TokenManagerState::Claimed as u8 @ ErrorCode::InvalidTokenManager)]
    token_manager: Box<Account<'info, TokenManager>>,
  
    #[account(mut, constraint = use_invalidator.token_manager == token_manager.key() @ ErrorCode::InvalidUseInvalidator)]
    use_invalidator: Box<Account<'info, UseInvalidator>>,
  
    #[account(mut, constraint =
        payment_token_account.owner == token_manager.key()
        && payment_token_account.mint == use_invalidator.extension_payment_mint.unwrap()
        @ ErrorCode::InvalidPaymentTokenAccount,
    )]
    payment_token_account: Box<Account<'info, TokenAccount>>,
  
    #[account(mut)]
    payer: Signer<'info>,
    #[account(mut, constraint =
        payer_token_account.owner == payer.key()
        && payer_token_account.mint == use_invalidator.extension_payment_mint.unwrap()
        @ ErrorCode::InvalidPayerTokenAccount
    )]
    payer_token_account: Box<Account<'info, TokenAccount>>,
  
    token_program: Program<'info, Token>,
  }
  
  pub fn handler(ctx: Context<ExtendUsagesCtx>, payment_amount: u64) -> Result<()> {
    let use_invalidator = &mut ctx.accounts.use_invalidator;
  
    if use_invalidator.extension_payment_amount == None
      || use_invalidator.extension_usages == None
      || use_invalidator.extension_payment_mint == None
      || use_invalidator.total_usages == None
    {
      return Err(error!(ErrorCode::InvalidUseInvalidator));
    }
  
    let new_total_usages = Some(use_invalidator.total_usages.unwrap() + use_invalidator.extension_usages.unwrap());    
    if new_total_usages > use_invalidator.max_usages {
      return Err(error!(ErrorCode::MaxUsagesReached));
    }
  
    let cpi_accounts = Transfer {
      from: ctx.accounts.payer_token_account.to_account_info(),
      to: ctx.accounts.payment_token_account.to_account_info(),
      authority: ctx.accounts.payer.to_account_info(),
    };
  
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_context, payment_amount)?;
  
    use_invalidator.total_usages = new_total_usages;
    return Ok(());
  }
  