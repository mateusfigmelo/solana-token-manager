import type { AnchorTypes } from "@saberhq/anchor-contrib";
import { PublicKey } from "@solana/web3.js";

import * as RECEIPT_INDEX_TYPES from "../../idl/cardinal_receipt_index";

export const RECEIPT_INDEX_ADDRESS = new PublicKey(
  "rcpCr9GVsP2CPmS11uuFXUXbzc5JJQFMDvDRn8JDQNh"
);

export const RECEIPT_COUNTER_SEED = "receipt-counter";

export const RECEIPT_SLOT_SEED = "receipt-slot";

export const RECEIPT_MARKER_SEED = "receipt-marker";

export const RECEIPT_INDEX_IDL = RECEIPT_INDEX_TYPES.IDL;

export type RECEIPT_INDEX_PROGRAM = RECEIPT_INDEX_TYPES.CardinalReceiptIndex;

export type RentalCounterTypes = AnchorTypes<
  RECEIPT_INDEX_PROGRAM,
  {
    receiptCounter: ReceiptCounterData;
    receiptSlot: ReceiptSlotData;
    receiptMarker: ReceiptMarkerData;
  }
>;

type Accounts = RentalCounterTypes["Accounts"];
export type ReceiptCounterData = Accounts["receiptCounter"];
export type ReceiptSlotData = Accounts["receiptSlot"];
export type ReceiptMarkerData = Accounts["receiptMarker"];
