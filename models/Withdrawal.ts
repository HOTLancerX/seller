/**
 * Seller Withdrawal Request.
 * Uses Mongoose for consistency with the rest of the CMS.
 * @version 2
 */

import mongoose, { Schema, type Document } from "mongoose";

export type WithdrawalStatus = "pending" | "approved" | "rejected";

export interface ISellerWithdrawal extends Document {
    userId:         string;
    userName:       string;
    userEmail:      string;
    amount:         number;
    paymentDetails: string;
    status:         WithdrawalStatus;
    adminNote?:     string;
    createdAt:      Date;
    processedAt?:   Date;
}

const WithdrawalSchema = new Schema<ISellerWithdrawal>(
    {
        userId:         { type: String, required: true, index: true },
        userName:       { type: String, default: "" },
        userEmail:      { type: String, default: "" },
        amount:         { type: Number, required: true },
        paymentDetails: { type: String, required: true },
        status:         { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
        adminNote:      { type: String, default: "" },
        processedAt:    { type: Date, default: null },
    },
    { timestamps: true, collection: "seller_withdrawals" }
);

WithdrawalSchema.index({ status: 1, createdAt: -1 });

export function getWithdrawalModel() {
    return (mongoose.models.SellerWithdrawal as mongoose.Model<ISellerWithdrawal>) ||
        mongoose.model<ISellerWithdrawal>("SellerWithdrawal", WithdrawalSchema);
}

export function serializeWithdrawal(w: any) {
    return {
        _id:            String(w._id),
        userId:         String(w.userId         ?? ""),
        userName:       String(w.userName        ?? ""),
        userEmail:      String(w.userEmail       ?? ""),
        amount:         w.amount ?? 0,
        paymentDetails: String(w.paymentDetails  ?? ""),
        status:         w.status,
        adminNote:      String(w.adminNote       ?? ""),
        createdAt:      w.createdAt   instanceof Date ? w.createdAt.toISOString()   : String(w.createdAt   ?? ""),
        processedAt:    w.processedAt instanceof Date ? w.processedAt.toISOString() : (w.processedAt ?? null),
    };
}

// ── Legacy aliases — keeps old import names working during hot-reload ─────────
export const getWithdrawalCollection = getWithdrawalModel;
