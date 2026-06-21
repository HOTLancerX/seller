/**
 * Seller Wallet — one document per seller user.
 * Uses Mongoose for consistency with the rest of the CMS.
 * @version 2
 */

import mongoose, { Schema, type Document, type Types } from "mongoose";
import connectDB from "@/lib/mongodb";

export interface ISellerWallet extends Document {
    userId:         string;
    balance:        number;
    pendingBalance: number;
    totalEarned:    number;
    totalWithdrawn: number;
    updatedAt:      Date;
}

const WalletSchema = new Schema<ISellerWallet>(
    {
        userId:         { type: String, required: true, unique: true, index: true },
        balance:        { type: Number, default: 0 },
        pendingBalance: { type: Number, default: 0 },
        totalEarned:    { type: Number, default: 0 },
        totalWithdrawn: { type: Number, default: 0 },
    },
    { timestamps: true, collection: "seller_wallets" }
);

function getWalletModel() {
    return (mongoose.models.SellerWallet as mongoose.Model<ISellerWallet>) ||
        mongoose.model<ISellerWallet>("SellerWallet", WalletSchema);
}

/** Get or create a wallet for a seller, returns a plain object */
export async function getOrCreateWallet(userId: string) {
    await connectDB();
    const Model = getWalletModel();
    const doc = await Model.findOneAndUpdate(
        { userId },
        { $setOnInsert: { userId, balance: 0, pendingBalance: 0, totalEarned: 0, totalWithdrawn: 0 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean() as any;
    return {
        _id:            String(doc._id),
        userId:         String(doc.userId),
        balance:        doc.balance        ?? 0,
        pendingBalance: doc.pendingBalance ?? 0,
        totalEarned:    doc.totalEarned    ?? 0,
        totalWithdrawn: doc.totalWithdrawn ?? 0,
        updatedAt:      doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt ?? ""),
    };
}

export async function updateWallet(userId: string, inc: Partial<Record<"balance"|"pendingBalance"|"totalEarned"|"totalWithdrawn", number>>) {
    await connectDB();
    const Model = getWalletModel();
    await Model.updateOne(
        { userId },
        { $inc: inc },
        { upsert: true }
    );
}

// ── Legacy aliases — keeps old import names working during hot-reload ─────────
export const getWalletCollection = getWalletModel;
