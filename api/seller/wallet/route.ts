/**
 * GET  /api/seller/wallet          — returns wallet + recent transactions
 * POST /api/seller/wallet/credit   — (internal/cron) credit seller after 7-day hold
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { getOrCreateWallet } from "@/plugin/seller/models/Wallet";
import { getTransactionCollection } from "@/plugin/seller/models/Transaction";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
    try {
        const caller = await resolveUser(req);
        if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        // Admins can query any seller; sellers only see their own
        const isAdmin    = caller.userType === "admin" || caller.userType === "superadmin";
        const targetUser = isAdmin && searchParams.get("userId")
            ? searchParams.get("userId")!
            : caller.userId;

        if (!isAdmin && targetUser !== caller.userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const wallet = await getOrCreateWallet(targetUser);

        const txCol = await getTransactionCollection();
        const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
        const limit = 20;
        const skip  = (page - 1) * limit;

        const [transactions, total] = await Promise.all([
            txCol.find({ userId: targetUser }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            txCol.countDocuments({ userId: targetUser }),
        ]);

        return NextResponse.json({
            wallet: { ...wallet, _id: wallet._id?.toString() },
            transactions: transactions.map(t => ({ ...t, _id: t._id?.toString() })),
            total,
            pages: Math.ceil(total / limit),
            page,
        });
    } catch (err) {
        console.error("Seller wallet GET error:", err);
        return NextResponse.json({ error: "Failed to fetch wallet" }, { status: 500 });
    }
}
