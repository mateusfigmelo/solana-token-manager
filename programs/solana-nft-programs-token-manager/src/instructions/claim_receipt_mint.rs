use crate::errors::ErrorCode;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::associated_token::{self};
use anchor_spl::token::Token;
use anchor_spl::token::{self};
use mpl_token_metadata::instructions::CreateMetadataAccountV3;
use mpl_token_metadata::instructions::CreateMetadataAccountV3InstructionArgs;
use mpl_token_metadata::types::Creator;
use mpl_token_metadata::types::DataV2;
use solana_program::program_pack::Pack;
use solana_program::system_instruction::create_account;

#[derive(Accounts)]
pub struct ClaimReceiptMintCtx<'info> {
    #[account(mut, constraint = token_manager.state == TokenManagerState::Issued as u8 @ ErrorCode::InvalidTokenManagerState)]
    token_manager: Box<Account<'info, TokenManager>>,

    // issuer
    #[account(mut, constraint = issuer.key() == token_manager.issuer @ ErrorCode::InvalidIssuer)]
    issuer: Signer<'info>,

    #[account(mut)]
    receipt_mint: Signer<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    receipt_mint_metadata: UncheckedAccount<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    recipient_token_account: UncheckedAccount<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(
        init_if_needed,
        payer = payer,
        seeds = [RECEIPT_MINT_MANAGER_SEED.as_bytes()], bump,
        space = RECEIPT_MINT_MANAGER_SIZE,
    )]
    receipt_mint_manager: Account<'info, ReceiptMintManager>,

    #[account(mut)]
    payer: Signer<'info>,
    token_program: Program<'info, Token>,
    associated_token: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(address = mpl_token_metadata::ID)]
    token_metadata_program: UncheckedAccount<'info>,
    rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<ClaimReceiptMintCtx>, name: String) -> Result<()> {
    // set token manager data
    let token_manager = &mut ctx.accounts.token_manager;
    token_manager.receipt_mint = Some(ctx.accounts.receipt_mint.key());

    // set receipt mint manager data
    let receipt_mint_manager = &mut ctx.accounts.receipt_mint_manager;
    receipt_mint_manager.bump = *ctx.bumps.get("receipt_mint_manager").unwrap();

    // get PDA seeds to sign with
    let receipt_mint_manager_seeds = &[RECEIPT_MINT_MANAGER_SEED.as_bytes(), &[ctx.accounts.receipt_mint_manager.bump]];
    let receipt_mint_manager_signer = &[&receipt_mint_manager_seeds[..]];

    // allocate receipt mint
    invoke(
        &create_account(
            ctx.accounts.payer.key,
            ctx.accounts.receipt_mint.key,
            ctx.accounts.rent.minimum_balance(spl_token::state::Mint::LEN),
            spl_token::state::Mint::LEN as u64,
            &spl_token::id(),
        ),
        &[ctx.accounts.payer.to_account_info(), ctx.accounts.receipt_mint.to_account_info()],
    )?;

    // initialize receipt mint
    let cpi_accounts = token::InitializeMint {
        mint: ctx.accounts.receipt_mint.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
    token::initialize_mint(cpi_context, 0, &ctx.accounts.receipt_mint_manager.key(), Some(&ctx.accounts.receipt_mint_manager.key()))?;

    // create metadata
    invoke_signed(
        &CreateMetadataAccountV3 {
            metadata: ctx.accounts.receipt_mint_metadata.key(),
            mint: ctx.accounts.receipt_mint.key(),
            mint_authority: ctx.accounts.receipt_mint_manager.key(),
            payer: ctx.accounts.payer.key(),
            update_authority: ctx.accounts.receipt_mint_manager.key(),
            system_program: ctx.accounts.system_program.key(),
            rent: Some(ctx.accounts.rent.key()),
        }
        .instruction(CreateMetadataAccountV3InstructionArgs {
            data: DataV2 {
                name: name,
                symbol: "RCP".to_string(),
                uri: "https://api.host.so/metadata/".to_string() + &ctx.accounts.token_manager.mint.to_string() + "?text=RENTED",
                seller_fee_basis_points: 0,
                creators: Some(vec![
                    Creator {
                        address: ctx.accounts.receipt_mint_manager.key(),
                        verified: true,
                        share: 50,
                    },
                    Creator {
                        address: ctx.accounts.issuer.key(),
                        verified: false,
                        share: 50,
                    },
                    Creator {
                        address: ctx.accounts.token_manager.key(),
                        verified: false,
                        share: 0,
                    },
                ]),
                collection: None,
                uses: None,
            },
            is_mutable: true,
            collection_details: None,
        }),
        &[
            ctx.accounts.receipt_mint_metadata.to_account_info(),
            ctx.accounts.receipt_mint.to_account_info(),
            ctx.accounts.receipt_mint_manager.to_account_info(),
            ctx.accounts.issuer.to_account_info(),
            ctx.accounts.receipt_mint_manager.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ],
        receipt_mint_manager_signer,
    )?;

    // create associated token account for recipient
    let cpi_accounts = associated_token::Create {
        payer: ctx.accounts.payer.to_account_info(),
        associated_token: ctx.accounts.recipient_token_account.to_account_info(),
        authority: ctx.accounts.issuer.to_account_info(),
        mint: ctx.accounts.receipt_mint.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
    associated_token::create(cpi_context)?;

    // mint single token to receipt_marker token account
    let cpi_accounts = token::MintTo {
        mint: ctx.accounts.receipt_mint.to_account_info(),
        to: ctx.accounts.recipient_token_account.to_account_info(),
        authority: ctx.accounts.receipt_mint_manager.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts).with_signer(receipt_mint_manager_signer);
    token::mint_to(cpi_context, 1)?;
    Ok(())
}
