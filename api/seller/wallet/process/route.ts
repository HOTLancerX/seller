/**
 * POST /api/seller/wallet/process
 *
 * Cron / background job endpoint (admin-only).
 * Two jobs run in one call:
 *
 * 1. RELEASE: pending transactions where availableAfter <= now
 *    → status: pending → available
 *    → wallet.balance  += amount
 *    → wallet.pendingBalance -= amount
 *
 * 2. CANCEL: pending transactions linked to cancelled orders
 *    → status: pending → cancelled
 *    → wallet.pendingBalance -= amount
 *
 * Call this from a cron job or manually via admin UI:
 *   POST /api/seller/wallet/process
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { getWalletCollection } from "@/plugin/seller/models/Wallet";
import { getTransactionCollection } from "@/plugin/seller/models/Transaction";
import { getOrdersCollection, initializeOrdersCollection } from "@/plugin/product/models/Order";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
    try {
        const caller = await resolveUser(req);
        if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const isAdmin = caller.userType === "admin" || caller.userType === "superadmin";
        if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const txCol     = await getTransactionCollection();
        const walletCol = await getWalletCollection();

        await initializeOrdersCollection();
        const ordersCol = await getOrdersCollection();

        const now = new Date();

        // ── 1. Release matured pending transactions ───────────────────────────
        const matured = await txCol.find({
            type:           "credit",
            status:         "pending",
            availableAfter: { $lte: now },
        }).toArray();

        let released = 0;
        for (const tx of matured) {
            await txCol.updateOne(
                { _id: tx._id },
                { $set: { status: "available", updatedAt: now } }
            );
            await walletCol.updateOne(
                { userId: tx.userId },
                {
                    $inc: { balance: tx.amount, pendingBalance: -tx.amount },
                    $set: { updatedAt: now },
                },
                { upsert: true }
            );
            released++;
        }

        // ── 2. Cancel pending transactions for cancelled orders ───────────────
        const pendingTxs = await txCol.find({
            type:    "credit",
            status:  "pending",
            orderId: { $exists: true, $ne: null },
        }).toArray();

        let cancelled = 0;
        for (const tx of pendingTxs) {
            if (!tx.orderId) continue;
            const order = await ordersCol.findOne({ _id: { $toString: tx.orderId } } as any);
            // Use orderNumber match as fallback
            const matchedOrder = order ?? (tx.orderNumber
                ? await ordersCol.findOne({ orderNumber: tx.orderNumber })
                : null);

            if (matchedOrder?.status === "cancelled") {
                await txCol.updateOne(
                    { _id: tx._id },
                    { $set: { status: "cancelled", updatedAt: now } }
                );
                await walletCol.updateOne(
                    { userId: tx.userId },
                    {
                        $inc: { pendingBalance: -tx.amount },
                        $set: { updatedAt: now },
                    },
                    { upsert: true }
                );
                cancelled++;
            }
        }

        return NextResponse.json({ success: true, released, cancelled });
    } catch (err) {
        console.error("Wallet process error:", err);
        return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
}
