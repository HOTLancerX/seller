"use client";

/**
 * Seller account — Wallet  (/account/seller-wallet)
 *
 * Shows:
 *   - Available balance + Pending balance
 *   - Withdrawal request form
 *   - Full transaction history (paginated)
 */

import { useEffect, useState, useCallback } from "react";
import { Icon } from "@iconify/react";
import { useUser } from "@/context/Provider";
import useSettings from "@/lib/useSettings";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Wallet {
    balance: number;
    pendingBalance: number;
    totalEarned: number;
    totalWithdrawn: number;
}

interface Transaction {
    _id: string;
    type: "credit" | "debit" | "withdrawal";
    status: "pending" | "available" | "cancelled" | "paid";
    gross: number;
    commissionRate: number;
    adminAmount: number;
    amount: number;
    orderNumber?: string;
    note?: string;
    availableAfter?: string;
    createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, symbol: string) {
    return `${symbol} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
    });
}

const TX_STATUS_CLS: Record<string, string> = {
    pending:   "bg-yellow-100 text-yellow-700",
    available: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-red-100 text-red-700",
    paid:      "bg-blue-100 text-blue-700",
};

const TX_TYPE_ICON: Record<string, string> = {
    credit:     "solar:arrow-down-bold",
    debit:      "solar:arrow-up-bold",
    withdrawal: "solar:wallet-money-bold",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SellerWallet() {
    const { user }     = useUser();
    const { settings } = useSettings();
    const symbol       = (settings?.product_currency_symbol || settings?.currency_symbol || "") as string;

    const [wallet,      setWallet]      = useState<Wallet | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [page,        setPage]        = useState(1);
    const [totalPages,  setTotalPages]  = useState(1);
    const [loading,     setLoading]     = useState(true);

    // Withdrawal form
    const [withdrawAmt,     setWithdrawAmt]     = useState("");
    const [paymentDetails,  setPaymentDetails]  = useState("");
    const [withdrawing,     setWithdrawing]      = useState(false);
    const [withdrawMsg,     setWithdrawMsg]      = useState("");
    const [showWithdrawForm, setShowWithdrawForm] = useState(false);

    const fetchWallet = useCallback(async (p: number) => {
        if (!user?._id) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/seller/wallet?page=${p}`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            setWallet(data.wallet);
            setTransactions(data.transactions ?? []);
            setTotalPages(data.pages ?? 1);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [user?._id]);

    useEffect(() => { fetchWallet(page); }, [page, fetchWallet]);

    const handleWithdraw = async (e: React.FormEvent) => {
        e.preventDefault();
        setWithdrawing(true);
        setWithdrawMsg("");
        try {
            const res = await fetch("/api/seller/wallet/withdraw", {
                method:      "POST",
                credentials: "include",
                headers:     { "Content-Type": "application/json" },
                body:        JSON.stringify({
                    amount:         parseFloat(withdrawAmt),
                    paymentDetails: paymentDetails.trim(),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setWithdrawMsg(`Error: ${data.error}`);
            } else {
                setWithdrawMsg("Withdrawal request submitted! Admin will process it shortly.");
                setWithdrawAmt("");
                setPaymentDetails("");
                setShowWithdrawForm(false);
                fetchWallet(1);
            }
        } catch {
            setWithdrawMsg("Network error — please try again.");
        } finally {
            setWithdrawing(false);
        }
    };

    if (loading && !wallet) {
        return (
            <div className="flex items-center justify-center py-24 text-gray-300">
                <Icon icon="svg-spinners:ring-resize" width={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-gray-900">My Wallet</h1>
                <p className="text-sm text-gray-400 mt-0.5">
                    Earnings are released 7 days after delivery.
                </p>
            </div>

            {/* Balance cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Available Balance", value: wallet?.balance ?? 0,         icon: "solar:wallet-bold",       cls: "text-emerald-600 bg-emerald-50" },
                    { label: "Pending (7-day hold)", value: wallet?.pendingBalance ?? 0, icon: "mdi:clock-outline",       cls: "text-yellow-600 bg-yellow-50" },
                    { label: "Total Earned",       value: wallet?.totalEarned ?? 0,    icon: "solar:chart-bold",         cls: "text-indigo-600 bg-indigo-50" },
                    { label: "Total Withdrawn",    value: wallet?.totalWithdrawn ?? 0, icon: "solar:transfer-horizontal-bold", cls: "text-gray-600 bg-gray-50" },
                ].map(c => (
                    <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${c.cls} mb-3`}>
                            <Icon icon={c.icon} width={20} />
                        </div>
                        <p className="text-xs text-gray-500 font-medium">{c.label}</p>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">{fmt(c.value, symbol)}</p>
                    </div>
                ))}
            </div>

            {/* Withdrawal section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-gray-900">Withdraw Funds</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Minimum available balance required.</p>
                    </div>
                    <button
                        onClick={() => setShowWithdrawForm(v => !v)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white text-sm font-semibold rounded-xl hover:bg-indigo-600 transition"
                    >
                        <Icon icon="solar:wallet-money-bold" width={16} />
                        Request Withdrawal
                    </button>
                </div>

                {withdrawMsg && (
                    <div className={`text-sm font-medium px-4 py-3 rounded-xl border ${withdrawMsg.startsWith("Error")
                        ? "bg-red-50 text-red-600 border-red-200"
                        : "bg-emerald-50 text-emerald-600 border-emerald-200"
                    }`}>
                        {withdrawMsg}
                    </div>
                )}

                {showWithdrawForm && (
                    <form onSubmit={handleWithdraw} className="space-y-4 pt-2 border-t border-gray-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-gray-700">Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{symbol}</span>
                                    <input
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        max={wallet?.balance ?? 0}
                                        value={withdrawAmt}
                                        onChange={e => setWithdrawAmt(e.target.value)}
                                        placeholder="0.00"
                                        required
                                        className="w-full pl-8 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <p className="text-xs text-gray-400">
                                    Available: {fmt(wallet?.balance ?? 0, symbol)}
                                </p>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-gray-700">Payment Details</label>
                                <input
                                    type="text"
                                    value={paymentDetails}
                                    onChange={e => setPaymentDetails(e.target.value)}
                                    placeholder="Bank / bKash / PayPal account"
                                    required
                                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={withdrawing}
                                className="px-5 py-2.5 bg-indigo-500 text-white text-sm font-semibold rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition"
                            >
                                {withdrawing ? "Submitting…" : "Submit Request"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowWithdrawForm(false)}
                                className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Transaction history */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                    <Icon icon="mdi:history" width={18} className="text-gray-400" />
                    <h2 className="text-sm font-bold text-gray-900">Transaction History</h2>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12 text-gray-300">
                        <Icon icon="svg-spinners:ring-resize" width={24} />
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                        <Icon icon="mdi:receipt-text-outline" width={40} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No transactions yet.</p>
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-gray-50">
                            {transactions.map(tx => (
                                <div key={tx._id} className="flex items-center gap-4 px-5 py-4">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                        tx.type === "credit" ? "bg-emerald-50 text-emerald-500"
                                        : tx.type === "withdrawal" ? "bg-indigo-50 text-indigo-500"
                                        : "bg-red-50 text-red-500"
                                    }`}>
                                        <Icon icon={TX_TYPE_ICON[tx.type]} width={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-800 capitalize">
                                            {tx.type}
                                            {tx.orderNumber && (
                                                <span className="ml-2 font-mono text-xs text-gray-400">#{tx.orderNumber}</span>
                                            )}
                                        </p>
                                        {tx.commissionRate > 0 && (
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                Admin {tx.commissionRate}% ({fmt(tx.adminAmount, symbol)}) · Seller net {fmt(tx.amount, symbol)}
                                            </p>
                                        )}
                                        {tx.note && <p className="text-xs text-gray-400 mt-0.5">{tx.note}</p>}
                                        {tx.availableAfter && tx.status === "pending" && (
                                            <p className="text-xs text-yellow-600 mt-0.5">
                                                Available after {fmtDate(tx.availableAfter)}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={`text-sm font-bold ${tx.type === "credit" ? "text-emerald-600" : "text-red-500"}`}>
                                            {tx.type === "credit" ? "+" : "-"}{fmt(tx.amount, symbol)}
                                        </p>
                                        <span className={`mt-1 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${TX_STATUS_CLS[tx.status] ?? "bg-gray-100 text-gray-600"}`}>
                                            {tx.status}
                                        </span>
                                        <p className="text-xs text-gray-400 mt-0.5">{fmtDate(tx.createdAt)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-3 px-5 py-4 border-t border-gray-50">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition">
                                    <Icon icon="mdi:chevron-left" width={18} />
                                </button>
                                <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition">
                                    <Icon icon="mdi:chevron-right" width={18} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
