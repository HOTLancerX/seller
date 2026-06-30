"use client";

/**
 * Seller account — My Products  (/account/post/product)
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { useUser } from "@/context/Provider";
import { xFetch } from "@/lib/express";

interface Product {
    _id:       string;
    title:     string;
    slug:      string;
    status:    string;
    image?:    string;
    price?:    number;
    createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    published: { label: "Published", dot: "bg-emerald-400", bg: "bg-emerald-50",  text: "text-emerald-700" },
    draft:     { label: "Draft",     dot: "bg-amber-400",   bg: "bg-amber-50",    text: "text-amber-700"   },
    trash:     { label: "Trash",     dot: "bg-red-400",     bg: "bg-red-50",      text: "text-red-700"     },
};

/** Build a public URL respecting the stored permalink prefix */
function buildViewUrl(permalinks: Record<string, string>, type: string, slug: string): string {
    const prefix = (permalinks[type] ?? "").trim().replace(/^\/+|\/+$/g, "");
    return prefix ? `/${prefix}/${slug}` : `/${slug}`;
}

export default function SellerProductList() {
    const { user } = useUser();

    const [products,   setProducts]   = useState<Product[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [deleting,   setDeleting]   = useState<string | null>(null);
    const [filter,     setFilter]     = useState("");
    const [permalinks, setPermalinks] = useState<Record<string, string>>({});
    const [membership, setMembership] = useState<{ status: string; productCount: number; limit: number; pkgName: string; expiresAt: string | null } | null>(null);

    // Load permalink map once
    useEffect(() => {
        xFetch("/permalink", { cache: "no-store" })
            .then((r) => r.json())
            .then((data) => { if (data && typeof data === "object" && !data.error) setPermalinks(data); })
            .catch(() => {});
    }, []);

    const fetchProducts = useCallback(async () => {
        if (!user?._id) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/seller/products?userId=${encodeURIComponent(user._id)}`, { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setProducts(data.products ?? []);
            }
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [user?._id]);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    // Load membership status
    useEffect(() => {
        if (!user?._id) return;
        fetch(`/api/seller-membership/status?userId=${user._id}`, { cache: "no-store" })
            .then((r) => r.json())
            .then((data) => {
                if (data.membership) {
                    const m = data.membership;
                    const pkg = data.package;
                    setMembership({
                        status: m.status,
                        productCount: m.productCount ?? 0,
                        limit: pkg?.productLimit ?? 0,
                        pkgName: pkg?.name ?? "",
                        expiresAt: m.expiresAt,
                    });
                }
            })
            .catch(() => {});
    }, [user?._id]);

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this product? This cannot be undone.")) return;
        setDeleting(id);
        try {
            const EXPRESS_API = process.env.NEXT_PUBLIC_EXPRESS_API_URL ?? "http://localhost:5000";
            const LICENSE_KEY = process.env.NEXT_PUBLIC_LICENSE_KEY ?? "";
            await fetch(`${EXPRESS_API}/post?id=${id}`, {
                method: "DELETE", credentials: "include",
                headers: { "x-license-key": LICENSE_KEY },
            });
            setProducts(prev => prev.filter(p => p._id !== id));
        } catch { /* silent */ }
        finally { setDeleting(null); }
    };

    const filtered = filter
        ? products.filter(p => p.status === filter)
        : products;

    const counts = products.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] ?? 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-5">

            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-black text-gray-900">My Products</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        {loading ? "Loading…" : `${products.length} product${products.length !== 1 ? "s" : ""} total`}
                    </p>
                </div>
                {membership && membership.limit > 0 && membership.productCount >= membership.limit ? (
                    <span className="inline-flex items-center gap-2 bg-gray-200 text-gray-500 px-4 py-2.5 rounded-xl font-semibold text-sm cursor-not-allowed">
                        <Icon icon="solar:add-circle-bold" width={18} />
                        Limit Reached
                    </span>
                ) : (
                    <Link href="/account/post/product/new"
                        className="inline-flex items-center gap-2 bg-linear-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 rounded-xl font-semibold hover:shadow-md hover:shadow-amber-200 hover:-translate-y-px transition-all text-sm">
                        <Icon icon="solar:add-circle-bold" width={18} />
                        Add Product
                    </Link>
                )}
            </div>

            {/* ── Membership banner ── */}
            {membership && membership.limit > 0 && (
                <div className={`rounded-xl px-4 py-3 text-sm border ${
                    membership.productCount >= membership.limit
                        ? "bg-red-50 border-red-200 text-red-700"
                        : membership.productCount >= membership.limit - 2
                            ? "bg-amber-50 border-amber-200 text-amber-700"
                            : "bg-indigo-50 border-indigo-200 text-indigo-700"
                }`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="flex items-center gap-2 font-medium">
                            <Icon icon="solar:crown-bold" width={16} />
                            {membership.pkgName} — {membership.productCount}/{membership.limit} products used
                        </span>
                        <Link href="/account/membership" className="text-xs font-semibold underline underline-offset-2">
                            {membership.productCount >= membership.limit ? "Upgrade now" : "View membership"}
                        </Link>
                    </div>
                    {membership.productCount >= membership.limit && (
                        <p className="text-xs mt-1.5">
                            You&apos;ve reached your upload limit. Upgrade your membership to add more products.
                        </p>
                    )}
                    {membership.expiresAt && (
                        <p className="text-xs mt-1 opacity-70">
                            Expires: {new Date(membership.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                        </p>
                    )}
                </div>
            )}

            {/* ── Status filter tabs ── */}
            {!loading && products.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setFilter("")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${!filter ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                        All
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${!filter ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                            {products.length}
                        </span>
                    </button>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <button key={key} onClick={() => setFilter(key === filter ? "" : key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${filter === key ? `${cfg.bg} ${cfg.text}` : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                            {counts[key] !== undefined && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === key ? "bg-black/10" : "bg-gray-100 text-gray-500"}`}>
                                    {counts[key]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Loading ── */}
            {loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
                            <div className="flex gap-3">
                                <div className="w-16 h-16 rounded-xl bg-gray-100 shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-100 rounded-lg w-3/4" />
                                    <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Empty ── */}
            {!loading && filtered.length === 0 && (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                        <Icon icon="solar:cart-large-bold" width={32} className="text-amber-400" />
                    </div>
                    <p className="text-base font-bold text-gray-600">
                        {filter ? `No ${STATUS_CONFIG[filter]?.label ?? filter} products` : "No products yet"}
                    </p>
                    <p className="text-sm text-gray-400 mt-1 mb-5">
                        {filter ? "Try a different filter." : "Start by listing your first product."}
                    </p>
                    {!filter && (
                        <Link href="/account/post/product/new"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold hover:shadow-md hover:-translate-y-px transition-all">
                            <Icon icon="solar:add-circle-bold" width={16} />
                            Add your first product
                        </Link>
                    )}
                </div>
            )}

            {/* ── Product card grid ── */}
            {!loading && filtered.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filtered.map(product => {
                        const cfg = STATUS_CONFIG[product.status] ?? STATUS_CONFIG.draft;
                        return (
                            <div key={product._id}
                                className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                                <div className="flex gap-3 p-4">
                                    {/* Thumbnail */}
                                    <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0 relative">
                                        {product.image ? (
                                            <img src={product.image} alt={product.title}
                                                className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Icon icon="solar:box-bold" width={24} className="text-gray-300" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                                            {product.title}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {new Date(product.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                        </p>
                                        <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                                            <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                                            {cfg.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Action bar */}
                                <div className="flex items-center gap-2 px-4 pb-4 pt-0 border-t border-gray-50">
                                    <Link href={`/account/post/product/${product._id}`}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition">
                                        <Icon icon="solar:pen-bold" width={13} />
                                        Edit
                                    </Link>
                                    <Link href={buildViewUrl(permalinks, "product", product.slug)} target="_blank"
                                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-50 text-gray-600 hover:bg-gray-100 transition">
                                        <Icon icon="solar:eye-bold" width={13} />
                                        View
                                    </Link>
                                    <button onClick={() => handleDelete(product._id)}
                                        disabled={deleting === product._id}
                                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition disabled:opacity-50">
                                        {deleting === product._id
                                            ? <Icon icon="svg-spinners:ring-resize" width={13} />
                                            : <Icon icon="solar:trash-bin-trash-bold" width={13} />}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
