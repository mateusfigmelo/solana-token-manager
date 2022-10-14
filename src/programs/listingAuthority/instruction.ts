import type { BN } from "@project-serum/anchor";
import { AnchorProvider, Program } from "@project-serum/anchor";
import type { Wallet } from "@saberhq/solana-contrib";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type {
  AccountMeta,
  Connection,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";

import { PAYMENT_MANAGER_ADDRESS } from "../paymentManager";
import { TOKEN_MANAGER_ADDRESS } from "../tokenManager";
import * as constants from "./constants";

export const inittransferAuthority = (
  connection: Connection,
  wallet: Wallet,
  name: string,
  transferAuthorityId: PublicKey,
  authorityId: PublicKey,
  payer = wallet.publicKey,
  allowedMarketplaces?: PublicKey[]
): TransactionInstruction => {
  const provider = new AnchorProvider(connection, wallet, {});

  const transferAuthorityProgram =
    new Program<constants.LISTING_AUTHORITY_PROGRAM>(
      constants.LISTING_AUTHORITY_IDL,
      constants.LISTING_AUTHORITY_ADDRESS,
      provider
    );

  return transferAuthorityProgram.instruction.initTransferAuthority(
    {
      name: name,
      authority: authorityId,
      allowedMarketplaces: allowedMarketplaces || null,
    },
    {
      accounts: {
        transferAuthority: transferAuthorityId,
        payer: payer,
        systemProgram: SystemProgram.programId,
      },
    }
  );
};

export const updatetransferAuthority = (
  connection: Connection,
  wallet: Wallet,
  transferAuthorityId: PublicKey,
  authority: PublicKey,
  allowedMarketplaces: PublicKey[]
): TransactionInstruction => {
  const provider = new AnchorProvider(connection, wallet, {});

  const transferAuthorityProgram =
    new Program<constants.LISTING_AUTHORITY_PROGRAM>(
      constants.LISTING_AUTHORITY_IDL,
      constants.LISTING_AUTHORITY_ADDRESS,
      provider
    );

  return transferAuthorityProgram.instruction.updateTransferAuthority(
    {
      authority: wallet.publicKey,
      allowedMarketplaces: allowedMarketplaces,
    },
    {
      accounts: {
        transferAuthority: transferAuthorityId,
        authority: authority,
      },
    }
  );
};

export const initMarketplace = (
  connection: Connection,
  wallet: Wallet,
  name: string,
  marketplaceId: PublicKey,
  transferAuthority: PublicKey,
  paymentManager: PublicKey,
  paymentMints: PublicKey[] | undefined,
  payer = wallet.publicKey
): TransactionInstruction => {
  const provider = new AnchorProvider(connection, wallet, {});

  const transferAuthorityProgram =
    new Program<constants.LISTING_AUTHORITY_PROGRAM>(
      constants.LISTING_AUTHORITY_IDL,
      constants.LISTING_AUTHORITY_ADDRESS,
      provider
    );

  return transferAuthorityProgram.instruction.initMarketplace(
    {
      name: name,
      paymentManager: paymentManager,
      authority: provider.wallet.publicKey,
      paymentMints: paymentMints || null,
      transferAuthority: transferAuthority,
    },
    {
      accounts: {
        marketplace: marketplaceId,
        payer: payer,
        systemProgram: SystemProgram.programId,
      },
    }
  );
};

export const updateMarketplace = (
  connection: Connection,
  wallet: Wallet,
  marketplace: PublicKey,
  transferAuthority: PublicKey,
  paymentManager: PublicKey,
  authority: PublicKey,
  paymentMints: PublicKey[] | undefined
): TransactionInstruction => {
  const provider = new AnchorProvider(connection, wallet, {});

  const transferAuthorityProgram =
    new Program<constants.LISTING_AUTHORITY_PROGRAM>(
      constants.LISTING_AUTHORITY_IDL,
      constants.LISTING_AUTHORITY_ADDRESS,
      provider
    );

  return transferAuthorityProgram.instruction.updateMarketplace(
    {
      transferAuthority: transferAuthority,
      paymentManager: paymentManager,
      authority: authority,
      paymentMints: paymentMints ?? null,
    },
    {
      accounts: {
        marketplace: marketplace,
        authority: provider.wallet.publicKey,
      },
    }
  );
};

export const createListing = (
  connection: Connection,
  wallet: Wallet,
  listingId: PublicKey,
  transferAuthorityId: PublicKey,
  tokenManagerId: PublicKey,
  marketplaceId: PublicKey,
  listerTokenAccount: PublicKey,
  paymentAmount: BN,
  paymentMint: PublicKey,
  payer = wallet.publicKey
): TransactionInstruction => {
  const provider = new AnchorProvider(connection, wallet, {});

  const transferAuthorityProgram =
    new Program<constants.LISTING_AUTHORITY_PROGRAM>(
      constants.LISTING_AUTHORITY_IDL,
      constants.LISTING_AUTHORITY_ADDRESS,
      provider
    );
  return transferAuthorityProgram.instruction.createListing(
    {
      paymentAmount: paymentAmount,
      paymentMint: paymentMint,
    },
    {
      accounts: {
        listing: listingId,
        tokenManager: tokenManagerId,
        transferAuthority: transferAuthorityId,
        marketplace: marketplaceId,
        listerTokenAccount: listerTokenAccount,
        lister: wallet.publicKey,
        payer: payer,
        systemProgram: SystemProgram.programId,
      },
    }
  );
};

export const updateListing = (
  connection: Connection,
  wallet: Wallet,
  listingId: PublicKey,
  marketplaceId: PublicKey,
  paymentAmount: BN,
  paymentMint: PublicKey
): TransactionInstruction => {
  const provider = new AnchorProvider(connection, wallet, {});

  const transferAuthorityProgram =
    new Program<constants.LISTING_AUTHORITY_PROGRAM>(
      constants.LISTING_AUTHORITY_IDL,
      constants.LISTING_AUTHORITY_ADDRESS,
      provider
    );

  return transferAuthorityProgram.instruction.updateListing(
    {
      marketplace: marketplaceId,
      paymentAmount: paymentAmount,
      paymentMint: paymentMint,
    },
    {
      accounts: {
        listing: listingId,
        lister: wallet.publicKey,
      },
    }
  );
};

export const removeListing = (
  connection: Connection,
  wallet: Wallet,
  listingId: PublicKey
): TransactionInstruction => {
  const provider = new AnchorProvider(connection, wallet, {});

  const transferAuthorityProgram =
    new Program<constants.LISTING_AUTHORITY_PROGRAM>(
      constants.LISTING_AUTHORITY_IDL,
      constants.LISTING_AUTHORITY_ADDRESS,
      provider
    );

  return transferAuthorityProgram.instruction.removeListing({
    accounts: {
      listing: listingId,
      lister: wallet.publicKey,
    },
  });
};

export const acceptListing = (
  connection: Connection,
  wallet: Wallet,
  transferAuthorityId: PublicKey,
  listerPaymentTokenAccountId: PublicKey,
  listerMintTokenAccountId: PublicKey,
  lister: PublicKey,
  buyerPaymentTokenAccountId: PublicKey,
  buyerMintTokenAccountId: PublicKey,
  buyer: PublicKey,
  marketplaceId: PublicKey,
  mintId: PublicKey,
  listingId: PublicKey,
  tokenManagerId: PublicKey,
  mintMetadataId: PublicKey,
  transferReceiptId: PublicKey,
  transferId: PublicKey,
  paymentManagerId: PublicKey,
  paymentMintId: PublicKey,
  feeCollectorTokenAccountId: PublicKey,
  remainingAccounts: AccountMeta[],
  payer = wallet.publicKey
): TransactionInstruction => {
  const provider = new AnchorProvider(connection, wallet, {});

  const transferAuthorityProgram =
    new Program<constants.LISTING_AUTHORITY_PROGRAM>(
      constants.LISTING_AUTHORITY_IDL,
      constants.LISTING_AUTHORITY_ADDRESS,
      provider
    );
  return transferAuthorityProgram.instruction.acceptListing({
    accounts: {
      transferAuthority: transferAuthorityId,
      transferReceipt: transferReceiptId,
      transfer: transferId,
      listing: listingId,
      listerPaymentTokenAccount: listerPaymentTokenAccountId,
      listerMintTokenAccount: listerMintTokenAccountId,
      lister: lister,
      buyerPaymentTokenAccount: buyerPaymentTokenAccountId,
      buyerMintTokenAccount: buyerMintTokenAccountId,
      buyer: buyer,
      marketplace: marketplaceId,
      tokenManager: tokenManagerId,
      mint: mintId,
      mintMetadataInfo: mintMetadataId,
      paymentManager: paymentManagerId,
      paymentMint: paymentMintId,
      feeCollectorTokenAccount: feeCollectorTokenAccountId,
      payer: payer,
      tokenProgram: TOKEN_PROGRAM_ID,
      cardinalPaymentManager: PAYMENT_MANAGER_ADDRESS,
      cardinalTokenManager: TOKEN_MANAGER_ADDRESS,
      systemProgram: SystemProgram.programId,
    },
    remainingAccounts: remainingAccounts,
  });
};

export const whitelistMarkeplaces = (
  connection: Connection,
  wallet: Wallet,
  transferAuthorityId: PublicKey,
  whitelistMarketplaces: PublicKey[]
): TransactionInstruction => {
  const provider = new AnchorProvider(connection, wallet, {});

  const transferAuthorityProgram =
    new Program<constants.LISTING_AUTHORITY_PROGRAM>(
      constants.LISTING_AUTHORITY_IDL,
      constants.LISTING_AUTHORITY_ADDRESS,
      provider
    );

  return transferAuthorityProgram.instruction.whitelistMarketplaces(
    { allowedMarketplaces: whitelistMarketplaces },
    {
      accounts: {
        transferAuthority: transferAuthorityId,
        authority: wallet.publicKey,
      },
    }
  );
};

export const initTransfer = (
  connection: Connection,
  wallet: Wallet,
  params: {
    to: PublicKey;
    transferId: PublicKey;
    tokenManagerId: PublicKey;
    holderTokenAccountId: PublicKey;
    holder: PublicKey;
    payer?: PublicKey;
  }
): TransactionInstruction => {
  const provider = new AnchorProvider(connection, wallet, {});

  const transferAuthorityProgram =
    new Program<constants.LISTING_AUTHORITY_PROGRAM>(
      constants.LISTING_AUTHORITY_IDL,
      constants.LISTING_AUTHORITY_ADDRESS,
      provider
    );
  return transferAuthorityProgram.instruction.initTransfer(
    { to: params.to },
    {
      accounts: {
        transfer: params.transferId,
        tokenManager: params.tokenManagerId,
        holderTokenAccount: params.holderTokenAccountId,
        holder: params.holder,
        payer: params.payer || wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
    }
  );
};

export const cancelTransfer = (
  connection: Connection,
  wallet: Wallet,
  params: {
    transferId: PublicKey;
    tokenManagerId: PublicKey;
    holderTokenAccountId: PublicKey;
    holder: PublicKey;
  }
): TransactionInstruction => {
  const provider = new AnchorProvider(connection, wallet, {});

  const transferAuthorityProgram =
    new Program<constants.LISTING_AUTHORITY_PROGRAM>(
      constants.LISTING_AUTHORITY_IDL,
      constants.LISTING_AUTHORITY_ADDRESS,
      provider
    );

  return transferAuthorityProgram.instruction.cancelTransfer({
    accounts: {
      transfer: params.transferId,
      tokenManager: params.tokenManagerId,
      holderTokenAccount: params.holderTokenAccountId,
      holder: params.holder,
    },
  });
};

export const acceptTransfer = (
  connection: Connection,
  wallet: Wallet,
  params: {
    transferId: PublicKey;
    tokenManagerId: PublicKey;
    holderTokenAccountId: PublicKey;
    holder: PublicKey;
    recipient: PublicKey;
    recipientTokenAccountId: PublicKey;
    mintId: PublicKey;
    transferReceiptId: PublicKey;
    listingId: PublicKey;
    transferAuthorityId: PublicKey;
    remainingAccounts: AccountMeta[];
  }
): TransactionInstruction => {
  const provider = new AnchorProvider(connection, wallet, {});

  const transferAuthorityProgram =
    new Program<constants.LISTING_AUTHORITY_PROGRAM>(
      constants.LISTING_AUTHORITY_IDL,
      constants.LISTING_AUTHORITY_ADDRESS,
      provider
    );

  return transferAuthorityProgram.instruction.acceptTransfer({
    accounts: {
      transfer: params.transferId,
      transferAuthority: params.transferAuthorityId,
      transferReceipt: params.transferReceiptId,
      listing: params.listingId,
      tokenManager: params.tokenManagerId,
      mint: params.mintId,
      recipientTokenAccount: params.recipientTokenAccountId,
      recipient: params.recipient,
      holderTokenAccount: params.holderTokenAccountId,
      holder: params.holder,
      tokenProgram: TOKEN_PROGRAM_ID,
      cardinalTokenManager: TOKEN_MANAGER_ADDRESS,
      systemProgram: SystemProgram.programId,
    },
    remainingAccounts: params.remainingAccounts,
  });
};

export const release = (
  connection: Connection,
  wallet: Wallet,
  params: {
    transferAuthorityId: PublicKey;
    tokenManagerId: PublicKey;
    mintId: PublicKey;
    tokenManagerTokenAccountId: PublicKey;
    holderTokenAccountId: PublicKey;
    holder: PublicKey;
    remainingAccounts: AccountMeta[];
  }
): TransactionInstruction => {
  const provider = new AnchorProvider(connection, wallet, {});

  const transferAuthorityProgram =
    new Program<constants.LISTING_AUTHORITY_PROGRAM>(
      constants.LISTING_AUTHORITY_IDL,
      constants.LISTING_AUTHORITY_ADDRESS,
      provider
    );

  return transferAuthorityProgram.instruction.release({
    accounts: {
      transferAuthority: params.transferAuthorityId,
      tokenManager: params.tokenManagerId,
      mint: params.mintId,
      tokenManagerTokenAccount: params.tokenManagerTokenAccountId,
      holderTokenAccount: params.holderTokenAccountId,
      holder: params.holder,
      cardinalTokenManager: TOKEN_MANAGER_ADDRESS,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    },
    remainingAccounts: params.remainingAccounts,
  });
};
