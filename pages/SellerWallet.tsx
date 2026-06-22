"use client";

/**
 * Seller account — Wallet  (/account/seller-wallet)
 */

import { useEffect, useState, useCallback } from "react";
import { Icon } from "@iconify/react";
import { useUser } from "@/context/Provider";
import useSettings from "@/lib/useSettings";

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

function fmt(n: number, symbol: string) {
    return `${symbol} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const TX_STATUS_CLS: Record<string, { bg: string; text: string }> = {
    pending:   { bg: "bg-yellow-50",  text: "text-yellow-700"  },
    available: { bg: "bg-emerald-50", text: "text-emerald-700" },
    cancelled: { bg: "bg-red-50",     text: "text-red-700"     },
    paid:      { bg: "bg-blue-50",    text: "text-blue-700"    },
};

export default function SellerWallet() {
    const { user }     = useUser();
    const { settings } = useSettings();
    const symbol       = (settings?.product_currency_symbol || settings?.currency_symbol || "") as string;

    const [wallet,       setWallet]       = useState<Wallet | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [page,         setPage]         = useState(1);
    const [totalPages,   setTotalPages]   = useState(1);
    const [loading,      setLoading]      = useState(true);

    const [withdrawAmt,      setWithdrawAmt]      = useState("");
    const [paymentDetails,   setPaymentDetails]   = useState("");
    const [withdrawing,      setWithdrawing]       = useState(false);
    const [withdrawMsg,      setWithdrawMsg]       = useState("");
    const [showWithdrawForm, setShowWithdrawForm]  = useState(false);

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
                method: "POST", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: parseFloat(withdrawAmt), paymentDetails: paymentDetails.trim() }),
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
            <div className="space-y-5">
                <div className="h-8 w-40 bg-gray-100 rounded-xl animate-pulse" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
                            <div className="w-10 h-10 rounded-xl bg-gray-100 mb-3" />
                            <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
                            <div className="h-6 bg-gray-100 rounded w-1/2" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const availablePct = wallet && wallet.totalEarned > 0
        ? Math.round((wallet.balance / wallet.totalEarned) * 100)
        : 0;

    return (
        <div className="space-y-5">

            {/* ── Header ── */}
            <div>
                <h1 className="text-xl font-black text-gray-900">My Wallet</h1>
                <p className="text-sm text-gray-400 mt-0.5">Earnings are released 7 days after delivery confirmation.</p>
            </div>

            {/* ── Balance hero card ── */}
            <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-lg">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-6 -right-6 w-36 h-36 rounded-full bg-white/10" />
                    <div className="absolute -bottom-8 -left-4 w-28 h-28 rounded-full bg-white/10" />
                </div>
                <div className="relative">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm text-white/70 font-medium">Available Balance</p>
                            <p className="text-4xl font-black text-white mt-1">{fmt(wallet?.balance ?? 0, symbol)}</p>
                            <div className="flex items-center gap-3 mt-3">
                                <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-xl">
                                    <Icon icon="mdi:clock-outline" width={13} className="text-yellow-300" />
                                    <span className="text-xs font-semibold text-white/90">
                                        Pending: {fmt(wallet?.pendingBalance ?? 0, symbol)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowWithdrawForm(v => !v)}
                            className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white text-emerald-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition shadow-md">
                            <Icon icon="solar:wallet-money-bold" width={16} />
                            Withdraw
                        </button>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-white/60">Available of total earned</span>
                            <span className="text-xs font-bold text-white/80">{availablePct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                            <div className="h-full rounded-full bg-white/60 transition-all duration-500"
                                style={{ width: `${availablePct}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 4 stat cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: "Available",     value: wallet?.balance ?? 0,        icon: "solar:wallet-bold",              bg: "bg-emerald-50", text: "text-emerald-600" },
                    { label: "Pending Hold",  value: wallet?.pendingBalance ?? 0,  icon: "mdi:clock-outline",              bg: "bg-yellow-50",  text: "text-yellow-600"  },
                    { label: "Total Earned",  value: wallet?.totalEarned ?? 0,    icon: "solar:chart-bold",               bg: "bg-indigo-50",  text: "text-indigo-600"  },
                    { label: "Withdrawn",     value: wallet?.totalWithdrawn ?? 0, icon: "solar:transfer-horizontal-bold", bg: "bg-gray-50",    text: "text-gray-600"    },
                ].map(c => (
                    <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                            <Icon icon={c.icon} width={17} className={c.text} />
                        </div>
                        <p className="text-[11px] text-gray-500 font-medium leading-tight">{c.label}</p>
                        <p className="text-lg font-black text-gray-900 mt-0.5 truncate">{fmt(c.value, symbol)}</p>
                    </div>
                ))}
            </div>

            {/* ── Withdrawal form ── */}
            {(showWithdrawForm || withdrawMsg) && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                                <Icon icon="solar:wallet-money-bold" width={16} className="text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-900">Request Withdrawal</p>
                                <p className="text-xs text-gray-400">Funds processed by admin within 48 hours</p>
                            </div>
                        </div>
                        <button onClick={() => setShowWithdrawForm(false)}
                            className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition">
                            <Icon icon="solar:close-bold" width={14} />
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
                        <form onSubmit={handleWithdraw} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-gray-700">Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">{symbol}</span>
                                        <input type="number" min="1" step="0.01" max={wallet?.balance ?? 0}
                                            value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)}
                                            placeholder="0.00" required
                                            className="w-full pl-8 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                                    </div>
                                    <p className="text-[11px] text-gray-400">Available: {fmt(wallet?.balance ?? 0, symbol)}</p>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-gray-700">Payment Details</label>
                                    <input type="text" value={paymentDetails} onChange={e => setPaymentDetails(e.target.value)}
                                        placeholder="Bank / bKash / PayPal account" required
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" disabled={withdrawing}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition">
                                    {withdrawing
                                        ? <><Icon icon="svg-spinners:ring-resize" width={15} /> Submitting…</>
                                        : <><Icon icon="solar:check-circle-bold" width={15} /> Submit Request</>}
                                </button>
                                <button type="button" onClick={() => setShowWithdrawForm(false)}
                                    className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* ── Transaction history ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Icon icon="mdi:history" width={15} className="text-gray-500" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900">Transaction History</h2>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12 text-gray-300">
                        <Icon icon="svg-spinners:ring-resize" width={24} />
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                        <Icon icon="mdi:receipt-text-outline" width={36} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm font-medium">No transactions yet.</p>
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-gray-50">
                            {transactions.map(tx => {
                                const stCls = TX_STATUS_CLS[tx.status] ?? { bg: "bg-gray-100", text: "text-gray-600" };
                                const isCredit = tx.type === "credit";
                                return (
                                    <div key={tx._id} className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50/70 transition-colors">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                            isCredit ? "bg-emerald-50 text-emerald-500"
                                            : tx.type === "withdrawal" ? "bg-indigo-50 text-indigo-500"
                                            : "bg-red-50 text-red-500"
                                        }`}>
                                            <Icon icon={isCredit ? "solar:arrow-down-bold" : tx.type === "withdrawal" ? "solar:wallet-money-bold" : "solar:arrow-up-bold"} width={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 capitalize">
                                                {tx.type}
                                                {tx.orderNumber && (
                                                    <span className="ml-1.5 font-mono text-xs text-gray-400">#{tx.orderNumber}</span>
                                                )}
                                            </p>
                                            {tx.commissionRate > 0 && (
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    Commission {tx.commissionRate}% · Net {fmt(tx.amount, symbol)}
                                                </p>
                                            )}
                                            {tx.availableAfter && tx.status === "pending" && (
                                                <p className="text-xs text-yellow-600 mt-0.5">
                                                    Available after {fmtDate(tx.availableAfter)}
                                                </p>
                                            )}
                                            {tx.note && <p className="text-xs text-gray-400 mt-0.5 truncate">{tx.note}</p>}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={`text-sm font-black ${isCredit ? "text-emerald-600" : "text-red-500"}`}>
                                                {isCredit ? "+" : "−"}{fmt(tx.amount, symbol)}
                                            </p>
                                            <span className={`mt-0.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${stCls.bg} ${stCls.text}`}>
                                                {tx.status}
                                            </span>
                                            <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(tx.createdAt)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-3 px-5 py-4 border-t border-gray-50">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 transition">
                                    <Icon icon="solar:arrow-left-bold" width={14} />
                                    Prev
                                </button>
                                <span className="text-sm text-gray-500">{page} / {totalPages}</span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 transition">
                                    Next
                                    <Icon icon="solar:arrow-right-bold" width={14} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
