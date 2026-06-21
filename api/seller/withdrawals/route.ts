/**
 * GET /api/seller/withdrawals          — admin: list all requests
 * GET /api/seller/withdrawals?mine=1   — seller: own requests
 * PUT /api/seller/withdrawals          — admin: approve or reject
 * @version 2
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import connectDB from "@/lib/mongodb";
import { getWithdrawalModel, serializeWithdrawal } from "@/plugin/seller/models/Withdrawal";
import { getTransactionModel } from "@/plugin/seller/models/Transaction";
import { updateWallet } from "@/plugin/seller/models/Wallet";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
    try {
        const caller = await resolveUser(req);
        if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();

        const isAdmin = caller.userType === "admin" || caller.userType === "superadmin";
        const { searchParams } = new URL(req.url);
        const mine   = searchParams.get("mine") === "1";
        const status = searchParams.get("status") ?? "";
        const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
        const limit  = 20;
        const skip   = (page - 1) * limit;

        const Withdrawal = getWithdrawalModel();
        const query: Record<string, any> = {};

        if (!isAdmin || mine) query.userId = caller.userId;
        if (status) query.status = status;

        const [docs, total] = await Promise.all([
            Withdrawal.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean() as Promise<any[]>,
            Withdrawal.countDocuments(query),
        ]);

        return NextResponse.json({
            withdrawals: docs.map(serializeWithdrawal),
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
            return NextResponse.json({ error: "id and action are required" }, { status: 400 });
        }

        if (!mongoose.isValidObjectId(body.id)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        await connectDB();

        const Withdrawal = getWithdrawalModel();
        const withdrawal = await Withdrawal.findById(body.id).lean() as any;

        if (!withdrawal) {
            return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
        }
        if (withdrawal.status !== "pending") {
            return NextResponse.json({ error: "Already processed" }, { status: 400 });
        }

        const now = new Date();

        await Withdrawal.updateOne(
            { _id: withdrawal._id },
            { $set: { status: body.action, adminNote: body.adminNote ?? "", processedAt: now } }
        );

        if (body.action === "approved") {
            // Deduct balance from wallet
            await updateWallet(withdrawal.userId, {
                balance:        -withdrawal.amount,
                totalWithdrawn:  withdrawal.amount,
            });

            // Create a paid debit transaction
            const TxModel = getTransactionModel();
            await TxModel.create({
                userId:         withdrawal.userId,
                withdrawalId:   String(withdrawal._id),
                type:           "withdrawal",
                status:         "paid",
                gross:          withdrawal.amount,
                commissionRate: 0,
                adminAmount:    0,
                amount:         withdrawal.amount,
                note:           `Withdrawal approved. ${body.adminNote ?? ""}`.trim(),
            });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Withdrawals PUT error:", err);
        return NextResponse.json({ error: "Failed to process withdrawal" }, { status: 500 });
    }
}
