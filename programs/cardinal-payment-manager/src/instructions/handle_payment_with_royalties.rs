use {
    crate::{errors::ErrorCode, state::*},
    anchor_lang::prelude::*,
    anchor_spl::{
        associated_token::{self},
        token::{self, Mint, Token, TokenAccount, Transfer},
    },
    mpl_token_metadata::state::Metadata,
};

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct HandlePaymentWithRoyaltiesCtx<'info> {
    #[account(mut)]
    payment_manager: Box<Account<'info, PaymentManager>>,

    #[account(mut)]
    payer_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = fee_collector_token_account.owner == payment_manager.fee_collector @ ErrorCode::InvalidFeeCollectorTokenAccount)]
    fee_collector_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    payment_token_account: Box<Account<'info, TokenAccount>>,

    payment_mint: Box<Account<'info, Mint>>,
    mint: Box<Account<'info, Mint>>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    mint_metadata: AccountInfo<'info>,

    payer: Signer<'info>,
    token_program: Program<'info, Token>,
    rent: Sysvar<'info, Rent>,
    system_program: Program<'info, System>,
    // > Remaining accounts for each mint creator
    // creator address
    // creator token account
}

pub fn handler<'key, 'accounts, 'remaining, 'info>(ctx: Context<'key, 'accounts, 'remaining, 'info, HandlePaymentWithRoyaltiesCtx<'info>>, payment_amount: u64) -> Result<()> {
    let payment_manager = &mut ctx.accounts.payment_manager;

    let maker_fee = payment_amount
        .checked_mul(payment_manager.maker_fee_basis_points.into())
        .expect("Multiplication error")
        .checked_div(BASIS_POINTS_DIVISOR.into())
        .expect("Division error");
    let taker_fee = payment_amount
        .checked_mul(payment_manager.taker_fee_basis_points.into())
        .expect("Multiplication error")
        .checked_div(BASIS_POINTS_DIVISOR.into())
        .expect("Division error");

    if maker_fee.checked_add(taker_fee).expect("Add error") > 0 {
        let total_fees = maker_fee.checked_add(taker_fee).expect("Add error");
        let split_fees = total_fees.checked_mul(ROYALTY_FEE_SHARE).unwrap().checked_div(100).expect("Div error");

        let mint_metadata = Metadata::from_account_info(&ctx.accounts.mint_metadata.to_account_info())?;
        if mint_metadata.mint != ctx.accounts.mint.key() {
            return Err(error!(ErrorCode::InvalidMintMetadata));
        }

        let creators = mint_metadata.data.creators;
        if let Some(creators) = creators {
            let remaining_accs = &mut ctx.remaining_accounts.iter();
            for creator in creators {
                let creator_address_info = next_account_info(remaining_accs)?;
                if creator_address_info.key() != creator.address {
                    return Err(error!(ErrorCode::InvalidCreatorAddress));
                }
                let creator_token_account_info = next_account_info(remaining_accs)?;
                let creator_token_account = Account::<TokenAccount>::try_from(creator_token_account_info);
                if creator_token_account.is_err() {
                    // create associated token account for creator
                    let cpi_accounts = associated_token::Create {
                        payer: ctx.accounts.payer.to_account_info(),
                        associated_token: creator_token_account_info.to_account_info(),
                        authority: creator_address_info.to_account_info(),
                        mint: ctx.accounts.payment_mint.to_account_info(),
                        system_program: ctx.accounts.system_program.to_account_info(),
                        token_program: ctx.accounts.token_program.to_account_info(),
                        rent: ctx.accounts.rent.to_account_info(),
                    };
                    let cpi_program = ctx.accounts.token_program.to_account_info();
                    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
                    associated_token::create(cpi_context)?;
                } else {
                    let creator_token_account_unwrapped = creator_token_account?;
                    if creator_token_account_unwrapped.owner != creator.address && creator_token_account_unwrapped.mint != ctx.accounts.payment_mint.key() {
                        return Err(error!(ErrorCode::InvalidTokenAccount));
                    }
                }
                let share = u64::try_from(creator.share).expect("Could not cast u8 to u64");
                let creator_funds = split_fees.checked_mul(share).unwrap().checked_div(100).expect("Div error");

                let cpi_accounts = Transfer {
                    from: ctx.accounts.payer_token_account.to_account_info(),
                    to: creator_token_account_info.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                };
                let cpi_program = ctx.accounts.token_program.to_account_info();
                let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
                token::transfer(cpi_context, creator_funds)?;
            }

            let cpi_accounts = Transfer {
                from: ctx.accounts.payer_token_account.to_account_info(),
                to: ctx.accounts.fee_collector_token_account.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
            token::transfer(cpi_context, split_fees)?;
        }
    }

    let cpi_accounts = Transfer {
        from: ctx.accounts.payer_token_account.to_account_info(),
        to: ctx.accounts.payment_token_account.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_context, payment_amount.checked_sub(maker_fee).expect("Sub error"))?;

    Ok(())
}
