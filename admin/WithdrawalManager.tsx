"use client";

/**
 * Admin — Seller Withdrawals  (/admin/seller/withdrawals)
 *
 * Lists all pending/processed withdrawal requests.
 * Admin can approve or reject with an optional note.
 * Approval deducts the amount from the seller's wallet automatically.
 */

import { useEffect, useState, useCallback } from "react";
import { Icon } from "@iconify/react";

interface Withdrawal {
    _id: string;
    userId: string;
    userName: string;
    userEmail: string;
    amount: number;
    paymentDetails: string;
    status: "pending" | "approved" | "rejected";
    adminNote?: string;
    createdAt: string;
    processedAt?: string;
}

const STATUS_CLS: Record<string, string> = {
    pending:  "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300",
    approved: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300",
    rejected: "bg-red-100 text-red-700 ring-1 ring-red-300",
};

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
    });
}

export default function WithdrawalManager() {
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [loading,     setLoading]     = useState(true);
    const [statusFilter, setStatusFilter] = useState("pending");
    const [page,        setPage]        = useState(1);
    const [totalPages,  setTotalPages]  = useState(1);
    const [total,       setTotal]       = useState(0);

    // Action modal state
    const [actionItem,  setActionItem]  = useState<Withdrawal | null>(null);
    const [adminNote,   setAdminNote]   = useState("");
    const [processing,  setProcessing]  = useState(false);
    const [actionMsg,   setActionMsg]   = useState("");

    // Cron / process button
    const [running,     setRunning]     = useState(false);
    const [processMsg,  setProcessMsg]  = useState("");

    const fetchWithdrawals = useCallback(async () => {
        setLoading(true);
        try {
            const qs = new URLSearchParams({ page: String(page) });
            if (statusFilter) qs.set("status", statusFilter);
            const res = await fetch(`/api/seller/withdrawals?${qs}`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            setWithdrawals(data.withdrawals ?? []);
            setTotal(data.total ?? 0);
            setTotalPages(data.pages ?? 1);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [page, statusFilter]);

    useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

    const handleAction = async (action: "approved" | "rejected") => {
        if (!actionItem) return;
        setProcessing(true);
        setActionMsg("");
        try {
            const res = await fetch("/api/seller/withdrawals", {
                method:      "PUT",
                credentials: "include",
                headers:     { "Content-Type": "application/json" },
                body:        JSON.stringify({ id: actionItem._id, action, adminNote }),
            });
            const data = await res.json();
            if (!res.ok) {
                setActionMsg(`Error: ${data.error}`);
            } else {
                setActionItem(null);
                setAdminNote("");
                fetchWithdrawals();
            }
        } catch {
            setActionMsg("Network error.");
        } finally {
            setProcessing(false);
        }
    };

    const handleProcess = async () => {
        setRunning(true);
        setProcessMsg("");
        try {
            const res = await fetch("/api/seller/wallet/process", {
                method: "POST", credentials: "include",
            });
            const data = await res.json();
            if (res.ok) {
                setProcessMsg(`✓ Released: ${data.released}, Cancelled: ${data.cancelled}`);
            } else {
                setProcessMsg(`Error: ${data.error}`);
            }
        } catch {
            setProcessMsg("Network error.");
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Seller Withdrawals</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{total} request{total !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={handleProcess}
                        disabled={running}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 disabled:opacity-50 transition"
                    >
                        <Icon icon={running ? "svg-spinners:ring-resize" : "solar:refresh-bold"} width={16} />
                        Process Pending Balances
                    </button>
                </div>
            </div>

            {processMsg && (
                <div className={`text-sm font-medium px-4 py-3 rounded-xl border ${processMsg.startsWith("Error")
                    ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-emerald-50 text-emerald-600 border-emerald-200"
                }`}>
                    {processMsg}
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                {["pending", "approved", "rejected", ""].map(s => (
                    <button
                        key={s || "all"}
                        onClick={() => { setStatusFilter(s); setPage(1); }}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition ${statusFilter === s
                            ? "bg-indigo-500 text-white"
                            : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                        {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
                    </button>
                ))}
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-gray-300">
                    <Icon icon="svg-spinners:ring-resize" width={32} />
                </div>
            ) : withdrawals.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <Icon icon="solar:wallet-outline" width={48} className="mx-auto mb-3 opacity-40" />
                    <p className="text-lg font-medium">No withdrawal requests</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Seller</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Amount</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Payment Details</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Requested</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {withdrawals.map(w => (
                                <tr key={w._id} className="hover:bg-gray-50 transition">
                                    <td className="px-5 py-3">
                                        <p className="font-semibold text-gray-800">{w.userName || "—"}</p>
                                        <p className="text-xs text-gray-400">{w.userEmail}</p>
                                    </td>
                                    <td className="px-5 py-3 font-bold text-gray-900">
                                        {Number(w.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-5 py-3 text-gray-600 max-w-[180px] truncate">
                                        {w.paymentDetails}
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_CLS[w.status] ?? STATUS_CLS.pending}`}>
                                            {w.status}
                                        </span>
                                        {w.adminNote && (
                                            <p className="text-xs text-gray-400 mt-0.5 max-w-[150px] truncate">{w.adminNote}</p>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                                        {fmtDate(w.createdAt)}
                                        {w.processedAt && (
                                            <p className="text-gray-300">Done: {fmtDate(w.processedAt)}</p>
                                        )}
                                    </td>
                                    <td className="px-5 py-3">
                                        {w.status === "pending" && (
                                            <button
                                                onClick={() => { setActionItem(w); setAdminNote(""); setActionMsg(""); }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                                            >
                                                <Icon icon="solar:eye-bold" width={13} /> Review
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 pt-2">
                    <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition">
                            <Icon icon="mdi:chevron-left" width={18} />
                        </button>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition">
                            <Icon icon="mdi:chevron-right" width={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {actionItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
                    onClick={e => { if (e.target === e.currentTarget) setActionItem(null); }}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900">Review Withdrawal</h2>
                            <button onClick={() => setActionItem(null)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                                <Icon icon="mdi:close" width={18} />
                            </button>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Seller</span>
                                <span className="font-semibold text-gray-800">{actionItem.userName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Amount</span>
                                <span className="font-bold text-gray-900">
                                    {Number(actionItem.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Payment Details</span>
                                <span className="text-gray-800 text-right max-w-[200px]">{actionItem.paymentDetails}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Requested</span>
                                <span className="text-gray-600">{fmtDate(actionItem.createdAt)}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700">
                                Admin Note <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <textarea
                                rows={2}
                                value={adminNote}
                                onChange={e => setAdminNote(e.target.value)}
                                placeholder="Reason for rejection, reference number…"
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            />
                        </div>

                        {actionMsg && (
                            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{actionMsg}</p>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => handleAction("approved")}
                                disabled={processing}
                                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition"
                            >
                                {processing ? "Processing…" : "✓ Approve"}
                            </button>
                            <button
                                onClick={() => handleAction("rejected")}
                                disabled={processing}
                                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition"
                            >
                                ✕ Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
