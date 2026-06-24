"use client";

/**
 * Seller account — Return Requests  (/account/seller-returns)
 *
 * Lists return requests for orders that contain the seller's products.
 * Seller can accept or reject requests that are in "pending_seller" status.
 */

import { useEffect, useState, useCallback } from "react";
import { Icon } from "@iconify/react";

interface ReturnRequest {
    _id: string;
    orderNumber: string;
    userEmail: string;
    reason: string;
    status: string;
    sellerNote?: string;
    adminNote?: string;
    deliveredAt: string;
    sellerRespondedAt?: string;
    refundProcessed: boolean;
    createdAt: string;
}

const STATUS_CLS: Record<string, string> = {
    pending_seller:  "bg-yellow-100 text-yellow-700",
    pending_admin:   "bg-blue-100 text-blue-700",
    approved:        "bg-emerald-100 text-emerald-700",
    rejected_seller: "bg-red-100 text-red-700",
    rejected_admin:  "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
    pending_seller:  "Awaiting Your Response",
    pending_admin:   "Awaiting Admin",
    approved:        "Approved (Refunded)",
    rejected_seller: "You Rejected",
    rejected_admin:  "Admin Rejected",
};

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
    });
}

export default function SellerReturns() {
    const [requests,     setRequests]     = useState<ReturnRequest[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [statusFilter, setStatusFilter] = useState("pending_seller");
    const [page,         setPage]         = useState(1);
    const [totalPages,   setTotalPages]   = useState(1);
    const [total,        setTotal]        = useState(0);

    const [actionItem,  setActionItem]  = useState<ReturnRequest | null>(null);
    const [sellerNote,  setSellerNote]  = useState("");
    const [processing,  setProcessing]  = useState(false);
    const [actionMsg,   setActionMsg]   = useState("");

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const qs = new URLSearchParams({ page: String(page) });
            if (statusFilter) qs.set("status", statusFilter);
            const res = await fetch(`/api/returns?${qs}`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            setRequests(data.returnRequests ?? []);
            setTotal(data.total ?? 0);
            setTotalPages(data.pages ?? 1);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [page, statusFilter]);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const handleAction = async (action: "accept" | "reject") => {
        if (!actionItem) return;
        setProcessing(true);
        setActionMsg("");
        try {
            const res = await fetch("/api/returns", {
                method:      "PUT",
                credentials: "include",
                headers:     { "Content-Type": "application/json" },
                body:        JSON.stringify({ id: actionItem._id, action, note: sellerNote }),
            });
            const data = await res.json();
            if (!res.ok) {
                setActionMsg(`Error: ${data.error}`);
            } else {
                setActionItem(null);
                setSellerNote("");
                fetchRequests();
            }
        } catch {
            setActionMsg("Network error.");
        } finally {
            setProcessing(false);
        }
    };

    const STATUS_FILTERS = [
        { value: "pending_seller", label: "Needs Response" },
        { value: "pending_admin",  label: "Awaiting Admin" },
        { value: "approved",       label: "Approved" },
        { value: "rejected_seller","label": "Rejected" },
        { value: "",               label: "All" },
    ] as const;

    return (
        <div className="space-y-5">

            {/* Header */}
            <div>
                <h1 className="text-xl font-black text-gray-900">Return Requests</h1>
                <p className="text-sm text-gray-400 mt-0.5">
                    Buyers have 7 days after delivery to request a return.
                </p>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {STATUS_FILTERS.map(f => (
                    <button
                        key={f.value || "all"}
                        onClick={() => { setStatusFilter(f.value); setPage(1); }}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                            statusFilter === f.value
                                ? "bg-indigo-500 text-white"
                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-gray-300">
                    <Icon icon="svg-spinners:ring-resize" width={32} />
                </div>
            ) : requests.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
                    <Icon icon="solar:box-minimalistic-outline" width={48} className="mx-auto mb-3 text-gray-200" />
                    <p className="text-base font-semibold text-gray-500">No return requests</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {requests.map(r => (
                        <div key={r._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-sm font-bold text-gray-900">{r.orderNumber}</span>
                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CLS[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                                            {STATUS_LABEL[r.status] ?? r.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500">Buyer: {r.userEmail}</p>
                                    <p className="text-xs text-gray-400">Delivered: {fmtDate(r.deliveredAt)} · Requested: {fmtDate(r.createdAt)}</p>
                                </div>

                                {r.status === "pending_seller" && (
                                    <button
                                        onClick={() => { setActionItem(r); setSellerNote(""); setActionMsg(""); }}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                                    >
                                        <Icon icon="solar:eye-bold" width={15} /> Respond
                                    </button>
                                )}
                            </div>

                            <div className="mt-3 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700">
                                <span className="text-xs font-semibold text-gray-400 mr-2">Reason:</span>
                                {r.reason}
                            </div>

                            {r.sellerNote && (
                                <p className="mt-2 text-xs text-gray-500">
                                    <span className="font-semibold">Your note:</span> {r.sellerNote}
                                </p>
                            )}
                            {r.refundProcessed && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                                    <Icon icon="solar:check-circle-bold" width={13} />
                                    Refund processed — order cancelled
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 pt-2">
                    <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition">
                            <Icon icon="mdi:chevron-left" width={18} />
                        </button>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition">
                            <Icon icon="mdi:chevron-right" width={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Respond Modal */}
            {actionItem && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
                    onClick={e => { if (e.target === e.currentTarget) setActionItem(null); }}
                >
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900">Respond to Return</h2>
                            <button onClick={() => setActionItem(null)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                                <Icon icon="mdi:close" width={18} />
                            </button>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Order</span>
                                <span className="font-mono font-bold">{actionItem.orderNumber}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-gray-500 shrink-0">Reason</span>
                                <span className="text-gray-800 text-right">{actionItem.reason}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700">
                                Your Note <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <textarea
                                rows={3}
                                value={sellerNote}
                                onChange={e => setSellerNote(e.target.value)}
                                placeholder="Explain your decision to the buyer…"
                                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            />
                        </div>

                        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
                            <Icon icon="solar:info-circle-bold" width={14} className="inline mr-1.5" />
                            Accepting sends the request to admin for final approval. The order will only be cancelled if admin also approves.
                        </div>

                        {actionMsg && (
                            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{actionMsg}</p>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => handleAction("accept")}
                                disabled={processing}
                                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition"
                            >
                                {processing ? "Processing…" : "✓ Accept Return"}
                            </button>
                            <button
                                onClick={() => handleAction("reject")}
                                disabled={processing}
                                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition"
                            >
                                ✕ Reject Return
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
