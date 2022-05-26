/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BN, web3 } from "@project-serum/anchor";
import { expectTXTable } from "@saberhq/chai-solana";
import {
  SignerWallet,
  SolanaProvider,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import type { Token } from "@solana/spl-token";
import * as splToken from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

import { findAta, rentals, tryGetAccount } from "../src";
import { timeInvalidator, tokenManager } from "../src/programs";
import { getClaimApprover } from "../src/programs/claimApprover/accounts";
import { getPaymentManager } from "../src/programs/paymentManager/accounts";
import { init } from "../src/programs/paymentManager/instruction";
import { findPaymentManagerAddress } from "../src/programs/paymentManager/pda";
import { TokenManagerState } from "../src/programs/tokenManager";
import { createMint } from "./utils";
import { getProvider } from "./workspace";

describe("Create and Extend Rental", () => {
  const RECIPIENT_START_PAYMENT_AMOUNT = 100000;
  const RENTAL_PAYMENT_AMONT = 10000;
  const recipient = Keypair.generate();
  const tokenCreator = Keypair.generate();
  const paymentManagerName = Math.random().toString(36).slice(2, 7);
  const feeCollector = Keypair.generate();
  let recipientPaymentTokenAccountId: PublicKey;
  let issuerTokenAccountId: PublicKey;
  let paymentMint: Token;
  let rentalMint: Token;
  let expiration: number;
  let paymentManagerId: PublicKey;

  before(async () => {
    const provider = getProvider();
    const airdropCreator = await provider.connection.requestAirdrop(
      tokenCreator.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropCreator);

    const airdropRecipient = await provider.connection.requestAirdrop(
      recipient.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropRecipient);

    // create payment mint
    [recipientPaymentTokenAccountId, paymentMint] = await createMint(
      provider.connection,
      tokenCreator,
      recipient.publicKey,
      RECIPIENT_START_PAYMENT_AMOUNT
    );

    // create rental mint
    [issuerTokenAccountId, rentalMint] = await createMint(
      provider.connection,
      tokenCreator,
      provider.wallet.publicKey,
      1,
      provider.wallet.publicKey
    );
  });

  it("Create payment manager", async () => {
    const provider = getProvider();
    const transaction = new web3.Transaction();

    const mintBalanceNeeded =
      await splToken.Token.getMinBalanceRentForExemptMint(provider.connection);
    transaction.add(
      web3.SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: feeCollector.publicKey,
        lamports: mintBalanceNeeded,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        space: splToken.MintLayout.span,
        programId: splToken.TOKEN_PROGRAM_ID,
      })
    );

    const [ix, outPaymentManagerId] = await init(
      provider.connection,
      provider.wallet,
      paymentManagerName,
      {
        feeCollector: feeCollector.publicKey,
        makerFee: new BN(5),
        takerFee: new BN(3),
        feeDecimals: 2,
      }
    );
    paymentManagerId = outPaymentManagerId;

    transaction.add(ix);
    const txEnvelope = new TransactionEnvelope(
      SolanaProvider.init({
        connection: provider.connection,
        wallet: provider.wallet,
        opts: provider.opts,
      }),
      [...transaction.instructions],
      [feeCollector]
    );
    await expectTXTable(txEnvelope, "Create Payment Manager", {
      verbosity: "error",
      formatLogs: true,
    }).to.be.fulfilled;

    const [checkPaymentManagerId] = await findPaymentManagerAddress(
      paymentManagerName
    );
    const paymentManagerData = await getPaymentManager(
      provider.connection,
      checkPaymentManagerId
    );
    expect(paymentManagerData.parsed.name).to.eq(paymentManagerName);
  });

  it("Create rental", async () => {
    const provider = getProvider();
    const [transaction, tokenManagerId] = await rentals.createRental(
      provider.connection,
      provider.wallet,
      {
        claimPayment: {
          paymentAmount: RENTAL_PAYMENT_AMONT,
          paymentMint: paymentMint.publicKey,
          paymentManager: paymentManagerId,
        },
        timeInvalidation: {
          durationSeconds: 1000,
          maxExpiration: Date.now() / 1000 + 5000,
          extension: {
            extensionPaymentAmount: 1, // Pay 1 lamport to add 1000 seconds of expiration time
            extensionDurationSeconds: 1000,
            extensionPaymentMint: paymentMint.publicKey,
            disablePartialExtension: true,
          },
        },
        mint: rentalMint.publicKey,
        issuerTokenAccountId: issuerTokenAccountId,
        amount: new BN(1),
      }
    );
    const txEnvelope = new TransactionEnvelope(
      SolanaProvider.init({
        connection: provider.connection,
        wallet: provider.wallet,
        opts: provider.opts,
      }),
      [...transaction.instructions]
    );
    await expectTXTable(txEnvelope, "Create Rental", {
      verbosity: "error",
      formatLogs: true,
    }).to.be.fulfilled;

    const tokenManagerData = await tokenManager.accounts.getTokenManager(
      provider.connection,
      tokenManagerId
    );
    expect(tokenManagerData.parsed.state).to.eq(TokenManagerState.Issued);
    expect(tokenManagerData.parsed.amount.toNumber()).to.eq(1);
    expect(tokenManagerData.parsed.mint).to.eqAddress(rentalMint.publicKey);
    expect(tokenManagerData.parsed.invalidators).length.greaterThanOrEqual(1);
    expect(tokenManagerData.parsed.issuer).to.eqAddress(
      provider.wallet.publicKey
    );

    const claimApproverData = await getClaimApprover(
      provider.connection,
      tokenManagerData.pubkey
    );
    expect(claimApproverData.parsed.paymentManager.toString()).to.eq(
      paymentManagerId.toString()
    );
    console.log("paymentManagerId", paymentManagerId.toString());

    const checkIssuerTokenAccount = await rentalMint.getAccountInfo(
      issuerTokenAccountId
    );
    expect(checkIssuerTokenAccount.amount.toNumber()).to.eq(0);

    // check receipt-index
    const tokenManagers = await tokenManager.accounts.getTokenManagersForIssuer(
      provider.connection,
      provider.wallet.publicKey
    );
    expect(tokenManagers.map((i) => i.pubkey.toString())).to.include(
      tokenManagerId.toString()
    );
  });

  it("Claim rental", async () => {
    const provider = getProvider();

    const tokenManagerId = await tokenManager.pda.tokenManagerAddressFromMint(
      provider.connection,
      rentalMint.publicKey
    );

    const transaction = await rentals.claimRental(
      provider.connection,
      new SignerWallet(recipient),
      tokenManagerId
    );

    const txEnvelope = new TransactionEnvelope(
      SolanaProvider.init({
        connection: provider.connection,
        wallet: new SignerWallet(recipient),
        opts: provider.opts,
      }),
      [...transaction.instructions]
    );

    const feeCollectorBefore = await provider.connection.getAccountInfo(
      feeCollector.publicKey
    );
    console.log("Claim Rental: before", feeCollectorBefore?.lamports);

    await expectTXTable(txEnvelope, "Claim Rental", {
      verbosity: "error",
      formatLogs: true,
    }).to.be.fulfilled;

    const tokenManagerData = await tokenManager.accounts.getTokenManager(
      provider.connection,
      tokenManagerId
    );
    expect(tokenManagerData.parsed.state).to.eq(TokenManagerState.Claimed);
    expect(tokenManagerData.parsed.amount.toNumber()).to.eq(1);

    const checkIssuerTokenAccount = await rentalMint.getAccountInfo(
      issuerTokenAccountId
    );
    expect(checkIssuerTokenAccount.amount.toNumber()).to.eq(0);

    const checkRecipientTokenAccount = await rentalMint.getAccountInfo(
      await findAta(rentalMint.publicKey, recipient.publicKey)
    );
    expect(checkRecipientTokenAccount.amount.toNumber()).to.eq(1);
    expect(checkRecipientTokenAccount.isFrozen).to.eq(true);

    const checkRecipientPaymentTokenAccount = await paymentMint.getAccountInfo(
      recipientPaymentTokenAccountId
    );
    expect(checkRecipientPaymentTokenAccount.amount.toNumber()).to.eq(
      RECIPIENT_START_PAYMENT_AMOUNT - RENTAL_PAYMENT_AMONT
    );

    const feeCollectorAfter = await provider.connection.getAccountInfo(
      feeCollector.publicKey
    );
    console.log("Claim Rental: after", feeCollectorAfter?.lamports);
  });

  it("Extend Rental", async () => {
    const provider = getProvider();
    const tokenManagerId = await tokenManager.pda.tokenManagerAddressFromMint(
      provider.connection,
      rentalMint.publicKey
    );

    let timeInvalidatorData = await tryGetAccount(async () =>
      timeInvalidator.accounts.getTimeInvalidator(
        provider.connection,
        (
          await timeInvalidator.pda.findTimeInvalidatorAddress(tokenManagerId)
        )[0]
      )
    );
    const tokenManagerData = await tryGetAccount(async () =>
      tokenManager.accounts.getTokenManager(provider.connection, tokenManagerId)
    );
    expiration =
      (timeInvalidatorData?.parsed.durationSeconds?.toNumber() || 0) +
      (tokenManagerData?.parsed.stateChangedAt.toNumber() || 0);

    const transaction = await rentals.extendRentalExpiration(
      provider.connection,
      new SignerWallet(recipient),
      tokenManagerId,
      1000
    );

    const txEnvelope = new TransactionEnvelope(
      SolanaProvider.init({
        connection: provider.connection,
        wallet: new SignerWallet(recipient),
        opts: provider.opts,
      }),
      [...transaction.instructions]
    );

    await expectTXTable(txEnvelope, "Extend Rental", {
      verbosity: "error",
      formatLogs: true,
    }).to.be.fulfilled;

    timeInvalidatorData = await tryGetAccount(async () =>
      timeInvalidator.accounts.getTimeInvalidator(
        provider.connection,
        (
          await timeInvalidator.pda.findTimeInvalidatorAddress(tokenManagerId)
        )[0]
      )
    );

    expect(timeInvalidatorData?.parsed.expiration?.toNumber()).to.eq(
      expiration + 1000
    );
  });
});
