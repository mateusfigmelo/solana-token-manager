import { init } from "@cardinal/payment-manager/dist/cjs/instruction";
import { findPaymentManagerAddress } from "@cardinal/payment-manager/dist/cjs/pda";
import {
  CreateMasterEditionV3,
  CreateMetadataV2,
  DataV2,
  MasterEdition,
  Metadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { expectTXTable } from "@saberhq/chai-solana";
import {
  SignerWallet,
  SolanaProvider,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import type { Token } from "@solana/spl-token";
import * as splToken from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { BN } from "bn.js";
import { expect } from "chai";

import {
  emptyWallet,
  findAta,
  withAcceptListing,
  withCreateListing,
  withInitMarketplace,
  withInitTransferAuthority,
  withWhitelistMarektplaces,
  withWrapToken,
} from "../../src";
import { findTokenManagerAddress } from "../../src/programs/tokenManager/pda";
import {
  getListing,
  getMarketplaceByName,
  getTransferAuthorityByName,
} from "../../src/programs/transferAuthority/accounts";
import { findMarketplaceAddress } from "../../src/programs/transferAuthority/pda";
import { createMint } from "../utils";
import { getProvider } from "../workspace";

describe("Allowed markeptlaces for transfer authority", () => {
  const transferAuthorityName = `lst-auth-${Math.random()}`;
  const marketplaceName = `mrkt-${Math.random()}`;

  const lister = Keypair.generate();
  const buyer = Keypair.generate();

  let rentalMint: Token;
  const rentalPaymentAmount = new BN(100);

  const paymentManagerName = `pm-${Math.random()}`;
  const feeCollector = Keypair.generate();
  const MAKER_FEE = new BN(500);
  const TAKER_FEE = new BN(0);
  const BASIS_POINTS_DIVISOR = new BN(10000);

  before(async () => {
    const provider = getProvider();

    const feeCollectorInfo = await provider.connection.requestAirdrop(
      feeCollector.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(feeCollectorInfo);
    const airdropLister = await provider.connection.requestAirdrop(
      lister.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropLister);
    const airdropBuyer = await provider.connection.requestAirdrop(
      buyer.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropBuyer);

    // create rental mint
    [, rentalMint] = await createMint(
      provider.connection,
      lister,
      lister.publicKey,
      1,
      lister.publicKey
    );

    const metadataId = await Metadata.getPDA(rentalMint.publicKey);
    const metadataTx = new CreateMetadataV2(
      { feePayer: lister.publicKey },
      {
        metadata: metadataId,
        metadataData: new DataV2({
          name: "test",
          symbol: "TST",
          uri: "http://test/",
          sellerFeeBasisPoints: 10,
          creators: null,
          collection: null,
          uses: null,
        }),
        updateAuthority: lister.publicKey,
        mint: rentalMint.publicKey,
        mintAuthority: lister.publicKey,
      }
    );

    const masterEditionId = await MasterEdition.getPDA(rentalMint.publicKey);
    const masterEditionTx = new CreateMasterEditionV3(
      { feePayer: lister.publicKey },
      {
        edition: masterEditionId,
        metadata: metadataId,
        updateAuthority: lister.publicKey,
        mint: rentalMint.publicKey,
        mintAuthority: lister.publicKey,
        maxSupply: new BN(1),
      }
    );

    const txEnvelope = new TransactionEnvelope(
      SolanaProvider.init({
        connection: provider.connection,
        wallet: new SignerWallet(lister),
        opts: provider.opts,
      }),
      [...metadataTx.instructions, ...masterEditionTx.instructions]
    );

    await expectTXTable(txEnvelope, "Create Token", {
      verbosity: "error",
      formatLogs: true,
    }).to.be.fulfilled;

    const [paymentManagerId] = await findPaymentManagerAddress(
      paymentManagerName
    );
    const ix = init(provider.connection, provider.wallet, paymentManagerName, {
      paymentManagerId: paymentManagerId,
      feeCollector: feeCollector.publicKey,
      makerFeeBasisPoints: MAKER_FEE.toNumber(),
      takerFeeBasisPoints: TAKER_FEE.toNumber(),
      includeSellerFeeBasisPoints: false,
      authority: provider.wallet.publicKey,
      payer: provider.wallet.publicKey,
    });
    const pmTxEnvelope = new TransactionEnvelope(
      SolanaProvider.init({
        connection: provider.connection,
        wallet: provider.wallet,
        opts: provider.opts,
      }),
      [ix]
    );

    await expectTXTable(pmTxEnvelope, "Create Payment Manager", {
      verbosity: "error",
      formatLogs: true,
    }).to.be.fulfilled;
  });

  it("Create Transfer Authority", async () => {
    const provider = getProvider();
    const transaction = new Transaction();

    await withInitTransferAuthority(
      transaction,
      provider.connection,
      provider.wallet,
      transferAuthorityName
    );

    const txEnvelope = new TransactionEnvelope(
      SolanaProvider.init({
        connection: provider.connection,
        wallet: provider.wallet,
        opts: provider.opts,
      }),
      [...transaction.instructions]
    );
    await expectTXTable(txEnvelope, "Create transfer authority", {
      verbosity: "error",
      formatLogs: true,
    }).to.be.fulfilled;

    const checkTransferAuthority = await getTransferAuthorityByName(
      provider.connection,
      transferAuthorityName
    );

    expect(checkTransferAuthority.parsed.name).to.eq(transferAuthorityName);
    expect(checkTransferAuthority.parsed.authority).to.eqAddress(
      provider.wallet.publicKey
    );
    expect(checkTransferAuthority.parsed.allowedMarketplaces).to.be.null;
  });

  it("Wrap Token", async () => {
    const provider = getProvider();
    const wrapTransaction = new Transaction();

    await withWrapToken(
      wrapTransaction,
      provider.connection,
      emptyWallet(lister.publicKey),
      rentalMint.publicKey,
      { transferAuthorityName: transferAuthorityName }
    );

    const wrapTxEnvelope = new TransactionEnvelope(
      SolanaProvider.init({
        connection: provider.connection,
        wallet: provider.wallet,
        opts: provider.opts,
      }),
      [...wrapTransaction.instructions],
      [lister]
    );

    await expectTXTable(wrapTxEnvelope, "Wrap Token", {
      verbosity: "error",
      formatLogs: true,
    }).to.be.fulfilled;

    const checkMint = new splToken.Token(
      provider.connection,
      rentalMint.publicKey,
      splToken.TOKEN_PROGRAM_ID,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      null
    );
    const mintTokenAccountId = await findAta(
      rentalMint.publicKey,
      lister.publicKey,
      true
    );
    const mintTokenAccount = await checkMint.getAccountInfo(mintTokenAccountId);
    expect(mintTokenAccount.amount.toNumber()).to.equal(1);
    expect(mintTokenAccount.isFrozen).to.be.true;
  });

  it("Create Marketplace", async () => {
    const provider = getProvider();
    const transaction = new Transaction();

    await withInitMarketplace(
      transaction,
      provider.connection,
      provider.wallet,
      marketplaceName,
      paymentManagerName
    );

    const txEnvelope = new TransactionEnvelope(
      SolanaProvider.init({
        connection: provider.connection,
        wallet: provider.wallet,
        opts: provider.opts,
      }),
      [...transaction.instructions]
    );
    await expectTXTable(txEnvelope, "create marketplace", {
      verbosity: "error",
      formatLogs: true,
    }).to.be.fulfilled;

    const checkMarketplace = await getMarketplaceByName(
      provider.connection,
      marketplaceName
    );

    expect(checkMarketplace.parsed.name).to.eq(marketplaceName);
    const [paymentManagerId] = await findPaymentManagerAddress(
      paymentManagerName
    );
    expect(checkMarketplace.parsed.paymentManager).to.eqAddress(
      paymentManagerId
    );
    expect(checkMarketplace.parsed.authority).to.eqAddress(
      provider.wallet.publicKey
    );
  });

  it("Whitelist random marketplace", async () => {
    const provider = getProvider();
    const transaction = new Transaction();

    await withWhitelistMarektplaces(
      transaction,
      provider.connection,
      provider.wallet,
      transferAuthorityName,
      ["some-random-name"]
    );

    const txEnvelope = new TransactionEnvelope(
      SolanaProvider.init({
        connection: provider.connection,
        wallet: provider.wallet,
        opts: provider.opts,
      }),
      [...transaction.instructions]
    );
    await expectTXTable(txEnvelope, "whitelist random marketplace", {
      verbosity: "error",
      formatLogs: true,
    }).to.be.fulfilled;

    const checkTransferAuthority = await getTransferAuthorityByName(
      provider.connection,
      transferAuthorityName
    );
    const [marketplaceId] = await findMarketplaceAddress("some-random-name");
    expect(checkTransferAuthority.parsed.allowedMarketplaces).to.be.eql([
      marketplaceId,
    ]);
  });

  it("Fail to Create Listing", async () => {
    const provider = getProvider();
    const transaction = new Transaction();

    await withCreateListing(
      transaction,
      provider.connection,
      emptyWallet(lister.publicKey),
      rentalMint.publicKey,
      marketplaceName,
      rentalPaymentAmount
    );

    const txEnvelope = new TransactionEnvelope(
      SolanaProvider.init({
        connection: provider.connection,
        wallet: provider.wallet,
        opts: provider.opts,
      }),
      [...transaction.instructions],
      [lister]
    );
    expect(async () => {
      await expectTXTable(txEnvelope, "fail to create listing", {
        verbosity: "error",
      }).to.be.rejectedWith(Error);
    });
  });

  it("Whitelist proper marketplace", async () => {
    const provider = getProvider();
    const transaction = new Transaction();

    await withWhitelistMarektplaces(
      transaction,
      provider.connection,
      provider.wallet,
      transferAuthorityName,
      [marketplaceName, "some-random-name"]
    );

    const txEnvelope = new TransactionEnvelope(
      SolanaProvider.init({
        connection: provider.connection,
        wallet: provider.wallet,
        opts: provider.opts,
      }),
      [...transaction.instructions]
    );
    await expectTXTable(txEnvelope, "whitelist propet marketplace", {
      verbosity: "error",
      formatLogs: true,
    }).to.be.fulfilled;

    const checkTransferAuthority = await getTransferAuthorityByName(
      provider.connection,
      transferAuthorityName
    );
    const [randomMarketplaceId] = await findMarketplaceAddress(
      "some-random-name"
    );
    const [marketplaceId] = await findMarketplaceAddress(marketplaceName);

    const marketplaces = (
      checkTransferAuthority.parsed.allowedMarketplaces as PublicKey[]
    ).map((m) => m.toString());
    expect(marketplaces).to.include(marketplaceId.toString());
    expect(marketplaces).to.include(randomMarketplaceId.toString());
  });

  it("Create Listing", async () => {
    const provider = getProvider();
    const transaction = new Transaction();

    await withCreateListing(
      transaction,
      provider.connection,
      emptyWallet(lister.publicKey),
      rentalMint.publicKey,
      marketplaceName,
      rentalPaymentAmount
    );

    const txEnvelope = new TransactionEnvelope(
      SolanaProvider.init({
        connection: provider.connection,
        wallet: provider.wallet,
        opts: provider.opts,
      }),
      [...transaction.instructions],
      [lister]
    );
    await expectTXTable(txEnvelope, "create listing", {
      verbosity: "error",
      formatLogs: true,
    }).to.be.fulfilled;

    const checkListing = await getListing(
      provider.connection,
      rentalMint.publicKey
    );

    expect(checkListing.parsed.lister).to.eqAddress(lister.publicKey);
    const [tokenManagerId] = await findTokenManagerAddress(
      rentalMint.publicKey
    );
    expect(checkListing.parsed.tokenManager).to.eqAddress(tokenManagerId);
    const [marketplaceId] = await findMarketplaceAddress(marketplaceName);
    expect(checkListing.parsed.marketplace).to.eqAddress(marketplaceId);
    expect(checkListing.parsed.paymentAmount.toNumber()).to.eq(
      rentalPaymentAmount.toNumber()
    );
    expect(checkListing.parsed.paymentMint).to.eqAddress(PublicKey.default);
  });

  it("Accept Listing", async () => {
    const provider = getProvider();
    const transaction = new Transaction();
    const checkListing = await getListing(
      provider.connection,
      rentalMint.publicKey
    );
    const listingInfo = await provider.connection.getAccountInfo(
      checkListing.pubkey
    );

    const beforeListerAmount =
      (await provider.connection.getAccountInfo(lister.publicKey))?.lamports ||
      0;
    const beforeFeeCollectorAmount =
      (await provider.connection.getAccountInfo(feeCollector.publicKey))
        ?.lamports || 0;

    await withAcceptListing(
      transaction,
      provider.connection,
      new SignerWallet(buyer),
      buyer.publicKey,
      rentalMint.publicKey,
      checkListing.parsed.paymentAmount,
      checkListing.parsed.paymentMint
    );

    const txEnvelope = new TransactionEnvelope(
      SolanaProvider.init({
        connection: provider.connection,
        wallet: new SignerWallet(buyer),
        opts: provider.opts,
      }),
      [...transaction.instructions]
    );
    await expectTXTable(txEnvelope, "create listing", {
      verbosity: "error",
      formatLogs: true,
    }).to.be.fulfilled;

    const buyerMintTokenAccountId = await findAta(
      rentalMint.publicKey,
      buyer.publicKey,
      true
    );
    const checkMRentalMint = new splToken.Token(
      provider.connection,
      rentalMint.publicKey,
      splToken.TOKEN_PROGRAM_ID,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      null
    );
    const buyerRentalMintTokenAccount = await checkMRentalMint.getAccountInfo(
      buyerMintTokenAccountId
    );
    expect(buyerRentalMintTokenAccount.amount.toNumber()).to.eq(1);
    expect(buyerRentalMintTokenAccount.isFrozen).to.be.true;

    const makerFee = rentalPaymentAmount
      .mul(MAKER_FEE)
      .div(BASIS_POINTS_DIVISOR);
    const takerFee = rentalPaymentAmount
      .mul(TAKER_FEE)
      .div(BASIS_POINTS_DIVISOR);
    const totalFees = makerFee.add(takerFee);

    const listerInfo = await provider.connection.getAccountInfo(
      lister.publicKey
    );
    expect(listerInfo?.lamports).to.eq(
      beforeListerAmount +
        rentalPaymentAmount.sub(makerFee).toNumber() +
        (listingInfo?.lamports || 0)
    );

    const feeCollectorInfo = await provider.connection.getAccountInfo(
      feeCollector.publicKey
    );
    expect(feeCollectorInfo?.lamports).to.eq(
      beforeFeeCollectorAmount + totalFees.toNumber()
    );
  });
});
