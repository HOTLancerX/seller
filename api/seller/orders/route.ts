/**
 * GET /api/seller/orders?userId=<id>
 *
 * Returns orders that contain at least one item belonging to this seller.
 * Two-pass: uploadedBy field (new) + PostInfo lookup (old orders).
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import connectDB from "@/lib/mongodb";
import PostInfo from "@/models/post_info";
import { getOrdersCollection, initializeOrdersCollection } from "@/plugin/product/models/Order";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
    try {
        const caller = await resolveUser(req);
        if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

        await connectDB();

        // Get all productIds uploaded by this seller via PostInfo
        const infoMatches = await PostInfo.find({ name: "userId", value: targetUserId })
            .select("postId").lean() as any[];
        const sellerProductIds = infoMatches
            .map((p: any) => String(p.postId))
            .filter(Boolean);

        await initializeOrdersCollection();
        const ordersCol = await getOrdersCollection();

        // Match orders via uploadedBy (new) OR productId in seller's set (old)
        const orClauses: any[] = [{ "items.uploadedBy": targetUserId }];
        if (sellerProductIds.length > 0) {
            orClauses.push({ "items.productId": { $in: sellerProductIds } });
        }

        const query: Record<string, any> = { $or: orClauses };
        if (status) query.status = status;

        const [orders, total] = await Promise.all([
            ordersCol.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            ordersCol.countDocuments(query),
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
