/**
 * POST /api/seller/wallet/process  (admin-only)
 *
 * 1. RELEASE: pending transactions where availableAfter <= now → available
 *    wallet.balance += amount, wallet.pendingBalance -= amount
 *
 * 2. CANCEL: pending transactions linked to cancelled orders → cancelled
 *    wallet.pendingBalance -= amount
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import connectDB from "@/lib/mongodb";
import { getTransactionModel } from "@/plugin/seller/models/Transaction";
import { updateWallet } from "@/plugin/seller/models/Wallet";
import { getOrdersCollection, initializeOrdersCollection } from "@/plugin/product/models/Order";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
    try {
        const caller = await resolveUser(req);
        if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const isAdmin = caller.userType === "admin" || caller.userType === "superadmin";
        if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        await connectDB();
        await initializeOrdersCollection();

        const TxModel  = getTransactionModel();
        const ordersCol = await getOrdersCollection();
        const now = new Date();

        // ── 1. Release matured pending transactions ─────────────────────────
        const matured = await TxModel.find({
            type:           "credit",
            status:         "pending",
            availableAfter: { $lte: now },
        }).lean() as any[];

        let released = 0;
        for (const tx of matured) {
            await TxModel.updateOne({ _id: tx._id }, { $set: { status: "available" } });
            await updateWallet(tx.userId, { balance: tx.amount, pendingBalance: -tx.amount });
            released++;
        }

        // ── 2. Cancel pending txs for cancelled orders ──────────────────────
        const pendingTxs = await TxModel.find({
            type:    "credit",
            status:  "pending",
            orderId: { $exists: true, $ne: null },
        }).lean() as any[];

        let cancelled = 0;
        for (const tx of pendingTxs) {
            if (!tx.orderNumber) continue;
            const order = await ordersCol.findOne({ orderNumber: tx.orderNumber });
            if (order?.status === "cancelled") {
                await TxModel.updateOne({ _id: tx._id }, { $set: { status: "cancelled" } });
                await updateWallet(tx.userId, { pendingBalance: -tx.amount });
                cancelled++;
            }
        }

        return NextResponse.json({ success: true, released, cancelled });
    } catch (err) {
        console.error("Wallet process error:", err);
        return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
}
