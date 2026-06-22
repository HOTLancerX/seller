/**
 * POST /api/seller/wallet/withdraw
 *
 * Seller submits a withdrawal request.
 * Validates available balance — does NOT deduct until admin approves.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveUser, getAuthSession } from "@/lib/session";
import { getOrCreateWallet } from "@/plugin/seller/models/Wallet";
import { getWithdrawalCollection } from "@/plugin/seller/models/Withdrawal";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
    try {
        const caller = await resolveUser(req);
        if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const authUser = await getAuthSession(req);
        const body = await req.json() as { amount?: number; paymentDetails?: string };
        const { amount, paymentDetails } = body;

        if (!amount || amount <= 0) {
            return NextResponse.json({ error: "Invalid withdrawal amount" }, { status: 400 });
        }
        if (!paymentDetails?.trim()) {
            return NextResponse.json({ error: "Payment details are required" }, { status: 400 });
        }

        const wallet = await getOrCreateWallet(caller.userId);

        if (wallet.balance < amount) {
            return NextResponse.json(
                { error: `Insufficient balance. Available: ${wallet.balance.toFixed(2)}` },
                { status: 400 }
            );
        }

        // Check no pending withdrawal already exists
        const wCol = await getWithdrawalCollection();
        const existing = await wCol.findOne({ userId: caller.userId, status: "pending" });
        if (existing) {
            return NextResponse.json(
                { error: "You already have a pending withdrawal request." },
                { status: 400 }
            );
        }

        const now = new Date();
        const withdrawal = {
            userId:         caller.userId,
            userName:       authUser?.name ?? "",
            userEmail:      authUser?.email ?? "",
            amount,
            paymentDetails: paymentDetails.trim(),
            status:         "pending" as const,
            createdAt:      now,
        };

        await wCol.insertOne(withdrawal as any);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Withdrawal POST error:", err);
        return NextResponse.json({ error: "Failed to submit withdrawal" }, { status: 500 });
    }
}
