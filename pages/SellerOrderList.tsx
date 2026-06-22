"use client";

/**
 * Seller account — Seller Orders  (/account/seller-orders)
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

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string; dot: string }> = {
    pending:    { label: "Pending",    bg: "bg-yellow-50",  text: "text-yellow-700",  icon: "mdi:clock-outline",             dot: "bg-yellow-400"  },
    processing: { label: "Processing", bg: "bg-blue-50",    text: "text-blue-700",    icon: "mdi:cog-outline",               dot: "bg-blue-400"    },
    shipped:    { label: "Shipped",    bg: "bg-indigo-50",  text: "text-indigo-700",  icon: "mdi:truck-delivery-outline",    dot: "bg-indigo-400"  },
    delivered:  { label: "Delivered",  bg: "bg-emerald-50", text: "text-emerald-700", icon: "mdi:check-circle-outline",      dot: "bg-emerald-400" },
    cancelled:  { label: "Cancelled",  bg: "bg-red-50",     text: "text-red-700",     icon: "mdi:close-circle-outline",      dot: "bg-red-400"     },
};

const PAYMENT_CONFIG: Record<string, { label: string; cls: string }> = {
    pending:  { label: "Unpaid",   cls: "bg-yellow-50 text-yellow-700"   },
    paid:     { label: "Paid",     cls: "bg-emerald-50 text-emerald-700" },
    failed:   { label: "Failed",   cls: "bg-red-50 text-red-700"         },
    refunded: { label: "Refunded", cls: "bg-gray-100 text-gray-600"      },
};

function fmt(n: number, symbol: string) {
    return `${symbol} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`.trim();
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function SellerOrderList() {
    const { user }     = useUser();
    const { settings } = useSettings();
    const symbol       = (settings?.product_currency_symbol || settings?.currency_symbol || "") as string;

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
            .then(async res => {
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

            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-black text-gray-900">Seller Orders</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        {loading ? "Loading…" : `${total} order${total !== 1 ? "s" : ""}`}
                    </p>
                </div>

                {/* Status filter */}
                <div className="flex items-center gap-2 flex-wrap">
                    <select value={status}
                        onChange={e => { setStatus(e.target.value); setPage(1); }}
                        className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none pr-8"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}>
                        <option value="">All statuses</option>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Status chips ── */}
            <div className="flex items-center gap-2 flex-wrap">
                {[{ key: "", label: "All" }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))].map(item => (
                    <button key={item.key}
                        onClick={() => { setStatus(item.key); setPage(1); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                            status === item.key
                                ? (item.key ? `${STATUS_CONFIG[item.key]?.bg} ${STATUS_CONFIG[item.key]?.text}` : "bg-gray-900 text-white")
                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}>
                        {item.key && <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[item.key]?.dot}`} />}
                        {item.label}
                    </button>
                ))}
            </div>

            {/* ── Loading skeleton ── */}
            {loading && (
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="h-4 bg-gray-100 rounded-lg w-32" />
                                <div className="h-4 bg-gray-100 rounded-lg w-20" />
                            </div>
                            <div className="flex gap-3">
                                <div className="w-14 h-14 rounded-xl bg-gray-100 shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-100 rounded-lg w-2/3" />
                                    <div className="h-3 bg-gray-100 rounded-lg w-1/3" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Empty ── */}
            {!loading && orders.length === 0 && (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                        <Icon icon="solar:receipt-bold" width={32} className="text-indigo-300" />
                    </div>
                    <p className="text-base font-bold text-gray-500">No orders yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                        {status ? "No orders match this filter." : "Orders for your products will appear here."}
                    </p>
                </div>
            )}

            {/* ── Order cards ── */}
            {!loading && orders.map(order => {
                const s  = STATUS_CONFIG[order.status]         ?? STATUS_CONFIG.pending;
                const ps = PAYMENT_CONFIG[order.paymentStatus] ?? PAYMENT_CONFIG.pending;
                const firstItem = order.items[0];
                const more = order.items.length - 1;

                return (
                    <div key={order._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                        {/* Card header */}
                        <div className="flex items-center justify-between gap-2 px-5 py-3 bg-gray-50/70 border-b border-gray-100 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                                <Icon icon="solar:receipt-bold" width={14} className="text-gray-400 shrink-0" />
                                <span className="text-sm font-bold font-mono text-gray-800 truncate">{order.orderNumber}</span>
                                <span className="hidden sm:block text-xs text-gray-400">{fmtDate(order.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
                                    <Icon icon={s.icon} width={11} />
                                    {s.label}
                                </span>
                                <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full ${ps.cls}`}>
                                    {ps.label}
                                </span>
                                <span className="text-sm font-black text-gray-900">{fmt(order.total, symbol)}</span>
                            </div>
                        </div>

                        {/* Item preview */}
                        <div className="flex items-center gap-4 px-5 py-4">
                            {firstItem?.productImage ? (
                                <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                                    <Image src={firstItem.productImage} alt={firstItem.productTitle}
                                        fill className="object-cover" sizes="56px" />
                                </div>
                            ) : (
                                <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                                    <Icon icon="mdi:package-variant" width={24} className="text-gray-300" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">{firstItem?.productTitle ?? "—"}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {more > 0 ? `+${more} more item${more !== 1 ? "s" : ""}` : `${firstItem?.quantity ?? 1} unit${(firstItem?.quantity ?? 1) !== 1 ? "s" : ""}`}
                                </p>
                                <p className="text-xs text-gray-400 sm:hidden mt-0.5">{fmtDate(order.createdAt)}</p>
                            </div>
                            <Link href={`/account/seller-orders/${order._id}`}
                                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition">
                                View
                                <Icon icon="solar:arrow-right-bold" width={13} />
                            </Link>
                        </div>
                    </div>
                );
            })}

            {/* ── Pagination ── */}
            {pages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 transition">
                        <Icon icon="solar:arrow-left-bold" width={14} />
                        Prev
                    </button>
                    <span className="text-sm text-gray-500 font-medium">
                        {page} <span className="text-gray-300">of</span> {pages}
                    </span>
                    <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 transition">
                        Next
                        <Icon icon="solar:arrow-right-bold" width={14} />
                    </button>
                </div>
            )}
        </div>
    );
}
