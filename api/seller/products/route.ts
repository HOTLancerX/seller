/**
 * GET /api/seller/products?userId=<id>
 * Returns all products uploaded by a specific seller.
 * userId is stored directly on the Post document (post.userId field).
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import connectDB from "@/lib/mongodb";
import Post from "@/models/post";

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
        const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
        const skip  = (page - 1) * limit;

        await connectDB();

        // Query directly on post.userId — no PostInfo join needed
        const query = { type: "product", userId: targetUserId };
        const [posts, total] = await Promise.all([
            Post.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean() as Promise<any[]>,
            Post.countDocuments(query),
        ]);

        return NextResponse.json({
            products: posts.map((p: any) => ({
                _id:       String(p._id),
                title:     String(p.title  ?? ""),
                slug:      String(p.slug   ?? ""),
                status:    String(p.status ?? ""),
                createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt ?? ""),
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
