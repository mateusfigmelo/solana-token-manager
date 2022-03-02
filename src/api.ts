import type { Wallet } from "@saberhq/solana-contrib";
import type { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Transaction } from "@solana/web3.js";

import type { IssueParameters } from ".";
import {
  withClaimToken,
  withInvalidate,
  withIssueToken,
  withUnissueToken,
  withUse,
} from ".";

export const useTransaction = async (
  connection: Connection,
  wallet: Wallet,
  mintId: PublicKey,
  usages: number
): Promise<Transaction> =>
  withUse(new Transaction(), connection, wallet, mintId, usages);

export const invalidate = async (
  connection: Connection,
  wallet: Wallet,
  mintId: PublicKey
): Promise<Transaction> =>
  withInvalidate(new Transaction(), connection, wallet, mintId);

export const issueToken = async (
  connection: Connection,
  wallet: Wallet,
  rentalParameters: IssueParameters
): Promise<[Transaction, PublicKey, Keypair | undefined]> =>
  withIssueToken(new Transaction(), connection, wallet, rentalParameters);

export const unissueToken = async (
  connection: Connection,
  wallet: Wallet,
  mintId: PublicKey
): Promise<Transaction> =>
  withUnissueToken(new Transaction(), connection, wallet, mintId);

export const claimToken = async (
  connection: Connection,
  wallet: Wallet,
  tokenManagerId: PublicKey,
  additionalOptions?: {
    otpKeypair?: Keypair | null;
    timeInvalidatorId?: PublicKey;
  }
): Promise<Transaction> =>
  withClaimToken(
    new Transaction(),
    connection,
    wallet,
    tokenManagerId,
    additionalOptions
  );
