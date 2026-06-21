/**
 * GET /api/seller/wallet — returns wallet + recent transactions
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { getOrCreateWallet } from "@/plugin/seller/models/Wallet";
import { getTransactions } from "@/plugin/seller/models/Transaction";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
    try {
        const caller = await resolveUser(req);
        if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const isAdmin    = caller.userType === "admin" || caller.userType === "superadmin";
        const targetUser = isAdmin && searchParams.get("userId")
            ? searchParams.get("userId")!
            : caller.userId;

        if (!isAdmin && targetUser !== caller.userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
        const [wallet, txData] = await Promise.all([
            getOrCreateWallet(targetUser),
            getTransactions(targetUser, page),
        ]);

        return NextResponse.json({ wallet, ...txData });
    } catch (err) {
        console.error("Seller wallet GET error:", err);
        return NextResponse.json({ error: "Failed to fetch wallet" }, { status: 500 });
    }
}
