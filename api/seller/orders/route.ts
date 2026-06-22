/**
 * GET /api/seller/orders?userId=<id>
 *
 * Returns orders that contain at least one item belonging to this seller.
 *
 * Two-pass strategy handles both old and new orders:
 *   1. New orders: items[].uploadedBy === userId  (stamped at checkout)
 *   2. Old orders: items[].productId is in the seller's PostInfo set
 *      (backfill — for orders placed before the uploadedBy fix)
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { getOrdersCollection, initializeOrdersCollection } from "@/plugin/product/models/Order";
import { getCollection } from "@/lib/mongodb";
import type { Document } from "mongodb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
    try {
        const caller = await resolveUser(req);
        if (!caller) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { userId: callerUserId, userType } = caller;
        const { searchParams } = new URL(req.url);
        const requestedUserId = searchParams.get("userId") ?? "";

        const isAdmin = userType === "admin" || userType === "superadmin";

        if (!isAdmin && requestedUserId !== callerUserId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const targetUserId = requestedUserId || callerUserId;

        const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
        const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));
        const skip   = (page - 1) * limit;
        const status = searchParams.get("status") ?? "";

        await initializeOrdersCollection();
        const ordersCol = await getOrdersCollection();

        // ── Step 1: find all productIds uploaded by this seller (via PostInfo) ──
        // PostInfo stores { postId, name: "userId", value: "<sellerId>" }
        const postInfoCol = await getCollection<Document>("postinfos");
        const sellerPostInfos = await postInfoCol
            .find({ name: "userId", value: targetUserId })
            .toArray();

        const sellerProductIds = sellerPostInfos.map(p => p.postId?.toString()).filter(Boolean);

        // ── Step 2: query orders matching either strategy ──────────────────────
        // OR:  items.uploadedBy === userId  (new orders)
        //      items.productId  in seller's product set (old orders without uploadedBy)
        const sellerQuery: Record<string, any> = {
            $or: [
                { "items.uploadedBy": targetUserId },
                ...(sellerProductIds.length > 0
                    ? [{ "items.productId": { $in: sellerProductIds } }]
                    : []),
            ],
        };

        if (status) sellerQuery.status = status;

        const [orders, total] = await Promise.all([
            ordersCol
                .find(sellerQuery)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            ordersCol.countDocuments(sellerQuery),
        ]);

        return NextResponse.json({
            orders: orders.map((o) => ({ ...o, _id: o._id?.toString() })),
            total,
            page,
            pages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error("Seller orders GET error:", error);
        return NextResponse.json({ error: "Failed to fetch seller orders" }, { status: 500 });
    }
}
