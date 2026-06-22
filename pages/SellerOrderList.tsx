"use client";

/**
 * Seller account — Seller Orders  (/account/seller-orders)
 *
 * Fetches orders that contain products owned by the logged-in seller.
 * Uses GET /api/seller/orders?userId=<id>
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { useUser } from "@/context/Provider";
import useSettings from "@/lib/useSettings";

interface OrderItem {
    productTitle: string;
    productImage?: string;
    quantity: number;
    price: number;
    subtotal: number;
}

interface Order {
    _id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    items: OrderItem[];
    total: number;
    shippingMethod: string;
    createdAt: string;
}

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: string }> = {
    pending:    { label: "Pending",    cls: "bg-yellow-100 text-yellow-700",    icon: "mdi:clock-outline" },
    processing: { label: "Processing", cls: "bg-blue-100 text-blue-700",       icon: "mdi:cog-outline" },
    shipped:    { label: "Shipped",    cls: "bg-indigo-100 text-indigo-700",   icon: "mdi:truck-delivery-outline" },
    delivered:  { label: "Delivered",  cls: "bg-emerald-100 text-emerald-700", icon: "mdi:check-circle-outline" },
    cancelled:  { label: "Cancelled",  cls: "bg-red-100 text-red-700",         icon: "mdi:close-circle-outline" },
};

const PAYMENT_BADGE: Record<string, { label: string; cls: string }> = {
    pending:  { label: "Unpaid",   cls: "bg-yellow-100 text-yellow-700" },
    paid:     { label: "Paid",     cls: "bg-emerald-100 text-emerald-700" },
    failed:   { label: "Failed",   cls: "bg-red-100 text-red-700" },
    refunded: { label: "Refunded", cls: "bg-gray-100 text-gray-600" },
};

function fmt(n: number, symbol: string) {
    return `${symbol} ${Number(n).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`.trim();
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
    });
}

export default function SellerOrderList() {
    const { user }   = useUser();
    const { settings } = useSettings();
    const symbol = (settings?.product_currency_symbol || settings?.currency_symbol || "") as string;

    const [orders,  setOrders]  = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [status,  setStatus]  = useState("");
    const [page,    setPage]    = useState(1);
    const [total,   setTotal]   = useState(0);
    const [pages,   setPages]   = useState(1);

    useEffect(() => {
        if (!user?._id) return;
        setLoading(true);
        const qs = new URLSearchParams({ userId: user._id, page: String(page), limit: "10" });
        if (status) qs.set("status", status);
        fetch(`/api/seller/orders?${qs}`, { credentials: "include" })
            .then(async (res) => {
                if (!res.ok) return;
                const data = await res.json();
                setOrders(data.orders ?? []);
                setTotal(data.total ?? 0);
                setPages(data.pages ?? 1);
            })
            .catch(() => { /* silent */ })
            .finally(() => setLoading(false));
    }, [user?._id, page, status]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Seller Orders</h1>
                    {!loading && (
                        <p className="text-sm text-gray-400 mt-0.5">
                            {total} order{total !== 1 ? "s" : ""}
                        </p>
                    )}
                </div>
                <select
                    value={status}
                    onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-main"
                >
                    <option value="">All statuses</option>
                    {Object.entries(STATUS_BADGE).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20 text-gray-300">
                    <Icon icon="svg-spinners:ring-resize" width={32} />
                </div>
            )}

            {/* Empty */}
            {!loading && orders.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
                    <Icon icon="solar:receipt-outline" width={52} className="mx-auto mb-4 text-gray-200" />
                    <p className="text-base font-semibold text-gray-500">No orders yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                        {status ? "No orders match this filter." : "Orders for your products will appear here."}
                    </p>
                </div>
            )}

            {/* Order cards */}
            {!loading && orders.map((order) => {
                const s  = STATUS_BADGE[order.status]         ?? STATUS_BADGE.pending;
                const ps = PAYMENT_BADGE[order.paymentStatus] ?? PAYMENT_BADGE.pending;
                const firstItem = order.items[0];
                const more = order.items.length - 1;

                return (
                    <div key={order._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {/* Card header */}
                        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-50 flex-wrap">
                            <div className="flex items-center gap-2">
                                <Icon icon="mdi:receipt-text-outline" width={16} className="text-gray-400" />
                                <span className="text-sm font-bold font-mono text-gray-800">{order.orderNumber}</span>
                                <span className="text-xs text-gray-400">{fmtDate(order.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>
                                    <Icon icon={s.icon} width={12} />
                                    {s.label}
                                </span>
                                <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${ps.cls}`}>
                                    {ps.label}
                                </span>
                                <span className="text-sm font-bold text-gray-900">{fmt(order.total, symbol)}</span>
                            </div>
                        </div>

                        {/* Item preview */}
                        <div className="flex items-center gap-4 px-5 py-4">
                            {firstItem?.productImage ? (
                                <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                                    <Image
                                        src={firstItem.productImage}
                                        alt={firstItem.productTitle}
                                        fill className="object-cover" sizes="56px"
                                    />
                                </div>
                            ) : (
                                <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                                    <Icon icon="mdi:package-variant" width={24} className="text-gray-300" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">
                                    {firstItem?.productTitle ?? "—"}
                                </p>
                                {more > 0 && (
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        +{more} more item{more !== 1 ? "s" : ""}
                                    </p>
                                )}
                            </div>
                            <Link
                                href={`/account/seller-orders/${order._id}`}
                                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-main/10 text-main hover:bg-main/20 transition"
                            >
                                Details
                                <Icon icon="mdi:arrow-right" width={14} />
                            </Link>
                        </div>
                    </div>
                );
            })}

            {/* Pagination */}
            {pages > 1 && (
                <div className="flex items-center justify-center gap-3">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition"
                        aria-label="Previous"
                    >
                        <Icon icon="mdi:chevron-left" width={18} />
                    </button>
                    <span className="text-sm text-gray-600">Page {page} of {pages}</span>
                    <button
                        onClick={() => setPage((p) => Math.min(pages, p + 1))}
                        disabled={page >= pages}
                        className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition"
                        aria-label="Next"
                    >
                        <Icon icon="mdi:chevron-right" width={18} />
                    </button>
                </div>
            )}
        </div>
    );
}
