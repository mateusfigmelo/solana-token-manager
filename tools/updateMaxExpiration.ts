import { utils } from "@project-serum/anchor";
import { SignerWallet } from "@saberhq/solana-contrib";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "bn.js";
import { AccountData, withUpdateMaxExpiration } from "../src";
import { TimeInvalidatorData } from "../src/programs/timeInvalidator";
import { getTimeInvalidator } from "../src/programs/timeInvalidator/accounts";
import { findTimeInvalidatorAddress } from "../src/programs/timeInvalidator/pda";
import { getTokenManagersForIssuer } from "../src/programs/tokenManager/accounts";

import { connectionFor } from "./connection";
import { chunkArray, executeTransaction } from "./utils";

const wallet = Keypair.fromSecretKey(
  utils.bytes.bs58.decode(process.env.AIRDROP_KEY || "")
);
const issuerId = new PublicKey("issuer_id");
const newMaxExpiration = new BN(1664985600);
const batchSize = 5;

const updateMaxExpiration = async (cluster = "mainnet"): Promise<void> => {
  const connection = connectionFor(cluster);
  console.log("Fetching all token managers...");
  const tokenManagers = await getTokenManagersForIssuer(connection, issuerId);
  const timeInvalidatorIds = (
    await Promise.all(
      tokenManagers.map((tm) => findTimeInvalidatorAddress(tm.pubkey))
    )
  ).map((t) => t[0]);
  const timeInvalidatorData = await Promise.all(
    timeInvalidatorIds.map((t) => getTimeInvalidator(connection, t))
  );
  const mapping = timeInvalidatorData.reduce((acc, time) => {
    acc[time.parsed.tokenManager.toString()] = time;
    return acc;
  }, {} as { [key: string]: AccountData<TimeInvalidatorData> });

  const chunks = chunkArray(tokenManagers, batchSize);
  await Promise.all(
    chunks.map(async (chunk, chunkNum) => {
      const transaction = new Transaction();
      for (const tm of chunk) {
        if (
          mapping[tm.pubkey.toString()]!.parsed.maxExpiration?.toString() !==
          newMaxExpiration.toString()
        ) {
          await withUpdateMaxExpiration(
            transaction,
            connection,
            new SignerWallet(wallet),
            tm.pubkey,
            newMaxExpiration
          );
        }
      }
      if (transaction.instructions.length > 0) {
        const txid = await executeTransaction(
          connection,
          new SignerWallet(wallet),
          transaction,
          {}
        );
        console.log(
          `[${chunkNum}/${chunks.length}] Succesfully updated max expiration for ${chunk.length} tickets with transaction ${txid} (https://explorer.solana.com/tx/${txid}?cluster=${cluster})`
        );
      }
    })
  );
};

updateMaxExpiration().catch((e) => {
  console.log(e);
});
