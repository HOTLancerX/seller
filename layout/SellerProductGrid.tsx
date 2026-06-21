"use client";

/**
 * SellerProductGrid — client component that resolves the active product-box
 * component from the hook registry and renders the seller's product grid.
 *
 * Mirrors ProductGridClient exactly — just scoped to the seller layout.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { getHooks } from "@/hook";
import { useActivePlugins } from "@/hook/useActivePlugins";

interface Product {
    _id:   string;
    title: string;
    slug:  string;
    info:  Record<string, string>;
}

interface Props {
    products:      Product[];
    activeBox:     { label: string; pluginNx: string } | null;
    productPrefix: string;
    currencySymbol: string;
}

function buildUrl(prefix: string, slug: string): string {
    const p = prefix.trim().replace(/^\/+|\/+$/g, "");
    return p ? `/${p}/${slug}` : `/${slug}`;
}

export default function SellerProductGrid({
    products,
    activeBox,
    productPrefix,
    currencySymbol,
}: Props) {
    const activePlugins = useActivePlugins();
    const [BoxComponent, setBoxComponent] = useState<any>(null);

    useEffect(() => {
        if (activePlugins === null) return;

        const boxes = getHooks("root.pages").filter(
            (p) => p.type === "product-box" && p.slug === "dynamic"
        );

        let match = null;
        if (activeBox) {
            match = boxes.find(
                (b) => b.label === activeBox.label && b.pluginNx === activeBox.pluginNx
            )?.component ?? null;
        }
        if (!match) {
            match = (boxes.find((b) => b.active === true) ?? boxes[0])?.component ?? null;
        }

        setBoxComponent(() => match);
    }, [activePlugins, activeBox]);

    // Loading skeleton
    if (activePlugins === null) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: Math.min(products.length || 8, 8) }).map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 animate-pulse">
                        <div className="aspect-square bg-gray-100 rounded-t-2xl" />
                        <div className="p-3 space-y-2">
                            <div className="h-3.5 bg-gray-100 rounded w-4/5" />
                            <div className="h-3 bg-gray-100 rounded w-2/5" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (products.length === 0) {
        return (
            <div className="text-center py-20 text-gray-400">
                <p className="text-4xl mb-4">🛍️</p>
                <p className="text-lg font-medium text-gray-500">
                    This seller hasn't listed any products yet.
                </p>
            </div>
        );
    }

    if (BoxComponent) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((product) => (
                    <BoxComponent
                        key={product._id}
                        data={product}
                        productUrl={buildUrl(productPrefix, product.slug)}
                        currencySymbol={currencySymbol}
                    />
                ))}
            </div>
        );
    }

    // Fallback plain grid
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
                <Link
                    key={product._id}
                    href={buildUrl(productPrefix, product.slug)}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4"
                >
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                        {product.title}
                    </p>
                </Link>
            ))}
        </div>
    );
}
