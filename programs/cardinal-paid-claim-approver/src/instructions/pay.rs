use {
    crate::{errors::ErrorCode, state::*},
    anchor_lang::prelude::*,
    anchor_spl::token::{self, Token, TokenAccount, Transfer},
    cardinal_token_manager::{
        program::CardinalTokenManager,
        state::{assert_payment_manager, TokenManager, FEE_SCALE, PROVIDER_FEE, RECIPIENT_FEE},
        utils::assert_payment_token_account,
    },
};

#[derive(Accounts)]
pub struct PayCtx<'info> {
    #[account(constraint = claim_approver.key() == token_manager.claim_approver.unwrap() @ ErrorCode::InvalidTokenManager)]
    token_manager: Box<Account<'info, TokenManager>>,

    #[account(mut, constraint = payment_token_account.mint == claim_approver.payment_mint @ ErrorCode::InvalidPaymentTokenAccount)]
    payment_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = payment_manager_token_account.mint == claim_approver.payment_mint && assert_payment_manager(&payment_manager_token_account.owner) @ ErrorCode::InvalidPaymentManagerTokenAccount)]
    payment_manager_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    claim_approver: Box<Account<'info, PaidClaimApprover>>,

    #[account(mut)]
    payer: Signer<'info>,
    #[account(mut, constraint =
        payer_token_account.owner == payer.key()
        && payer_token_account.mint == claim_approver.payment_mint
        @ ErrorCode::InvalidPayerTokenAccount
    )]
    payer_token_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    claim_receipt: UncheckedAccount<'info>,
    cardinal_token_manager: Program<'info, CardinalTokenManager>,

    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<PayCtx>) -> Result<()> {
    let remaining_accs = &mut ctx.remaining_accounts.iter();
    assert_payment_token_account(&ctx.accounts.payment_token_account, &ctx.accounts.token_manager, remaining_accs)?;

    let provider_fee = ctx.accounts.claim_approver.payment_amount * (PROVIDER_FEE / FEE_SCALE);
    let recipient_fee = ctx.accounts.claim_approver.payment_amount * (RECIPIENT_FEE / FEE_SCALE);
    if provider_fee.checked_add(recipient_fee).unwrap() > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.payer_token_account.to_account_info(),
            to: ctx.accounts.payment_manager_token_account.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_context, provider_fee.checked_add(recipient_fee).unwrap())?;
    }

    let cpi_accounts = Transfer {
        from: ctx.accounts.payer_token_account.to_account_info(),
        to: ctx.accounts.payment_token_account.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_context, ctx.accounts.claim_approver.payment_amount.checked_sub(recipient_fee).unwrap())?;

    let token_manager_key = ctx.accounts.token_manager.key();
    let claim_approver_seeds = &[PAID_CLAIM_APPROVER_SEED.as_bytes(), token_manager_key.as_ref(), &[ctx.accounts.claim_approver.bump]];
    let claim_approver_signer = &[&claim_approver_seeds[..]];

    // approve
    let cpi_accounts = cardinal_token_manager::cpi::accounts::CreateClaimReceiptCtx {
        token_manager: ctx.accounts.token_manager.to_account_info(),
        claim_approver: ctx.accounts.claim_approver.to_account_info(),
        claim_receipt: ctx.accounts.claim_receipt.to_account_info(),
        payer: ctx.accounts.payer.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.cardinal_token_manager.to_account_info(), cpi_accounts).with_signer(claim_approver_signer);
    cardinal_token_manager::cpi::create_claim_receipt(cpi_ctx, ctx.accounts.payer.key())?;
    Ok(())
}
