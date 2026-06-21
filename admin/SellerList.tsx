"use client";

/**
 * Admin — Seller List  (/admin/seller)
 *
 * Shows all users with type="seller" alongside their wallet balance.
 * Links to the existing user edit page for permission management.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

interface Seller {
    _id:       string;
    name:      string;
    email:     string;
    phone?:    string;
    image?:    string;
    slug:      string;
    status:    "active" | "inactive" | "suspended";
    createdAt: string;
    // wallet — loaded separately
    balance?:        number;
    pendingBalance?: number;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    active:    { label: "Active",    cls: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300" },
    inactive:  { label: "Inactive",  cls: "bg-gray-100 text-gray-500 ring-1 ring-gray-300" },
    suspended: { label: "Suspended", cls: "bg-red-100 text-red-700 ring-1 ring-red-300" },
};

function fmt(n: number) {
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SellerList() {
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [loading, setLoading] = useState(true);
    const [search,  setSearch]  = useState("");

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                // Fetch all users with type=seller from Express
                const EXPRESS_API = process.env.NEXT_PUBLIC_EXPRESS_API_URL ?? "http://localhost:5000";
                const LICENSE_KEY = process.env.NEXT_PUBLIC_LICENSE_KEY ?? "";
                const res = await fetch(`${EXPRESS_API}/user?type=seller`, {
                    credentials: "include",
                    headers: { "x-license-key": LICENSE_KEY },
                    cache: "no-store",
                });
                const data = res.ok ? await res.json() : {};
                // Filter to sellers only — Express /user returns all users
                const users: Seller[] = (data.users ?? []).filter(
                    (u: any) => u.type === "seller"
                );

                // Fetch wallet balances in parallel
                const withWallets = await Promise.all(
                    users.map(async (u) => {
                        try {
                            const wr = await fetch(`/api/seller/wallet?userId=${u._id}`, {
                                credentials: "include",
                            });
                            if (!wr.ok) return u;
                            const wd = await wr.json();
                            return {
                                ...u,
                                balance:        wd.wallet?.balance        ?? 0,
                                pendingBalance: wd.wallet?.pendingBalance ?? 0,
                            };
                        } catch {
                            return u;
                        }
                    })
                );

                setSellers(withWallets);
            } catch { /* silent */ }
            finally { setLoading(false); }
        })();
    }, []);

    const filtered = sellers.filter(s =>
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Sellers</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {sellers.length} seller{sellers.length !== 1 ? "s" : ""}
                    </p>
                </div>
                <Link
                    href="/admin/users/add"
                    className="inline-flex items-center gap-2 bg-linear-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-xl font-medium hover:opacity-90 transition text-sm shadow"
                >
                    <Icon icon="solar:user-plus-bold" width={18} />
                    Add Seller
                </Link>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Icon icon="solar:magnifer-linear" width={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search sellers…"
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                />
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20 text-gray-400">
                    <Icon icon="svg-spinners:ring-resize" width={32} />
                </div>
            )}

            {/* Empty */}
            {!loading && filtered.length === 0 && (
                <div className="text-center py-20 text-gray-400">
                    <Icon icon="solar:shop-bold" width={48} className="mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium">
                        {search ? "No sellers match your search." : "No sellers yet."}
                    </p>
                    {!search && (
                        <p className="text-sm mt-1 text-gray-400">
                            Grant a user the <span className="font-semibold text-amber-600">Seller</span> role
                            from the Users admin page.
                        </p>
                    )}
                </div>
            )}

            {/* Table */}
            {!loading && filtered.length > 0 && (
                <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Seller</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Contact</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Available Balance</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Pending</th>
                                <th className="text-left px-5 py-3 font-semibold text-gray-600">Joined</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map(seller => {
                                const badge = STATUS_BADGE[seller.status] ?? STATUS_BADGE.inactive;
                                return (
                                    <tr key={seller._id} className="hover:bg-gray-50 transition">

                                        {/* Avatar + name */}
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                {seller.image ? (
                                                    <img src={seller.image} alt={seller.name}
                                                        className="w-9 h-9 rounded-xl object-cover ring-2 ring-orange-100" />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
                                                        {seller.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-semibold text-gray-900">{seller.name}</p>
                                                    <p className="text-xs text-gray-400 font-mono">/{seller.slug}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Contact */}
                                        <td className="px-5 py-3 text-gray-500">
                                            <p>{seller.email}</p>
                                            {seller.phone && <p className="text-xs text-gray-400">{seller.phone}</p>}
                                        </td>

                                        {/* Status */}
                                        <td className="px-5 py-3">
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>
                                                {badge.label}
                                            </span>
                                        </td>

                                        {/* Balance */}
                                        <td className="px-5 py-3">
                                            {seller.balance !== undefined ? (
                                                <span className="font-semibold text-emerald-700">
                                                    {fmt(seller.balance)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>

                                        {/* Pending */}
                                        <td className="px-5 py-3">
                                            {seller.pendingBalance !== undefined ? (
                                                <span className="text-yellow-600 font-medium">
                                                    {fmt(seller.pendingBalance)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>

                                        {/* Joined */}
                                        <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                                            {new Date(seller.createdAt).toLocaleDateString()}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/admin/users/${seller._id}`}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                                                >
                                                    <Icon icon="solar:pen-bold" width={13} />
                                                    Edit
                                                </Link>
                                                <Link
                                                    href={`/admin/seller/withdrawals?userId=${seller._id}`}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition"
                                                >
                                                    <Icon icon="solar:wallet-money-bold" width={13} />
                                                    Wallet
                                                </Link>
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
