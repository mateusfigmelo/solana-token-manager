import { BN, utils } from "@coral-xyz/anchor";
import {
  createCreateMasterEditionV3Instruction,
  createCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata";
import type { PublicKey } from "@solana/web3.js";
import {
  Keypair,
  sendAndConfirmRawTransaction,
  Transaction,
} from "@solana/web3.js";
import {
  createMintIxs,
  findMintEditionId,
  findMintMetadataId,
} from "@solana-nft-programs/common";

import { connectionFor } from "./connection";

const wallet = Keypair.fromSecretKey(
  utils.bytes.bs58.decode(process.env.AIRDROP_KEY || "")
);

const DAY_MAPPING: { [day: string]: string } = {
  SUN: "Sunday",
  MON: "Monday",
  TUES: "Tuesday",
  WEDS: "Wednesday",
  THURS: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
};

export const airdropMasterEdition = async (
  num: number,
  metadataUrl: string,
  daySymbol: string,
  cluster: string,
  startNum = 0,
  floor = 3
) => {
  const dayName = DAY_MAPPING[daySymbol]!;
  if (!dayName) throw new Error("Day not found");
  const allMintIds: PublicKey[] = [];
  const connection = connectionFor(cluster);
  const counter = startNum;

  ////////////////////////////////////////////
  ///////////// Master Edition ///////////////
  ////////////////////////////////////////////
  for (let i = 0; i < num; i++) {
    console.log(`----------(${i}/${num})--------------`);

    try {
      const masterEditionTransaction = new Transaction();
      const masterEditionMint = Keypair.generate();
      const [ixs] = await createMintIxs(
        connection,
        masterEditionMint.publicKey,
        wallet.publicKey
      );
      masterEditionTransaction.instructions = [
        ...masterEditionTransaction.instructions,
        ...ixs,
      ];

      const masterEditionMetadataId = findMintMetadataId(
        masterEditionMint.publicKey
      );
      const metadataIx = createCreateMetadataAccountV3Instruction(
        {
          metadata: masterEditionMetadataId,
          updateAuthority: wallet.publicKey,
          mint: masterEditionMint.publicKey,
          mintAuthority: wallet.publicKey,
          payer: wallet.publicKey,
        },
        {
          createMetadataAccountArgsV3: {
            data: {
              name: `EmpireDAO #${floor}.${counter} (${daySymbol})`,
              symbol: daySymbol,
              uri: `https://nft.host.so/metadata/${masterEditionMint.publicKey.toString()}?uri=${metadataUrl}&text=header:${dayName}%20day%20pass&attrs=Day:${dayName};Floor:${floor};Seat:${counter}`,
              sellerFeeBasisPoints: 10,
              creators: [
                {
                  address: wallet.publicKey,
                  verified: true,
                  share: 100,
                },
              ],
              collection: null,
              uses: null,
            },
            isMutable: true,
            collectionDetails: null,
          },
        }
      );

      const masterEditionId = findMintEditionId(masterEditionMint.publicKey);
      const masterEditionIx = createCreateMasterEditionV3Instruction(
        {
          edition: masterEditionId,
          metadata: masterEditionMetadataId,
          updateAuthority: wallet.publicKey,
          mint: masterEditionMint.publicKey,
          mintAuthority: wallet.publicKey,
          payer: wallet.publicKey,
        },
        {
          createMasterEditionArgs: {
            maxSupply: new BN(0),
          },
        }
      );

      const transaction = new Transaction();
      transaction.instructions = [
        ...masterEditionTransaction.instructions,
        metadataIx,
        masterEditionIx,
      ];
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (
        await connection.getRecentBlockhash("max")
      ).blockhash;
      transaction.sign(wallet, masterEditionMint);
      await sendAndConfirmRawTransaction(connection, transaction.serialize(), {
        commitment: "confirmed",
      });
      console.log(
        `Master edition data created mintId=(${masterEditionMint.publicKey.toString()}) masterEditionId=(${masterEditionId.toString()}) metadataId=(${masterEditionMetadataId.toString()})})`
      );
      allMintIds.push(masterEditionMint.publicKey);
    } catch (e) {
      console.log("Failed", e);
    }
  }

  return allMintIds;
};

airdropMasterEdition(
  38,
  "https://rent.host.so/metadata/empiredao.json",
  "SAT",
  "mainnet",
  0,
  5
)
  .then((allMintIds) => {
    console.log(allMintIds.map((pk) => pk.toString()));
  })
  .catch((e) => {
    console.log(e);
  });
