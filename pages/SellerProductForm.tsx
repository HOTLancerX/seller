"use client";

/**
 * Seller account — Add / Edit Product
 *
 * URL: /account/post/product/new         → add mode
 * URL: /account/post/product/<_id>       → edit mode
 *
 * Wraps the admin PostForm but:
 *   - Automatically stamps the current user's _id as the post author (userId)
 *   - Back-link goes to /account/post/product (seller's product list)
 *   - Resolves add/edit mode from the URL path
 */

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@iconify/react";
import PostForm from "@/components/admin/PostForm";
import { useActivePlugins } from "@/hook/useActivePlugins";
import { useUser } from "@/context/Provider";

export default function SellerProductForm() {
    const pathname = usePathname();
    const router   = useRouter();
    const { user } = useUser();

    const activePlugins = useActivePlugins();

    // Derive postId from path: /account/post/product/<id>
    const segments  = pathname?.split("/").filter(Boolean) ?? [];
    // Segments: ["account", "post", "product"] or ["account", "post", "product", "<id>"]
    const lastSeg   = segments[segments.length - 1];
    const isNew     = !lastSeg || lastSeg === "product" || lastSeg === "new";
    const postId    = isNew ? undefined : lastSeg;

    if (activePlugins === null || !user) {
        return (
            <div className="flex items-center justify-center py-24 text-gray-400">
                <Icon icon="svg-spinners:ring-resize" width={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-3">
                <Link
                    href="/account/post/product"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition"
                >
                    <Icon icon="solar:arrow-left-bold" width={16} />
                    My Products
                </Link>
                <span className="text-gray-300">/</span>
                <h1 className="text-2xl font-bold">
                    {isNew ? "Add Product" : "Edit Product"}
                </h1>
            </div>

            <PostForm
                type="product"
                activePlugins={activePlugins}
                postId={postId}
                userId={user._id}
                onSuccess={(savedId) => {
                    if (isNew) {
                        router.replace(`/account/post/product/${savedId}`);
                    }
                }}
            />
        </div>
    );
}
