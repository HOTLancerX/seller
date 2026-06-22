/**
 * Seller Transaction — ledger entry for every commission credit/debit/withdrawal.
 *
 * status:
 *   pending   — order delivered, 7-day hold running
 *   available — 7 days passed, moved to wallet.balance
 *   cancelled — order was cancelled during/after hold; amount voided
 *   paid      — withdrawal approved, deducted from balance
 */

import { ObjectId, Collection } from "mongodb";
import { getCollection } from "@/lib/mongodb";

export type TransactionType   = "credit" | "debit" | "withdrawal";
export type TransactionStatus = "pending" | "available" | "cancelled" | "paid";

export interface SellerTransaction {
    _id?: ObjectId;
    userId: string;           // Seller user _id
    orderId?: string;         // Order _id (for credit/debit)
    orderNumber?: string;
    withdrawalId?: string;    // Withdrawal request _id (for withdrawal type)

    type: TransactionType;
    status: TransactionStatus;

    gross: number;            // Full order item subtotal for seller's items
    commissionRate: number;   // e.g. 10 (%)
    adminAmount: number;      // gross * commissionRate / 100
    amount: number;           // net seller earnings = gross - adminAmount

    availableAfter?: Date;    // When pending → available (createdAt + 7 days)
    note?: string;

    createdAt: Date;
    updatedAt: Date;
}

export async function getTransactionCollection(): Promise<Collection<SellerTransaction>> {
    return getCollection<SellerTransaction>("seller_transactions");
}
