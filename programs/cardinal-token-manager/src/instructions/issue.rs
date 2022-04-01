use {
    crate::{errors::ErrorCode, state::*},
    anchor_lang::prelude::*,
    anchor_spl::token::{self, Token, TokenAccount, Transfer},
};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct IssueIx {
    pub amount: u64,
    pub kind: u8,
    pub invalidation_type: u8,
}

#[derive(Accounts)]
#[instruction(ix: IssueIx)]
pub struct IssueCtx<'info> {
    #[account(mut, constraint = token_manager.state == TokenManagerState::Initialized as u8 @ ErrorCode::InvalidTokenManagerState)]
    token_manager: Box<Account<'info, TokenManager>>,
    #[account(mut, constraint = token_manager_token_account.owner == token_manager.key() @ ErrorCode::InvalidTokenManagerTokenAccount)]
    token_manager_token_account: Box<Account<'info, TokenAccount>>,

    // issuer
    #[account(constraint = issuer.key() == token_manager.issuer @ ErrorCode::InvalidIssuer)]
    issuer: Signer<'info>,
    #[account(mut, constraint = issuer_token_account.mint == token_manager.mint && issuer_token_account.owner == issuer.key() @ ErrorCode::InvalidIssuerTokenAccount)]
    issuer_token_account: Box<Account<'info, TokenAccount>>,

    // other
    #[account(mut)]
    payer: Signer<'info>,
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<IssueCtx>, ix: IssueIx) -> Result<()> {
    if ix.kind != TokenManagerKind::Managed as u8 && ix.kind != TokenManagerKind::Unmanaged as u8 && ix.kind != TokenManagerKind::Edition as u8 {
        return Err(error!(ErrorCode::InvalidTokenManagerKind));
    }
    if ix.invalidation_type != InvalidationType::Return as u8 && ix.invalidation_type != InvalidationType::Invalidate as u8 {
        return Err(error!(ErrorCode::InvalidInvalidationType));
    }

    // set token manager data
    let token_manager = &mut ctx.accounts.token_manager;
    token_manager.amount = ix.amount;
    token_manager.issuer = ctx.accounts.issuer.key();
    token_manager.kind = ix.kind;
    token_manager.recipient_token_account = ctx.accounts.token_manager_token_account.key();
    token_manager.invalidation_type = ix.invalidation_type;
    token_manager.state = TokenManagerState::Issued as u8;
    token_manager.state_changed_at = Clock::get().unwrap().unix_timestamp;

    // transfer token to token manager token account
    let cpi_accounts = Transfer {
        from: ctx.accounts.issuer_token_account.to_account_info(),
        to: ctx.accounts.token_manager_token_account.to_account_info(),
        authority: ctx.accounts.issuer.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_context, token_manager.amount)?;
    Ok(())
}
