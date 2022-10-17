import {
  Edition,
  Metadata,
  MetadataData,
  MetadataProgram,
} from "@metaplex-foundation/mpl-token-metadata";
import type { Wallet } from "@saberhq/solana-contrib";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { AccountMeta, Connection, Transaction } from "@solana/web3.js";
import { Keypair, PublicKey } from "@solana/web3.js";

import type { AccountData } from "../..";
import { findAta, withFindOrInitAssociatedTokenAccount } from "../..";
import { tryGetAccount } from "../../utils";
import { getPaymentManager } from "../paymentManager/accounts";
import type { TokenManagerData } from ".";
import { InvalidationType, TokenManagerKind, TokenManagerState } from ".";
import { findMintManagerId, findTransferReceiptId } from "./pda";

export const getRemainingAccountsForKind = async (
  mintId: PublicKey,
  tokenManagerKind: TokenManagerKind
): Promise<AccountMeta[]> => {
  if (
    tokenManagerKind === TokenManagerKind.Managed ||
    tokenManagerKind === TokenManagerKind.Permissioned
  ) {
    const [mintManagerId] = await findMintManagerId(mintId);
    return [
      {
        pubkey: mintManagerId,
        isSigner: false,
        isWritable: true,
      },
    ];
  } else if (tokenManagerKind === TokenManagerKind.Edition) {
    const editionId = await Edition.getPDA(mintId);
    return [
      {
        pubkey: editionId,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: MetadataProgram.PUBKEY,
        isSigner: false,
        isWritable: false,
      },
    ];
  } else {
    return [];
  }
};

export const withRemainingAccountsForPayment = async (
  transaction: Transaction,
  connection: Connection,
  wallet: Wallet,
  mint: PublicKey,
  paymentMint: PublicKey,
  issuerId: PublicKey,
  paymentManagerId: PublicKey,
  options?: {
    payer?: PublicKey;
    receiptMint?: PublicKey | null;
  }
): Promise<[PublicKey, PublicKey, AccountMeta[]]> => {
  const payer = options?.payer ?? wallet.publicKey;
  const royaltiesRemainingAccounts =
    await withRemainingAccountsForHandlePaymentWithRoyalties(
      transaction,
      connection,
      wallet,
      mint,
      paymentMint,
      [issuerId.toString()]
    );
  const mintMetadataId = await Metadata.getPDA(mint);
  const paymentRemainingAccounts = [
    {
      pubkey: paymentMint,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: mint,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: mintMetadataId,
      isSigner: false,
      isWritable: true,
    },
  ];

  if (options?.receiptMint) {
    const receiptMintLargestAccount = await connection.getTokenLargestAccounts(
      options.receiptMint
    );
    // get holder of receipt mint
    const receiptTokenAccountId = receiptMintLargestAccount.value[0]?.address;
    if (!receiptTokenAccountId) throw new Error("No token accounts found");
    const receiptMintToken = new Token(
      connection,
      options.receiptMint,
      TOKEN_PROGRAM_ID,
      Keypair.generate()
    );
    const receiptTokenAccount = await receiptMintToken.getAccountInfo(
      receiptTokenAccountId
    );

    // get ATA for this mint of receipt mint holder
    const returnTokenAccountId = receiptTokenAccount.owner.equals(
      wallet.publicKey
    )
      ? await findAta(paymentMint, receiptTokenAccount.owner, true)
      : await withFindOrInitAssociatedTokenAccount(
          transaction,
          connection,
          paymentMint,
          receiptTokenAccount.owner,
          payer,
          true
        );

    const paymentManager = await tryGetAccount(() =>
      getPaymentManager(connection, paymentManagerId)
    );
    const feeCollectorTokenAccountId =
      await withFindOrInitAssociatedTokenAccount(
        transaction,
        connection,
        paymentMint,
        paymentManager ? paymentManager.parsed.feeCollector : paymentManagerId,
        payer,
        true
      );
    return [
      returnTokenAccountId,
      feeCollectorTokenAccountId,
      [
        {
          pubkey: receiptTokenAccountId,
          isSigner: false,
          isWritable: true,
        },
        ...paymentRemainingAccounts,
        ...royaltiesRemainingAccounts,
      ],
    ];
  } else {
    const issuerTokenAccountId = issuerId.equals(wallet.publicKey)
      ? await findAta(paymentMint, issuerId, true)
      : await withFindOrInitAssociatedTokenAccount(
          transaction,
          connection,
          paymentMint,
          issuerId,
          payer,
          true
        );
    const paymentManager = await tryGetAccount(() =>
      getPaymentManager(connection, paymentManagerId)
    );
    const feeCollectorTokenAccountId =
      await withFindOrInitAssociatedTokenAccount(
        transaction,
        connection,
        paymentMint,
        paymentManager ? paymentManager.parsed.feeCollector : paymentManagerId,
        payer,
        true
      );
    return [
      issuerTokenAccountId,
      feeCollectorTokenAccountId,
      [...paymentRemainingAccounts, ...royaltiesRemainingAccounts],
    ];
  }
};

export const withRemainingAccountsForReturn = async (
  transaction: Transaction,
  connection: Connection,
  wallet: Wallet,
  tokenManagerData: AccountData<TokenManagerData>,
  allowOwnerOffCurve = true
): Promise<AccountMeta[]> => {
  const { issuer, mint, claimApprover, invalidationType, receiptMint, state } =
    tokenManagerData.parsed;
  if (
    invalidationType === InvalidationType.Vest &&
    state === TokenManagerState.Issued
  ) {
    if (!claimApprover) throw "Claim approver must be set";
    const claimApproverTokenAccountId =
      await withFindOrInitAssociatedTokenAccount(
        transaction,
        connection,
        mint,
        claimApprover,
        wallet.publicKey,
        allowOwnerOffCurve
      );
    return [
      {
        pubkey: claimApproverTokenAccountId,
        isSigner: false,
        isWritable: true,
      },
    ];
  } else if (
    invalidationType === InvalidationType.Return ||
    state === TokenManagerState.Issued
  ) {
    if (receiptMint) {
      const receiptMintLargestAccount =
        await connection.getTokenLargestAccounts(receiptMint);

      // get holder of receipt mint
      const receiptTokenAccountId = receiptMintLargestAccount.value[0]?.address;
      if (!receiptTokenAccountId) throw new Error("No token accounts found");
      const receiptMintToken = new Token(
        connection,
        receiptMint,
        TOKEN_PROGRAM_ID,
        Keypair.generate()
      );
      const receiptTokenAccount = await receiptMintToken.getAccountInfo(
        receiptTokenAccountId
      );

      // get ATA for this mint of receipt mint holder
      const returnTokenAccountId = await withFindOrInitAssociatedTokenAccount(
        transaction,
        connection,
        mint,
        receiptTokenAccount.owner,
        wallet.publicKey,
        allowOwnerOffCurve
      );
      return [
        {
          pubkey: returnTokenAccountId,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: receiptTokenAccountId,
          isSigner: false,
          isWritable: true,
        },
      ];
    } else {
      const issuerTokenAccountId = await withFindOrInitAssociatedTokenAccount(
        transaction,
        connection,
        mint,
        issuer,
        wallet.publicKey,
        allowOwnerOffCurve
      );
      return [
        {
          pubkey: issuerTokenAccountId,
          isSigner: false,
          isWritable: true,
        },
      ];
    }
  } else {
    return [];
  }
};

export const withRemainingAccountsForHandlePaymentWithRoyalties = async (
  transaction: Transaction,
  connection: Connection,
  wallet: Wallet,
  mint: PublicKey,
  paymentMint: PublicKey,
  excludeCreators?: string[]
): Promise<AccountMeta[]> => {
  const creatorsRemainingAccounts: AccountMeta[] = [];
  const mintMetadataId = await Metadata.getPDA(mint);
  const accountInfo = await connection.getAccountInfo(mintMetadataId);
  let metaplexMintData: MetadataData | undefined;
  try {
    metaplexMintData = MetadataData.deserialize(
      accountInfo?.data as Buffer
    ) as MetadataData;
  } catch (e) {
    return [];
  }
  if (metaplexMintData.data.creators) {
    for (const creator of metaplexMintData.data.creators) {
      if (creator.share !== 0) {
        const creatorAddress = new PublicKey(creator.address);
        const creatorMintTokenAccount = excludeCreators?.includes(
          creator.address.toString()
        )
          ? await findAta(paymentMint, creatorAddress, true)
          : await withFindOrInitAssociatedTokenAccount(
              transaction,
              connection,
              paymentMint,
              creatorAddress,
              wallet.publicKey,
              true
            );
        creatorsRemainingAccounts.push({
          pubkey: creatorMintTokenAccount,
          isSigner: false,
          isWritable: true,
        });
      }
    }
  }

  return creatorsRemainingAccounts;
};

export const getRemainingAccountsForTransfer = async (
  transferAuthority: PublicKey | null,
  tokenManagerId: PublicKey
): Promise<AccountMeta[]> => {
  if (transferAuthority) {
    const [transferReceiptId] = await findTransferReceiptId(tokenManagerId);
    return [
      {
        pubkey: transferReceiptId,
        isSigner: false,
        isWritable: true,
      },
    ];
  } else {
    return [];
  }
};
