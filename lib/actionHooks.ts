/**
 * plugin/seller/lib/actionHooks.ts — Server-only action hook registrations.
 *
 * Auto-discovered by hook/serverDataHooks.ts via require.context
**/

import { addAction } from "@/hook/pluginHooks";
import connectDB from "@/lib/mongodb";
import PostInfo from "@/models/post_info";
import { getTransactionModel } from "../models/Transaction";
import { updateWallet } from "../models/Wallet";

const PLUGIN_NX = "com.system.seller";

// ─── Action: return.approved ──────────────────────────────────────────────────
// Fired by product/api/returns/route.ts when admin approves a return.
// Reverses seller wallet balances for the affected order.

addAction<{ orderNumber: string; callerId: string }>(
    "return.approved",
    async ({ orderNumber }) => {
        await connectDB();
        const TxModel = getTransactionModel();
        const now = new Date();

        const sellerTxs = await TxModel.find({
            orderNumber,
            type:   "credit",
            status: { $in: ["pending", "available"] },
        }).lean() as any[];

        for (const tx of sellerTxs) {
            if (tx.status === "pending") {
                await TxModel.updateOne(
                    { _id: tx._id },
                    { $set: { status: "cancelled", note: `Reversed: return approved for order ${orderNumber}` } }
                );
                await updateWallet(tx.userId, { pendingBalance: -tx.amount });
            } else {
                await TxModel.updateOne(
                    { _id: tx._id },
                    { $set: { status: "cancelled", note: `Reversed: return approved for order ${orderNumber}` } }
                );
                await updateWallet(tx.userId, { balance: -tx.amount, totalEarned: -tx.amount });
                await TxModel.create({
                    userId:         tx.userId,
                    orderId:        tx.orderId,
                    orderNumber,
                    type:           "debit",
                    status:         "paid",
                    gross:          tx.gross,
                    commissionRate: tx.commissionRate,
                    adminAmount:    tx.adminAmount,
                    amount:         tx.amount,
                    note:           `Return refund reversal for order ${orderNumber}`,
                    createdAt:      now,
                    updatedAt:      now,
                });
            }
        }
    },
    PLUGIN_NX,
    10
);

// ─── Action: order.delivered ──────────────────────────────────────────────────
// Fired by product/api/orders/[orderNumber]/route.ts on delivery transition.
// Credits commission to the seller's wallet (7-day hold).

addAction<{
    order: any;
    orderNumber: string;
    orderId: string;
    userId: string;
    items: any[];
    now: Date;
}>(
    "order.delivered",
    async ({ orderNumber, orderId, items, now }) => {
        await connectDB();
        const TxModel        = getTransactionModel();
        const availableAfter = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Group items by seller
        const bySellerMap = new Map<string, any[]>();
        for (const item of items) {
            if (!item.uploadedBy) continue;
            const arr = bySellerMap.get(item.uploadedBy) ?? [];
            arr.push(item);
            bySellerMap.set(item.uploadedBy, arr);
        }

        for (const [sellerId, sellerItems] of bySellerMap) {
            // Idempotency check
            const existing = await TxModel.findOne({
                userId:      sellerId,
                orderNumber,
                type:        "credit",
                status:      { $in: ["pending", "available"] },
            }).lean();
            if (existing) continue;

            let gross          = 0;
            let commissionRate = 0;

            for (const item of sellerItems) {
                gross += item.subtotal ?? 0;

                if (commissionRate === 0 && item.productId) {
                    try {
                        const catInfo = await PostInfo.findOne({
                            postId: item.productId,
                            name:   "category",
                        }).lean() as any;

                        if (catInfo?.value) {
                            const { getCollection } = await import("@/lib/mongodb");
                            const catInfoCol = await getCollection("cat_infos");
                            const commInfo = await catInfoCol.findOne({
                                catId: catInfo.value,
                                name:  "seller_commission",
                            });
                            const rate = parseFloat((commInfo as any)?.value ?? "0");
                            if (!isNaN(rate) && rate > 0) commissionRate = rate;
                        }
                    } catch { /* commission stays 0 */ }
                }
            }

            const adminAmount  = parseFloat(((gross * commissionRate) / 100).toFixed(2));
            const sellerAmount = parseFloat((gross - adminAmount).toFixed(2));

            await TxModel.create({
                userId:         sellerId,
                orderId,
                orderNumber,
                type:           "credit",
                status:         "pending",
                gross,
                commissionRate,
                adminAmount,
                amount:         sellerAmount,
                availableAfter,
                note:           `Earnings from order ${orderNumber}. Available after ${availableAfter.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}.`,
            });

            await updateWallet(sellerId, {
                pendingBalance: sellerAmount,
                totalEarned:    sellerAmount,
            });
        }
    },
    PLUGIN_NX,
    10
);
