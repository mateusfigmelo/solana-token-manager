import { BN, Program, Provider } from "@project-serum/anchor";
import type { Wallet } from "@saberhq/solana-contrib";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type {
  AccountMeta,
  Connection,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { SystemProgram } from "@solana/web3.js";

import type { TokenManagerKind } from "../tokenManager";
import { TOKEN_MANAGER_ADDRESS, TokenManagerState } from "../tokenManager";
import {
  getRemainingAccountsForKind,
  getRemainingAccountsForPayment,
} from "../tokenManager/utils";
import type { TIME_INVALIDATOR_PROGRAM } from "./constants";
import { TIME_INVALIDATOR_ADDRESS, TIME_INVALIDATOR_IDL } from "./constants";
import { findTimeInvalidatorAddress } from "./pda";

export type TimeInvalidationParams = {
  expiration?: number;
  durationSeconds?: number;
  extension?: {
    extensionPaymentAmount: number;
    extensionDurationSeconds: number;
    paymentMint: PublicKey;
    maxExpiration: number;
  };
};

export const init = async (
  connection: Connection,
  wallet: Wallet,
  tokenManagerId: PublicKey,
  timeInvalidation: TimeInvalidationParams
): Promise<[TransactionInstruction, PublicKey]> => {
  const provider = new Provider(connection, wallet, {});

  const timeInvalidatorProgram = new Program<TIME_INVALIDATOR_PROGRAM>(
    TIME_INVALIDATOR_IDL,
    TIME_INVALIDATOR_ADDRESS,
    provider
  );

  const [timeInvalidatorId, _timeInvalidatorBump] =
    await findTimeInvalidatorAddress(tokenManagerId);

  return [
    timeInvalidatorProgram.instruction.init(
      {
        expiration: timeInvalidation.expiration
          ? new BN(timeInvalidation.expiration)
          : null,
        durationSeconds: timeInvalidation.durationSeconds
          ? new BN(timeInvalidation.durationSeconds)
          : null,
        extensionPaymentAmount: timeInvalidation.extension
          ?.extensionPaymentAmount
          ? new BN(timeInvalidation.extension?.extensionPaymentAmount)
          : null,
        extensionDurationSeconds: timeInvalidation.extension
          ?.extensionDurationSeconds
          ? new BN(timeInvalidation.extension?.extensionDurationSeconds)
          : null,
        paymentMint: timeInvalidation.extension?.paymentMint
          ? timeInvalidation.extension?.paymentMint
          : null,
        maxExpiration: timeInvalidation.extension?.maxExpiration
          ? new BN(timeInvalidation.extension?.maxExpiration)
          : null,
      },
      {
        accounts: {
          tokenManager: tokenManagerId,
          timeInvalidator: timeInvalidatorId,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
      }
    ),
    timeInvalidatorId,
  ];
};

export const setExpiration = (
  connection: Connection,
  wallet: Wallet,
  tokenManagerId: PublicKey,
  timeInvalidatorId: PublicKey
): TransactionInstruction => {
  const provider = new Provider(connection, wallet, {});

  const timeInvalidatorProgram = new Program<TIME_INVALIDATOR_PROGRAM>(
    TIME_INVALIDATOR_IDL,
    TIME_INVALIDATOR_ADDRESS,
    provider
  );

  return timeInvalidatorProgram.instruction.setExpiration({
    accounts: {
      tokenManager: tokenManagerId,
      timeInvalidator: timeInvalidatorId,
    },
  });
};

export const extendExpiration = (
  connection: Connection,
  wallet: Wallet,
  tokenManagerId: PublicKey,
  paymentTokenAccountId: PublicKey,
  payerTokenAccountId: PublicKey,
  timeInvalidatorId: PublicKey,
  extensionPaymentAmount: number
): TransactionInstruction => {
  const provider = new Provider(connection, wallet, {});

  const timeInvalidatorProgram = new Program<TIME_INVALIDATOR_PROGRAM>(
    TIME_INVALIDATOR_IDL,
    TIME_INVALIDATOR_ADDRESS,
    provider
  );

  return timeInvalidatorProgram.instruction.extendExpiration(
    new BN(extensionPaymentAmount),
    {
      accounts: {
        tokenManager: tokenManagerId,
        timeInvalidator: timeInvalidatorId,
        paymentTokenAccount: paymentTokenAccountId,
        payer: wallet.publicKey,
        payerTokenAccount: payerTokenAccountId,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
    }
  );
};

export const invalidate = async (
  connection: Connection,
  wallet: Wallet,
  mintId: PublicKey,
  tokenManagerId: PublicKey,
  tokenManagerKind: TokenManagerKind,
  tokenManagerState: TokenManagerState,
  tokenManagerTokenAccountId: PublicKey,
  recipientTokenAccountId: PublicKey,
  returnAccounts: AccountMeta[],
  issuerPaymentMintTokenAccountId?: PublicKey | null,
  tokenManagerPaymentMint?: PublicKey | null
): Promise<TransactionInstruction> => {
  const provider = new Provider(connection, wallet, {});

  const timeInvalidatorProgram = new Program<TIME_INVALIDATOR_PROGRAM>(
    TIME_INVALIDATOR_IDL,
    TIME_INVALIDATOR_ADDRESS,
    provider
  );

  const [[timeInvalidatorId], paymentAccounts, transferAccounts] =
    await Promise.all([
      findTimeInvalidatorAddress(tokenManagerId),
      getRemainingAccountsForPayment(
        tokenManagerId,
        issuerPaymentMintTokenAccountId,
        tokenManagerPaymentMint
      ),
      getRemainingAccountsForKind(mintId, tokenManagerKind),
    ]);

  return timeInvalidatorProgram.instruction.invalidate({
    accounts: {
      tokenManager: tokenManagerId,
      timeInvalidator: timeInvalidatorId,
      invalidator: wallet.publicKey,
      tokenManagerTokenAccount: tokenManagerTokenAccountId,
      mint: mintId,
      recipientTokenAccount: recipientTokenAccountId,
      cardinalTokenManager: TOKEN_MANAGER_ADDRESS,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
    remainingAccounts: [
      ...paymentAccounts,
      ...(tokenManagerState === TokenManagerState.Claimed
        ? transferAccounts
        : []),
      ...returnAccounts,
    ],
  });
};

export const close = (
  connection: Connection,
  wallet: Wallet,
  timeInvalidatorId: PublicKey,
  tokenManagerId: PublicKey
): TransactionInstruction => {
  const provider = new Provider(connection, wallet, {});

  const timeInvalidatorProgram = new Program<TIME_INVALIDATOR_PROGRAM>(
    TIME_INVALIDATOR_IDL,
    TIME_INVALIDATOR_ADDRESS,
    provider
  );

  return timeInvalidatorProgram.instruction.close({
    accounts: {
      tokenManager: tokenManagerId,
      timeInvalidator: timeInvalidatorId,
      closer: wallet.publicKey,
    },
  });
};
