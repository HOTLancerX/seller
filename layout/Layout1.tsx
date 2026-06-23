/**
 * Seller Profile Layout 1
 *
 * URL pattern: /seller/<seller-slug>  (permalink configured in admin)
 *
 * Receives from [...]slug/page.tsx:
 *   data         — the "seller" post record (title = seller display name, info.userId)
 *   settings     — site settings (currency symbol, etc.)
 *   permalinkMap — prefix map
 *   pageData     — { seller, products, activeBox } injected by serverHooks.ts
 *
 * Shows:
 *   - Cover photo banner (seller_cover)
 *   - Profile avatar (user.image), store name, bio/description, location
 *   - Contact links (website, twitter, whatsapp, business email)
 *   - Published products grid using the active product-box template
 */

import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import SellerProductGrid from "./SellerProductGrid";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SellerInfo {
    _id:                   string;
    name:                  string;
    slug:                  string;
    image:                 string;
    type:                  string;
    address:               string;
    city:                  string;
    state:                 string;
    bio:                   string;
    website:               string;
    twitter:               string;
    seller_cover:          string;
    seller_store_name:     string;
    seller_description:    string;
    seller_whatsapp:       string;
    seller_business_email: string;
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function SellerLayout1({
    data,
    settings = {},
    permalinkMap = {},
    pageData,
}: SellerLayout1Props) {
    const seller    = pageData?.seller   ?? null;
    const products  = pageData?.products ?? [];
    const activeBox = pageData?.activeBox ?? null;

    const displayName    = seller?.seller_store_name || seller?.name || data.title;
    const productPrefix  = (permalinkMap["product"] ?? "product").trim().replace(/^\/+|\/+$/g, "") || "product";
    const currencySymbol = (settings.product_currency_symbol as string) || "$";

    return (
        <main className="min-h-screen bg-gray-50">

            {/* ── Cover photo ── */}
            {seller?.seller_cover ? (
                <div className="relative w-full h-48 sm:h-64 overflow-hidden bg-linear-to-r from-orange-500 to-amber-600">
                    <Image
                        src={seller.seller_cover}
                        alt={`${displayName} cover`}
                        fill
                        className="object-cover"
                        sizes="100vw"
                        priority
                    />
                    <div className="absolute inset-0 bg-black/30" />
                </div>
            ) : (
                <div className="w-full h-48 sm:h-64 bg-linear-to-r from-orange-500 to-amber-600" />
            )}

            {/* ── Profile card ── */}
            <div className="container">
                <div className="relative -mt-16 mb-8 flex flex-col sm:flex-row items-start gap-5">

                    {/* Avatar — overlaps the cover */}
                    <div className="shrink-0 z-10">
                        {seller?.image ? (
                            <div className="relative w-28 h-28 rounded-2xl overflow-hidden ring-4 ring-white shadow-xl">
                                <Image
                                    src={seller.image}
                                    alt={displayName}
                                    fill
                                    className="object-cover"
                                    sizes="112px"
                                />
                            </div>
                        ) : (
                            <div className="w-28 h-28 rounded-2xl bg-linear-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-5xl ring-4 ring-white shadow-xl">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    {/* Info row */}
                    <div className="flex-1 pt-16 sm:pt-2 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">
                                        {displayName}
                                    </h1>
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                                        <Icon icon="solar:check-circle-bold" width={12} />
                                        Verified Seller
                                    </span>
                                </div>

                                {/* Location */}
                                {(seller?.city || seller?.state) && (
                                    <p className="flex items-center gap-1.5 text-gray-500 text-sm mt-1">
                                        <Icon icon="solar:map-point-bold" width={13} />
                                        {[seller.city, seller.state].filter(Boolean).join(", ")}
                                    </p>
                                )}
                            </div>

                            {/* Product count */}
                            <div className="shrink-0 text-center bg-white border border-orange-100 rounded-2xl px-6 py-3 shadow-sm">
                                <p className="text-3xl font-extrabold text-orange-500">{products.length}</p>
                                <p className="text-xs text-gray-400 mt-0.5">Product{products.length !== 1 ? "s" : ""}</p>
                            </div>
                        </div>

                        {/* Description / bio */}
                        {(seller?.seller_description || seller?.bio) && (
                            <p className="mt-3 text-sm text-gray-600 max-w-2xl leading-relaxed">
                                {seller.seller_description || seller.bio}
                            </p>
                        )}

                        {/* Contact links */}
                        <div className="flex flex-wrap items-center gap-3 mt-3">
                            {seller?.website && (
                                <a href={seller.website} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-orange-600 transition-colors bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                                    <Icon icon="solar:globe-bold" width={13} />
                                    Website
                                </a>
                            )}
                            {seller?.twitter && (
                                <a href={`https://x.com/${seller.twitter.replace(/^@/, "")}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-orange-600 transition-colors bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                                    <Icon icon="ri:twitter-x-fill" width={13} />
                                    {seller.twitter.startsWith("@") ? seller.twitter : `@${seller.twitter}`}
                                </a>
                            )}
                            {seller?.seller_whatsapp && (
                                <a href={`https://wa.me/${seller.seller_whatsapp.replace(/\D/g, "")}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-emerald-600 transition-colors bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                                    <Icon icon="ri:whatsapp-fill" width={13} />
                                    WhatsApp
                                </a>
                            )}
                            {seller?.seller_business_email && (
                                <a href={`mailto:${seller.seller_business_email}`}
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-orange-600 transition-colors bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                                    <Icon icon="solar:letter-bold" width={13} />
                                    {seller.seller_business_email}
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* Breadcrumb */}
                <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-8 flex-wrap">
                    <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
                    <Icon icon="solar:alt-arrow-right-bold" width={12} className="text-gray-300" />
                    <span className="text-gray-500">Seller</span>
                    <Icon icon="solar:alt-arrow-right-bold" width={12} className="text-gray-300" />
                    <span className="text-gray-700 font-medium">{displayName}</span>
                </nav>

                {/* ── Products section ── */}
                <div className="pb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <Icon icon="solar:cart-large-bold" width={20} className="text-orange-500" />
                        <h2 className="text-xl font-bold text-gray-900">
                            Products by {displayName}
                        </h2>
                    </div>

                    <SellerProductGrid
                        products={products}
                        activeBox={activeBox}
                        productPrefix={productPrefix}
                        currencySymbol={currencySymbol}
                    />
                </div>
            </div>
        </main>
    );
}
