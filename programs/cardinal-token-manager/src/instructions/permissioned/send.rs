use anchor_spl::{
    associated_token::{self, AssociatedToken},
    token::{self, FreezeAccount, Mint, ThawAccount, Token, TokenAccount, Transfer},
};
use mpl_token_metadata::utils::assert_derivation;

use solana_program::sysvar::{
    self,
    instructions::{get_instruction_relative, load_current_index_checked},
};
use spl_associated_token_account::get_associated_token_address;
use {
    crate::{errors::ErrorCode, state::*},
    anchor_lang::prelude::*,
};

#[derive(Accounts)]
pub struct SendCtx<'info> {
    #[account(mut, constraint = token_manager.kind == TokenManagerKind::Permissioned as u8 && token_manager.state == TokenManagerState::Claimed as u8 @ ErrorCode::InvalidTokenManagerState)]
    token_manager: Box<Account<'info, TokenManager>>,
    #[account(mut, constraint = mint.key() == token_manager.mint @ ErrorCode::InvalidMint)]
    mint: Box<Account<'info, Mint>>,
    #[account(mut, seeds = [MINT_MANAGER_SEED.as_bytes(), mint.key().as_ref()], bump)]
    mint_manager: Account<'info, MintManager>,

    #[account(mut)]
    recipient: Signer<'info>,
    #[account(mut, constraint =
        recipient_token_account.owner == recipient.key()
        && recipient_token_account.mint == token_manager.mint
        && recipient_token_account.key() == token_manager.recipient_token_account.key()
        @ ErrorCode::InvalidRecipientTokenAccount
    )]
    recipient_token_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is not dangerous because the account is checked in the instruction handler
    target: UncheckedAccount<'info>,
    /// CHECK: This is not dangerous because the account is checked in the instruction handler
    #[account(mut)]
    target_token_account: UncheckedAccount<'info>,
    #[account(mut)]
    payer: Signer<'info>,

    associated_token_program: Program<'info, AssociatedToken>,
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
    /// CHECK: This is not dangerous because the ID is checked with instructions sysvar
    #[account(address = sysvar::instructions::id())]
    instructions: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<SendCtx>) -> Result<()> {
    let instructions_account_info = ctx.accounts.instructions.to_account_info();
    let current_ix = load_current_index_checked(&instructions_account_info).expect("Error computing current index");
    if current_ix != 0_u16 {
        return Err(error!(ErrorCode::InstructionsDisallowed));
    }
    let next_ix = get_instruction_relative(1, &instructions_account_info);
    if next_ix.is_ok() {
        return Err(error!(ErrorCode::InstructionsDisallowed));
    }

    // Check ATA
    let associated_token_account = get_associated_token_address(&ctx.accounts.target.key(), &ctx.accounts.mint.key());
    if associated_token_account != ctx.accounts.target_token_account.key() {
        return Err(error!(ErrorCode::InvalidTargetTokenAccount));
    }
    if ctx.accounts.target_token_account.data_is_empty() {
        let cpi_accounts = associated_token::Create {
            payer: ctx.accounts.payer.to_account_info(),
            associated_token: ctx.accounts.target_token_account.to_account_info(),
            authority: ctx.accounts.target.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
        associated_token::create(cpi_context)?;
    }

    let mint = ctx.accounts.mint.key();
    let path = &[MINT_MANAGER_SEED.as_bytes(), mint.as_ref()];
    let bump_seed = assert_derivation(ctx.program_id, &ctx.accounts.mint_manager.to_account_info(), path)?;
    let mint_manager_seeds = &[MINT_MANAGER_SEED.as_bytes(), mint.as_ref(), &[bump_seed]];
    let mint_manager_signer = &[&mint_manager_seeds[..]];

    let cpi_accounts = ThawAccount {
        account: ctx.accounts.recipient_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        authority: ctx.accounts.mint_manager.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts).with_signer(mint_manager_signer);
    token::thaw_account(cpi_context)?;

    let cpi_accounts = Transfer {
        from: ctx.accounts.recipient_token_account.to_account_info(),
        to: ctx.accounts.target_token_account.to_account_info(),
        authority: ctx.accounts.recipient.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_context, ctx.accounts.token_manager.amount)?;

    let cpi_accounts = FreezeAccount {
        account: ctx.accounts.target_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        authority: ctx.accounts.mint_manager.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts).with_signer(mint_manager_signer);
    token::freeze_account(cpi_context)?;

    Ok(())
}
