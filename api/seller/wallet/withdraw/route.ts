/**
 * POST /api/seller/wallet/withdraw
 * Seller submits a withdrawal request. Balance is NOT deducted until admin approves.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveUser, getAuthSession } from "@/lib/session";
import { getOrCreateWallet } from "@/plugin/seller/models/Wallet";
import { getWithdrawalModel } from "@/plugin/seller/models/Withdrawal";
import connectDB from "@/lib/mongodb";

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

        await connectDB();

        const wallet = await getOrCreateWallet(caller.userId);
        if (wallet.balance < amount) {
            return NextResponse.json(
                { error: `Insufficient balance. Available: ${wallet.balance.toFixed(2)}` },
                { status: 400 }
            );
        }

        const Withdrawal = getWithdrawalModel();
        const existing = await Withdrawal.findOne({ userId: caller.userId, status: "pending" }).lean();
        if (existing) {
            return NextResponse.json(
                { error: "You already have a pending withdrawal request." },
                { status: 400 }
            );
        }

        await Withdrawal.create({
            userId:         caller.userId,
            userName:       authUser?.name  ?? "",
            userEmail:      authUser?.email ?? "",
            amount,
            paymentDetails: paymentDetails.trim(),
            status:         "pending",
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Withdrawal POST error:", err);
        return NextResponse.json({ error: "Failed to submit withdrawal" }, { status: 500 });
    }
}
