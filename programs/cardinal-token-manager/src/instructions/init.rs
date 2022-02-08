use {
    crate::{state::*, errors::*},
    anchor_lang::{prelude::*},
    anchor_spl::{token::{TokenAccount}}
};

#[derive(Accounts)]
#[instruction(bump: u8, mint: Pubkey, num_invalidators: u8)]
pub struct InitCtx<'info> {
    #[account(
        mut,
        seeds = [MINT_COUNTER_SEED.as_bytes(), mint.as_ref()], bump = mint_counter.bump,
    )]
    mint_counter: Box<Account<'info, MintCounter>>,
    #[account(
        init,
        payer = issuer,
        seeds = [TOKEN_MANAGER_SEED.as_bytes(), mint.as_ref(), mint_counter.count.to_le_bytes().as_ref()], bump = bump,
        space = token_manager_size(num_invalidators as usize),
    )]
    token_manager: Box<Account<'info, TokenManager>>,

    #[account(mut)]
    issuer: Signer<'info>,
    #[account(mut, constraint =
        issuer_token_account.owner == issuer.key()
        && issuer_token_account.mint == mint
        && issuer_token_account.amount >= 1
        @ ErrorCode::InvalidIssuerTokenAccount
    )]
    issuer_token_account: Box<Account<'info, TokenAccount>>,

    system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitCtx>, bump: u8, mint: Pubkey,  num_invalidators: u8) -> ProgramResult {
    if num_invalidators > MAX_INVALIDATORS {
        return Err(ErrorCode::InvalidIssuerTokenAccount.into());
    }

    let token_manager = &mut ctx.accounts.token_manager;
    let mint_counter = &mut ctx.accounts.mint_counter;
    
    token_manager.bump = bump;
    token_manager.count = mint_counter.count;
    token_manager.num_invalidators = num_invalidators;
    token_manager.issuer = ctx.accounts.issuer.key();
    token_manager.mint = mint;
    token_manager.state = TokenManagerState::Initialized as u8;
    // default to itself to avoid someone not setting it
    token_manager.transfer_authority = Some(token_manager.key());

    mint_counter.count += 1;
    mint_counter.token_manager = token_manager.key();
    return Ok(())
}