/**
 * Seller Wallet — one document per seller user.
 *
 * balance        — funds available for withdrawal (cleared after 7-day hold)
 * pendingBalance — funds still in the 7-day hold period
 */

import { ObjectId, Collection } from "mongodb";
import { getCollection } from "@/lib/mongodb";

export interface SellerWallet {
    _id?: ObjectId;
    userId: string;           // Seller's user _id
    balance: number;          // Available to withdraw
    pendingBalance: number;   // In 7-day hold
    totalEarned: number;      // Lifetime credited
    totalWithdrawn: number;   // Lifetime paid out
    updatedAt: Date;
}

export async function getWalletCollection(): Promise<Collection<SellerWallet>> {
    return getCollection<SellerWallet>("seller_wallets");
}

/** Get or create a wallet for a seller */
export async function getOrCreateWallet(userId: string): Promise<SellerWallet> {
    const col = await getWalletCollection();
    const existing = await col.findOne({ userId });
    if (existing) return existing;

    const wallet: SellerWallet = {
        userId,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        updatedAt: new Date(),
    };
    await col.insertOne(wallet as any);
    return wallet;
}
