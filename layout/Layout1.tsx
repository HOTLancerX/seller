/**
 * Seller Profile Layout 1
 *
 * URL pattern: /seller/<seller-slug>  (permalink configured in admin)
 *
 * Receives from [...]slug/page.tsx:
 *   data       — the "seller" post record (title = seller display name, info.userId)
 *   settings   — site settings (currency symbol, etc.)
 *   permalinkMap — prefix map
 *   pageData   — { seller, products, activeBox } injected by serverHooks.ts
 *
 * Shows:
 *   - Seller profile card (avatar, name, bio, website, social links)
 *   - Published products grid using the active product-box template
 */

import Image from "next/image";
import Link from "next/link";
import SellerProductGrid from "./SellerProductGrid";
import { Icon } from "@iconify/react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SellerInfo {
    _id:     string;
    name:    string;
    slug:    string;
    image:   string;
    type:    string;
    address: string;
    city:    string;
    state:   string;
    bio:     string;
    website: string;
    twitter: string;
}

interface SellerPageData {
    seller:    SellerInfo | null;
    products:  any[];
    activeBox: { label: string; pluginNx: string } | null;
}

interface SellerLayout1Props {
    data: {
        _id:       string;
        title:     string;
        slug:      string;
        status:    string;
        createdAt: string;
        info:      Record<string, string>;
    };
    settings?:     Record<string, any>;
    permalinkMap?: Record<string, string>;
    pageData?:     SellerPageData;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUrl(prefix: string, slug: string): string {
    const p = prefix.trim().replace(/^\/+|\/+$/g, "");
    return p ? `/${p}/${slug}` : `/${slug}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SellerLayout1({
    data,
    settings = {},
    permalinkMap = {},
    pageData,
}: SellerLayout1Props) {
    const seller   = pageData?.seller   ?? null;
    const products = pageData?.products ?? [];
    const activeBox = pageData?.activeBox ?? null;

    const productPrefix = (permalinkMap["product"] ?? "product")
        .trim().replace(/^\/+|\/+$/g, "") || "product";
    const currencySymbol = (settings.product_currency_symbol as string) || "$";

    return (
        <main className="min-h-screen bg-gray-50">

            {/* ── Hero banner ── */}
            <header className="bg-linear-to-r from-orange-500 to-amber-600 py-12 px-6">
                <div className="container">
                    <nav className="flex items-center gap-1.5 text-sm text-white/70 mb-6 flex-wrap">
                        <Link href="/" className="hover:text-white transition-colors">Home</Link>
                        <span className="text-white/40">›</span>
                        <span className="text-white font-medium">Seller</span>
                        <span className="text-white/40">›</span>
                        <span className="text-white font-medium">{data.title}</span>
                    </nav>

                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                        {/* Avatar */}
                        <div className="shrink-0">
                            {seller?.image ? (
                                <div className="relative w-24 h-24 rounded-2xl overflow-hidden ring-4 ring-white/30 shadow-lg">
                                    <Image
                                        src={seller.image}
                                        alt={seller.name}
                                        fill
                                        className="object-cover"
                                        sizes="96px"
                                    />
                                </div>
                            ) : (
                                <div className="w-24 h-24 rounded-2xl bg-white/20 flex items-center justify-center text-white font-bold text-4xl ring-4 ring-white/30">
                                    {(seller?.name ?? data.title).charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="text-center sm:text-left space-y-2">
                            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                                    {seller?.name ?? data.title}
                                </h1>
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 text-white">
                                    ✓ Verified Seller
                                </span>
                            </div>

                            {/* Location */}
                            {(seller?.city || seller?.state) && (
                                <p className="flex items-center justify-center sm:justify-start gap-1.5 text-white/80 text-sm">
                                    📍 {[seller.city, seller.state].filter(Boolean).join(", ")}
                                </p>
                            )}

                            {/* Bio */}
                            {seller?.bio && (
                                <p className="text-white/80 text-sm max-w-xl">
                                    {seller.bio}
                                </p>
                            )}

                            {/* Social links */}
                            <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap pt-1">
                                {seller?.website && (
                                    <a href={seller.website} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white transition-colors">
                                        🌐 Website
                                    </a>
                                )}
                                {seller?.twitter && (
                                    <a href={`https://x.com/${seller.twitter.replace(/^@/, "")}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80 hover:text-white transition-colors">
                                        𝕏 {seller.twitter.startsWith("@") ? seller.twitter : `@${seller.twitter}`}
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Product count badge */}
                        <div className="sm:ml-auto text-center">
                            <div className="bg-white/20 rounded-2xl px-6 py-4">
                                <p className="text-3xl font-extrabold text-white">{products.length}</p>
                                <p className="text-xs text-white/70 mt-0.5">Product{products.length !== 1 ? "s" : ""}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Products section ── */}
            <div className="container py-10">
                <div className="flex items-center gap-3 mb-6">
                    <span className="text-orange-500">🛒</span>
                    <h2 className="text-xl font-bold text-gray-900">
                        Products by {seller?.name ?? data.title}
                    </h2>
                </div>

                <SellerProductGrid
                    products={products}
                    activeBox={activeBox}
                    productPrefix={productPrefix}
                    currencySymbol={currencySymbol}
                />
            </div>
        </main>
    );
}
