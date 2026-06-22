/**
 * Seller Withdrawal Request.
 *
 * status:
 *   pending  — submitted by seller, awaiting admin review
 *   approved — admin approved, balance deducted
 *   rejected — admin rejected, balance NOT deducted
 */

import { ObjectId, Collection } from "mongodb";
import { getCollection } from "@/lib/mongodb";

export type WithdrawalStatus = "pending" | "approved" | "rejected";

export interface SellerWithdrawal {
    _id?: ObjectId;
    userId: string;
    userName: string;
    userEmail: string;

    amount: number;
    paymentDetails: string;   // Bank account / bKash / PayPal etc.

    status: WithdrawalStatus;
    adminNote?: string;

    createdAt: Date;
    processedAt?: Date;
}

export async function getWithdrawalCollection(): Promise<Collection<SellerWithdrawal>> {
    return getCollection<SellerWithdrawal>("seller_withdrawals");
}
