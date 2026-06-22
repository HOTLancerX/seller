"use client";

/**
 * Seller account — My Products  (/account/post/product)
 *
 * Lists all products uploaded by the currently logged-in seller.
 * The API is queried with the session userId so only their own products appear.
 * Sellers can add, edit, or delete their own products from this page.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { useUser } from "@/context/Provider";

interface Product {
    _id: string;
    title: string;
    slug: string;
    status: string;
    createdAt: string;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    published: { label: "Published", cls: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300" },
    draft:     { label: "Draft",     cls: "bg-amber-100 text-amber-700 ring-1 ring-amber-300" },
    trash:     { label: "Trash",     cls: "bg-red-100 text-red-700 ring-1 ring-red-300" },
};

export default function SellerProductList() {
    const { user } = useUser();

    const [products, setProducts] = useState<Product[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);

    const fetchProducts = useCallback(async () => {
        if (!user?._id) return;
        setLoading(true);
        try {
            const res = await fetch(
                `/api/seller/products?userId=${encodeURIComponent(user._id)}`,
                { credentials: "include" }
            );
            if (res.ok) {
                const data = await res.json();
                setProducts(data.products ?? []);
            }
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [user?._id]);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this product? This cannot be undone.")) return;
        setDeleting(id);
        try {
            const EXPRESS_API = process.env.NEXT_PUBLIC_EXPRESS_API_URL ?? "http://localhost:5000";
            const LICENSE_KEY = process.env.NEXT_PUBLIC_LICENSE_KEY ?? "";
            await fetch(`${EXPRESS_API}/post?id=${id}`, {
                method: "DELETE",
                credentials: "include",
                headers: { "x-license-key": LICENSE_KEY },
            });
            setProducts((prev) => prev.filter((p) => p._id !== id));
        } catch { /* silent */ }
        finally { setDeleting(null); }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">My Products</h1>
                    {!loading && (
                        <p className="text-sm text-gray-400 mt-0.5">
                            {products.length} product{products.length !== 1 ? "s" : ""}
                        </p>
                    )}
                </div>
                <Link
                    href="/account/post/product/new"
                    className="inline-flex items-center gap-2 bg-linear-to-r from-indigo-600 to-violet-600 text-white px-4 py-2 rounded-xl font-medium hover:opacity-90 transition text-sm shadow"
                >
                    <Icon icon="solar:add-circle-bold" width={18} />
                    Add Product
                </Link>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20 text-gray-300">
                    <Icon icon="svg-spinners:ring-resize" width={32} />
                </div>
            )}

            {/* Empty */}
            {!loading && products.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
                    <Icon icon="solar:cart-outline" width={52} className="mx-auto mb-4 text-gray-200" />
                    <p className="text-base font-semibold text-gray-500">No products yet</p>
                    <p className="text-sm text-gray-400 mt-1 mb-6">
                        Start by adding your first product.
                    </p>
                    <Link
                        href="/account/post/product/new"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition"
                    >
                        <Icon icon="solar:add-circle-bold" width={16} />
                        Add Product
                    </Link>
                </div>
            )}

            {/* Product table */}
            {!loading && products.length > 0 && (
                <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Title</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Created</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {products.map((product) => {
                                const badge = STATUS_BADGE[product.status] ?? STATUS_BADGE.draft;
                                return (
                                    <tr key={product._id} className="hover:bg-gray-50 transition">
                                        <td className="px-5 py-3 font-medium text-gray-800">
                                            {product.title}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>
                                                {badge.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-gray-400 text-xs">
                                            {new Date(product.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/account/post/product/${product._id}`}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                                                >
                                                    <Icon icon="solar:pen-bold" width={13} /> Edit
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(product._id)}
                                                    disabled={deleting === product._id}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-500 hover:bg-red-100 transition disabled:opacity-50"
                                                >
                                                    {deleting === product._id
                                                        ? <Icon icon="svg-spinners:ring-resize" width={13} />
                                                        : <Icon icon="solar:trash-bin-trash-bold" width={13} />
                                                    }
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
