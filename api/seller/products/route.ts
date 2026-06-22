/**
 * GET /api/seller/products?userId=<id>
 *
 * Returns all products uploaded by a specific seller.
 * The userId is stored in PostInfo as { name: "userId", value: "<id>" }.
 *
 * Security: only the owner (or admin) can fetch their product list.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { getCollection } from "@/lib/mongodb";
import type { Document, WithId } from "mongodb";

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

        // Non-admins can only see their own products
        if (!isAdmin && requestedUserId !== callerUserId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const targetUserId = requestedUserId || callerUserId;

        const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
        const skip  = (page - 1) * limit;

        // Step 1: find PostInfo docs where name="userId" and value=targetUserId
        const postInfoCollection = await getCollection<Document>("postinfos");
        const infoMatches = await postInfoCollection
            .find({ name: "userId", value: targetUserId })
            .toArray();

        if (infoMatches.length === 0) {
            return NextResponse.json({ products: [], total: 0, page, pages: 1 });
        }

        const { ObjectId } = await import("mongodb");
        const postIds = infoMatches
            .map((doc) => {
                try { return new ObjectId(doc.postId.toString()); }
                catch { return null; }
            })
            .filter(Boolean);

        if (postIds.length === 0) {
            return NextResponse.json({ products: [], total: 0, page, pages: 1 });
        }

        // Step 2: fetch the actual posts with type "product"
        const postsCollection = await getCollection<Document>("posts");
        const query = { _id: { $in: postIds }, type: "product" };

        const [products, total] = await Promise.all([
            postsCollection
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            postsCollection.countDocuments(query),
        ]);

        return NextResponse.json({
            products: products.map((p: WithId<Document>) => ({
                ...p,
                _id: p._id.toString(),
            })),
            total,
            page,
            pages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error("Seller products GET error:", error);
        return NextResponse.json({ error: "Failed to fetch seller products" }, { status: 500 });
    }
}
