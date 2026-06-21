/**
 * Seller Transaction — ledger entry.
 * Uses Mongoose for consistency with the rest of the CMS.
 * @version 2
 */

import mongoose, { Schema, type Document } from "mongoose";
import connectDB from "@/lib/mongodb";

export type TransactionType   = "credit" | "debit" | "withdrawal";
export type TransactionStatus = "pending" | "available" | "cancelled" | "paid";

export interface ISellerTransaction extends Document {
    userId:         string;
    orderId?:       string;
    orderNumber?:   string;
    withdrawalId?:  string;
    type:           TransactionType;
    status:         TransactionStatus;
    gross:          number;
    commissionRate: number;
    adminAmount:    number;
    amount:         number;
    availableAfter?: Date;
    note?:          string;
    createdAt:      Date;
    updatedAt:      Date;
}

const TransactionSchema = new Schema<ISellerTransaction>(
    {
        userId:         { type: String, required: true, index: true },
        orderId:        { type: String, default: null },
        orderNumber:    { type: String, default: null },
        withdrawalId:   { type: String, default: null },
        type:           { type: String, enum: ["credit", "debit", "withdrawal"], required: true },
        status:         { type: String, enum: ["pending", "available", "cancelled", "paid"], default: "pending" },
        gross:          { type: Number, default: 0 },
        commissionRate: { type: Number, default: 0 },
        adminAmount:    { type: Number, default: 0 },
        amount:         { type: Number, required: true },
        availableAfter: { type: Date, default: null },
        note:           { type: String, default: "" },
    },
    { timestamps: true, collection: "seller_transactions" }
);

TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ status: 1, availableAfter: 1 });

export function getTransactionModel() {
    return (mongoose.models.SellerTransaction as mongoose.Model<ISellerTransaction>) ||
        mongoose.model<ISellerTransaction>("SellerTransaction", TransactionSchema);
}

export async function getTransactions(userId: string, page = 1, limit = 20) {
    await connectDB();
    const Model = getTransactionModel();
    const skip  = (page - 1) * limit;
    const [docs, total] = await Promise.all([
        Model.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Model.countDocuments({ userId }),
    ]);
    return {
        transactions: docs.map(serializeTx),
        total,
        pages: Math.ceil(total / limit),
        page,
    };
}

export function serializeTx(t: any) {
    return {
        _id:            String(t._id),
        userId:         String(t.userId        ?? ""),
        orderId:        String(t.orderId       ?? ""),
        orderNumber:    String(t.orderNumber   ?? ""),
        withdrawalId:   String(t.withdrawalId  ?? ""),
        type:           t.type,
        status:         t.status,
        gross:          t.gross          ?? 0,
        commissionRate: t.commissionRate ?? 0,
        adminAmount:    t.adminAmount    ?? 0,
        amount:         t.amount         ?? 0,
        availableAfter: t.availableAfter instanceof Date ? t.availableAfter.toISOString() : (t.availableAfter ?? null),
        note:           String(t.note ?? ""),
        createdAt:      t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt ?? ""),
        updatedAt:      t.updatedAt instanceof Date ? t.updatedAt.toISOString() : String(t.updatedAt ?? ""),
    };
}

// ── Legacy aliases — keeps old import names working during hot-reload ─────────
export const getTransactionCollection = getTransactionModel;
