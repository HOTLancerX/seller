/**
 * GET /api/seller/withdrawals          — admin: list all withdrawal requests
 * GET /api/seller/withdrawals?mine=1   — seller: own requests
 * PUT /api/seller/withdrawals          — admin: approve or reject a request
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { getWithdrawalCollection } from "@/plugin/seller/models/Withdrawal";
import { getTransactionCollection } from "@/plugin/seller/models/Transaction";
import { getWalletCollection } from "@/plugin/seller/models/Wallet";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
    try {
        const caller = await resolveUser(req);
        if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const isAdmin = caller.userType === "admin" || caller.userType === "superadmin";
        const { searchParams } = new URL(req.url);
        const mine   = searchParams.get("mine") === "1";
        const status = searchParams.get("status") ?? "";
        const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
        const limit  = 20;
        const skip   = (page - 1) * limit;

        const wCol  = await getWithdrawalCollection();
        const query: Record<string, any> = {};

        if (!isAdmin || mine) {
            query.userId = caller.userId;
        }
        if (status) query.status = status;

        const [withdrawals, total] = await Promise.all([
            wCol.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            wCol.countDocuments(query),
        ]);

        return NextResponse.json({
            withdrawals: withdrawals.map(w => ({ ...w, _id: w._id?.toString() })),
            total,
            pages: Math.ceil(total / limit),
            page,
        });
    } catch (err) {
        console.error("Withdrawals GET error:", err);
        return NextResponse.json({ error: "Failed to fetch withdrawals" }, { status: 500 });
    }
}

// ── PUT — admin approve / reject ──────────────────────────────────────────────

export async function PUT(req: NextRequest): Promise<Response> {
    try {
        const caller = await resolveUser(req);
        if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const isAdmin = caller.userType === "admin" || caller.userType === "superadmin";
        if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const body = await req.json() as {
            id: string;
            action: "approved" | "rejected";
            adminNote?: string;
        };

        if (!body.id || !["approved", "rejected"].includes(body.action)) {
            return NextResponse.json({ error: "id and action (approved/rejected) are required" }, { status: 400 });
        }

        const wCol  = await getWithdrawalCollection();
        let oid: ObjectId;
        try { oid = new ObjectId(body.id); } catch {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        const withdrawal = await wCol.findOne({ _id: oid });
        if (!withdrawal) return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
        if (withdrawal.status !== "pending") {
            return NextResponse.json({ error: "Already processed" }, { status: 400 });
        }

        const now = new Date();

        await wCol.updateOne(
            { _id: oid },
            {
                $set: {
                    status:      body.action,
                    adminNote:   body.adminNote ?? "",
                    processedAt: now,
                },
            }
        );

        // If approved — deduct from wallet and create a debit transaction
        if (body.action === "approved") {
            const walletCol = await getWalletCollection();
            await walletCol.updateOne(
                { userId: withdrawal.userId },
                {
                    $inc: { balance: -withdrawal.amount, totalWithdrawn: withdrawal.amount },
                    $set: { updatedAt: now },
                },
                { upsert: true }
            );

            const txCol = await getTransactionCollection();
            await txCol.insertOne({
                userId:       withdrawal.userId,
                withdrawalId: body.id,
                type:         "withdrawal",
                status:       "paid",
                gross:        withdrawal.amount,
                commissionRate: 0,
                adminAmount:  0,
                amount:       withdrawal.amount,
                note:         `Withdrawal approved. ${body.adminNote ?? ""}`.trim(),
                createdAt:    now,
                updatedAt:    now,
            } as any);
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Withdrawals PUT error:", err);
        return NextResponse.json({ error: "Failed to process withdrawal" }, { status: 500 });
    }
}
