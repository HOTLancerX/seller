"use client";

/**
 * Seller account — Order Detail  (/account/seller-orders/:id)
 *
 * Like the admin order detail but seller-scoped:
 *   - Commission breakdown per item (admin % vs seller net)
 *   - Seller can mark order as "processing" or "shipped" only
 *   - No payment status editing, no customer private data exposure beyond
 *     what's needed to fulfil the order (name, phone, address)
 */

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { useUser } from "@/context/Provider";
import useSettings from "@/lib/useSettings";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
    productId:      string;
    productTitle:   string;
    productImage?:  string;
    variantOptions?: Record<string, string>;
    sku?:           string;
    price:          number;
    quantity:       number;
    subtotal:       number;
    orderNote?:     string;
    uploadedBy?:    string;
    // enriched client-side:
    commissionRate?: number;
    adminAmount?:    number;
    sellerAmount?:   number;
}

interface Order {
    _id:            string;
    orderNumber:    string;
    status:         string;
    paymentStatus:  string;
    items:          OrderItem[];
    shippingAddress: {
        name: string; phone: string; address: string;
        state: string; city: string; zipCode?: string;
    };
    shippingMethod: string;
    shippingCost:   number;
    subtotal:       number;
    total:          number;
    notes?:         string;
    timeline:       { status: string; note: string; createdByName: string; createdAt: string }[];
    createdAt:      string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Seller can push to these statuses via the dropdown or quick buttons
const SELLER_STATUSES = ["processing", "shipped", "delivered", "cancelled"];

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: string }> = {
    pending:    { label: "Pending",    cls: "bg-yellow-100 text-yellow-700",    icon: "mdi:clock-outline" },
    processing: { label: "Processing", cls: "bg-blue-100 text-blue-700",       icon: "mdi:cog-outline" },
    shipped:    { label: "Shipped",    cls: "bg-indigo-100 text-indigo-700",   icon: "mdi:truck-delivery-outline" },
    delivered:  { label: "Delivered",  cls: "bg-emerald-100 text-emerald-700", icon: "mdi:check-circle-outline" },
    cancelled:  { label: "Cancelled",  cls: "bg-red-100 text-red-700",         icon: "mdi:close-circle-outline" },
    paid:       { label: "Paid",       cls: "bg-emerald-100 text-emerald-700", icon: "mdi:credit-card-check-outline" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, symbol: string) {
    return `${symbol} ${Number(n).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`.trim();
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
                <Icon icon={icon} width={16} className="text-gray-400 shrink-0" />
                <h2 className="text-sm font-bold text-gray-800">{title}</h2>
            </div>
            <div className="px-5 py-4">{children}</div>
        </div>
    );
}

// ── Commission fetch — reads category seller_commission from PostInfo ─────────

async function fetchCommissionRate(productId: string): Promise<number> {
    try {
        // Get the product's category from Express /post?id=
        const EXPRESS_API = process.env.NEXT_PUBLIC_EXPRESS_API_URL ?? "http://localhost:5000";
        const LICENSE_KEY = process.env.NEXT_PUBLIC_LICENSE_KEY ?? "";
        const headers = { "x-license-key": LICENSE_KEY };

        const postRes = await fetch(`${EXPRESS_API}/post?id=${productId}`, {
            credentials: "include", headers,
        });
        if (!postRes.ok) return 0;
        const postData = await postRes.json();
        const categoryId: string | null = postData.post?.category ?? null;
        if (!categoryId) return 0;

        // Get the category's seller_commission info field
        const catRes = await fetch(`${EXPRESS_API}/cat?id=${categoryId}`, {
            credentials: "include", headers,
        });
        if (!catRes.ok) return 0;
        const catData = await catRes.json();
        const commissionInfo = (catData.info ?? []).find(
            (i: { name: string; value: string }) => i.name === "seller_commission"
        );
        return parseFloat(commissionInfo?.value ?? "0") || 0;
    } catch {
        return 0;
    }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SellerOrderDetails() {
    const pathname     = usePathname();
    const id           = pathname?.split("/").filter(Boolean).pop() ?? "";
    const { user }     = useUser();
    const { settings } = useSettings();
    const symbol       = (settings?.product_currency_symbol || settings?.currency_symbol || "") as string;

    const [order,    setOrder]    = useState<Order | null>(null);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState("");
    const [newStatus, setNewStatus] = useState("");
    const [note,     setNote]     = useState("");
    const [saving,   setSaving]   = useState(false);
    const [saveMsg,  setSaveMsg]  = useState("");
    const [locationMap, setLocationMap] = useState<Record<string, string>>({});

    // Enriched items with commission breakdown
    const [enrichedItems, setEnrichedItems] = useState<OrderItem[]>([]);

    const fetchOrder = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/orders/id/${id}`, { credentials: "include" });
            if (res.status === 404) { setError("Order not found."); return; }
            if (!res.ok)            { setError("Could not load order."); return; }
            const data = await res.json();
            const o: Order = data.order;
            setOrder(o);
            setNewStatus(o.status);

            // Enrich seller's items with commission breakdown
            const myItems = o.items.filter(
                (item) => !item.uploadedBy || item.uploadedBy === user?._id
            );

            const enriched = await Promise.all(
                myItems.map(async (item) => {
                    const rate        = await fetchCommissionRate(item.productId);
                    const adminAmount = parseFloat(((item.subtotal * rate) / 100).toFixed(2));
                    const sellerAmount = parseFloat((item.subtotal - adminAmount).toFixed(2));
                    return { ...item, commissionRate: rate, adminAmount, sellerAmount };
                })
            );
            setEnrichedItems(enriched);
        } catch {
            setError("Network error.");
        } finally {
            setLoading(false);
        }
    }, [id, user?._id]);

    useEffect(() => { fetchOrder(); }, [fetchOrder]);

    useEffect(() => {
        fetch("/api/location/category?type=location")
            .then((r) => (r.ok ? r.json() : { categories: [] }))
            .then((data) => {
                const map: Record<string, string> = {};
                for (const loc of data.categories || []) {
                    const locId = loc.id || loc._id;
                    if (locId) map[locId] = loc.title;
                }
                setLocationMap(map);
            })
            .catch(() => {});
    }, []);

    const handleSave = async () => {
        if (!order || !newStatus) return;
        setSaving(true);
        setSaveMsg("");
        try {
            const body: Record<string, any> = { note: note.trim() || undefined };
            if (newStatus !== order.status) body.status = newStatus;

            const res = await fetch(`/api/orders/${order.orderNumber}`, {
                method:      "PUT",
                credentials: "include",
                headers:     { "Content-Type": "application/json" },
                body:        JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) { setSaveMsg(`Error: ${data.error ?? "Failed to save"}`); return; }

            setOrder(data.order);
            setNewStatus(data.order.status);
            setNote("");
            setSaveMsg("Status updated.");
            setTimeout(() => setSaveMsg(""), 3000);
        } catch {
            setSaveMsg("Network error.");
        } finally {
            setSaving(false);
        }
    };

    const handleQuickAction = async (targetStatus: "delivered" | "cancelled") => {
        if (!order) return;
        const label = targetStatus === "delivered" ? "delivered" : "cancelled";
        if (!confirm(`Mark this order as ${label}?`)) return;
        setSaving(true);
        setSaveMsg("");
        try {
            const res = await fetch(`/api/orders/${order.orderNumber}`, {
                method:      "PUT",
                credentials: "include",
                headers:     { "Content-Type": "application/json" },
                body:        JSON.stringify({
                    status: targetStatus,
                    note:   targetStatus === "delivered"
                        ? "Order marked as delivered by seller."
                        : "Order cancelled by seller.",
                }),
            });
            const data = await res.json();
            if (!res.ok) { setSaveMsg(`Error: ${data.error ?? "Failed to save"}`); return; }
            setOrder(data.order);
            setNewStatus(data.order.status);
            setSaveMsg(`Order marked as ${label}.`);
            setTimeout(() => setSaveMsg(""), 3000);
        } catch {
            setSaveMsg("Network error.");
        } finally {
            setSaving(false);
        }
    };

    // ── Total seller earnings for this order ──────────────────────────────────
    const totalSellerEarnings = enrichedItems.reduce((s, i) => s + (i.sellerAmount ?? i.subtotal), 0);
    const totalAdminCommission = enrichedItems.reduce((s, i) => s + (i.adminAmount ?? 0), 0);

    // ── Guards ────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32 text-gray-300">
                <Icon icon="svg-spinners:ring-resize" width={36} />
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="text-center py-32">
                <Icon icon="solar:receipt-remove-outline" width={52} className="mx-auto mb-4 text-gray-200" />
                <p className="text-base font-semibold text-gray-500">{error || "Order not found."}</p>
                <Link href="/account/seller-orders"
                    className="mt-4 inline-flex items-center gap-1.5 text-main hover:underline text-sm">
                    <Icon icon="solar:arrow-left-bold" width={14} />
                    Back to Seller Orders
                </Link>
            </div>
        );
    }

    const orderStatus  = STATUS_BADGE[order.status]  ?? STATUS_BADGE.pending;
    const isDirty      = newStatus !== order.status || note.trim() !== "";
    const canUpdate    = !["cancelled"].includes(order.status);

    return (
        <div className="space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <Link href="/account/seller-orders"
                        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition">
                        <Icon icon="solar:arrow-left-bold" width={14} />
                        Seller Orders
                    </Link>
                    <span className="text-gray-300">/</span>
                    <h1 className="text-base font-bold text-gray-900 font-mono">{order.orderNumber}</h1>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${orderStatus.cls}`}>
                        <Icon icon={orderStatus.icon} width={12} />
                        {orderStatus.label}
                    </span>
                    <span className="text-xs text-gray-400">{fmtDate(order.createdAt)}</span>
                </div>
            </div>

            {/* Progress tracker */}
            {order.status !== "cancelled" && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5">
                    {(() => {
                        const steps = ["pending", "processing", "shipped", "delivered"];
                        const current = steps.indexOf(order.status);
                        return (
                            <div className="flex items-center gap-0">
                                {steps.map((step, i) => {
                                    const done   = i <= current;
                                    const active = i === current;
                                    const s = STATUS_BADGE[step] ?? STATUS_BADGE.pending;
                                    return (
                                        <div key={step} className="flex items-center flex-1 last:flex-none">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                                    done ? "bg-main text-white" : "bg-gray-100 text-gray-300"
                                                } ${active ? "ring-4 ring-main/20" : ""}`}>
                                                    <Icon icon={s.icon} width={16} />
                                                </div>
                                                <span className={`text-[10px] font-semibold capitalize whitespace-nowrap ${
                                                    done ? "text-main" : "text-gray-300"
                                                }`}>{step}</span>
                                            </div>
                                            {i < steps.length - 1 && (
                                                <div className={`flex-1 h-0.5 mb-5 mx-1 ${i < current ? "bg-main" : "bg-gray-100"}`} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* ── Left column ── */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Items with commission breakdown */}
                    <Card title={`My Items (${enrichedItems.length})`} icon="mdi:package-variant-closed">
                        <div className="divide-y divide-gray-50">
                            {enrichedItems.map((item, i) => (
                                <div key={i} className="py-4 first:pt-0 last:pb-0 space-y-3">
                                    <div className="flex gap-3">
                                        {item.productImage ? (
                                            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                                                <Image src={item.productImage} alt={item.productTitle}
                                                    fill className="object-cover" sizes="56px" />
                                            </div>
                                        ) : (
                                            <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                                                <Icon icon="mdi:image-off" width={20} className="text-gray-300" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 line-clamp-2">{item.productTitle}</p>
                                            {item.variantOptions && Object.keys(item.variantOptions).length > 0 && (
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {Object.entries(item.variantOptions).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                                                </p>
                                            )}
                                            {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
                                            {item.orderNote && <p className="text-xs text-gray-500 italic mt-0.5">Note: {item.orderNote}</p>}
                                            <p className="text-xs text-gray-400 mt-1">
                                                ×{item.quantity} @ {fmt(item.price, symbol)}
                                            </p>
                                        </div>
                                        <p className="text-sm font-bold text-gray-900 shrink-0">{fmt(item.subtotal, symbol)}</p>
                                    </div>

                                    {/* Commission breakdown pill */}
                                    <div className="flex flex-wrap gap-2 pl-17">
                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">
                                            <Icon icon="solar:pie-chart-bold" width={13} />
                                            Gross: {fmt(item.subtotal, symbol)}
                                        </span>
                                        {(item.commissionRate ?? 0) > 0 && (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-50 text-red-600">
                                                <Icon icon="solar:arrow-up-bold" width={13} />
                                                Admin {item.commissionRate}%: {fmt(item.adminAmount ?? 0, symbol)}
                                            </span>
                                        )}
                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">
                                            <Icon icon="solar:wallet-bold" width={13} />
                                            You earn: {fmt(item.sellerAmount ?? item.subtotal, symbol)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Order totals + earnings summary */}
                        <div className="mt-4 pt-4 border-t border-gray-50 space-y-1.5">
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Items subtotal</span>
                                <span className="font-medium text-gray-700">{fmt(order.subtotal, symbol)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Shipping ({order.shippingMethod})</span>
                                <span className="font-medium text-gray-700">{fmt(order.shippingCost, symbol)}</span>
                            </div>
                            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-50">
                                <span>Order total</span>
                                <span>{fmt(order.total, symbol)}</span>
                            </div>
                        </div>

                        {/* Earnings summary box */}
                        <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-100 p-4 space-y-2">
                            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                                Your Earnings Breakdown
                            </p>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Admin commission</span>
                                <span className="font-semibold text-red-500">− {fmt(totalAdminCommission, symbol)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold border-t border-emerald-100 pt-2">
                                <span className="text-gray-800">Your net earnings</span>
                                <span className="text-emerald-700 text-base">{fmt(totalSellerEarnings, symbol)}</span>
                            </div>
                            <p className="text-[10px] text-emerald-600">
                                Released to wallet 7 days after delivery confirmation.
                            </p>
                        </div>
                    </Card>

                    {/* Shipping address — seller needs it to fulfil */}
                    <Card title="Delivery Address" icon="mdi:map-marker-outline">
                        <div className="text-sm text-gray-700 space-y-1">
                            <p className="font-semibold text-gray-900">{order.shippingAddress.name}</p>
                            {order.shippingAddress.phone && (
                                <p className="flex items-center gap-1.5 text-gray-500">
                                    <Icon icon="mdi:phone-outline" width={14} />
                                    {order.shippingAddress.phone}
                                </p>
                            )}
                            {order.shippingAddress.address && <p>{order.shippingAddress.address}</p>}
                            {(order.shippingAddress.city || order.shippingAddress.state) && (
                                <p>{[locationMap[order.shippingAddress.city] || order.shippingAddress.city, locationMap[order.shippingAddress.state] || order.shippingAddress.state].filter(Boolean).join(", ")}</p>
                            )}
                            {order.shippingAddress.zipCode && <p>{order.shippingAddress.zipCode}</p>}
                        </div>
                    </Card>

                    {/* Timeline */}
                    {order.timeline.length > 0 && (
                        <Card title="Order Updates" icon="mdi:timeline-clock-outline">
                            <ol className="relative border-l border-gray-100 space-y-5 ml-3">
                                {[...order.timeline].reverse().map((entry, i) => {
                                    const s = STATUS_BADGE[entry.status] ?? STATUS_BADGE.pending;
                                    return (
                                        <li key={i} className="ml-5">
                                            <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-gray-100 ring-4 ring-white">
                                                <Icon icon={s.icon} width={13} className="text-gray-400" />
                                            </span>
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800 capitalize">{entry.status}</p>
                                                    <p className="text-sm text-gray-500 mt-0.5">{entry.note}</p>
                                                </div>
                                                <p className="text-xs text-gray-400 whitespace-nowrap shrink-0">{fmtDate(entry.createdAt)}</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        </Card>
                    )}
                </div>

                {/* ── Right sidebar ── */}
                <div className="space-y-5">

                    {/* Update status — seller-limited actions */}
                    {canUpdate && (
                        <Card title="Update Order" icon="solar:pen-bold">
                            <div className="space-y-4">
                                {saveMsg && (
                                    <div className={`text-sm font-medium px-3 py-2 rounded-lg border ${
                                        saveMsg.startsWith("Error")
                                            ? "bg-red-50 text-red-600 border-red-200"
                                            : "bg-emerald-50 text-emerald-600 border-emerald-200"
                                    }`}>
                                        {saveMsg}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                        Order Status
                                    </label>
                                    <select
                                        value={newStatus}
                                        onChange={e => setNewStatus(e.target.value)}
                                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value={order.status}>
                                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)} (current)
                                        </option>
                                        {SELLER_STATUSES
                                            .filter(s => s !== order.status)
                                            .map(s => (
                                                <option key={s} value={s}>
                                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                                </option>
                                            ))
                                        }
                                    </select>
                                    <p className="text-xs text-gray-400 mt-1">
                                        You can mark orders as Processing or Shipped.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                        Note <span className="font-normal text-gray-400">(optional)</span>
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        placeholder="e.g. Tracking number: XYZ123…"
                                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving || !isDirty}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving
                                        ? <><Icon icon="svg-spinners:ring-resize" width={16} /> Saving…</>
                                        : <><Icon icon="solar:check-circle-bold" width={16} /> Update Status</>
                                    }
                                </button>

                                {/* Quick action buttons */}
                                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-50">
                                    <button
                                        type="button"
                                        onClick={() => handleQuickAction("delivered")}
                                        disabled={saving || order.status === "delivered" || order.status === "cancelled"}
                                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Icon icon="mdi:check-circle-outline" width={15} />
                                        Delivered
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleQuickAction("cancelled")}
                                        disabled={saving || order.status === "delivered" || order.status === "cancelled"}
                                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Icon icon="mdi:close-circle-outline" width={15} />
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Order summary */}
                    <Card title="Summary" icon="mdi:receipt-text-outline">
                        <dl className="space-y-2 text-sm">
                            {[
                                ["Order #",  <span className="font-mono text-xs">{order.orderNumber}</span>],
                                ["Placed",   fmtDate(order.createdAt)],
                                ["Shipping", <span className="capitalize">{order.shippingMethod}</span>],
                                ["Status",   <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${orderStatus.cls}`}>
                                    {orderStatus.label}
                                </span>],
                            ].map(([label, value]) => (
                                <div key={String(label)} className="flex justify-between gap-3">
                                    <dt className="text-gray-500 shrink-0">{label}</dt>
                                    <dd className="text-gray-800 text-right">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </Card>

                    {/* Notes */}
                    {order.notes && (
                        <Card title="Order Notes" icon="mdi:note-text-outline">
                            <p className="text-sm text-gray-700 whitespace-pre-line">{order.notes}</p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
