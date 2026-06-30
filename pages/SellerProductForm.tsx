"use client";

/**
 * Seller account — Add / Edit Product
 *
 * URL: /account/post/product/new   → add mode
 * URL: /account/post/product/<id>  → edit mode
 *
 * The admin sets a per-seller default post status (draft / published) in
 * UserInfo as seller_post_status. This is passed to PostForm as defaultStatus
 * so new products start with the correct status. Edit mode loads from DB.
 */

import { useEffect, useState } from "react";
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
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    const lastSeg  = segments[segments.length - 1];
    const isNew    = !lastSeg || lastSeg === "product" || lastSeg === "new";
    const postId   = isNew ? undefined : lastSeg;

    // Per-seller default post status set by admin in /admin/seller
    const [defaultStatus, setDefaultStatus] = useState<"draft" | "published">("published");
    const [statusReady,   setStatusReady]   = useState(false);

    // Membership limit check
    const [limitBlocked, setLimitBlocked] = useState(false);
    const [limitInfo, setLimitInfo]       = useState("");

    // Load seller_post_status from UserInfo
    useEffect(() => {
        if (!user?._id) return;
        const EXPRESS_API = process.env.NEXT_PUBLIC_EXPRESS_API_URL ?? "http://localhost:5000";
        const LICENSE_KEY = process.env.NEXT_PUBLIC_LICENSE_KEY ?? "";
        fetch(`${EXPRESS_API}/user-info?userId=${user._id}`, {
            credentials: "include",
            headers: { "x-license-key": LICENSE_KEY },
        })
            .then((r) => (r.ok ? r.json() : { info: [] }))
            .then((data) => {
                const arr: { name: string; value: string }[] = data.info ?? [];
                const val = arr.find((i) => i.name === "seller_post_status")?.value ?? "published";
                setDefaultStatus(val === "draft" ? "draft" : "published");
            })
            .catch(() => {})
            .finally(() => setStatusReady(true));
    }, [user?._id]);

    // Check membership upload limit (add mode only)
    useEffect(() => {
        if (!isNew || !user?._id) return;
        fetch(`/api/seller-membership/status?userId=${user._id}`, { cache: "no-store" })
            .then((r) => r.json())
            .then((data) => {
                const m = data.membership;
                const pkg = data.package;
                if (m && pkg && pkg.productLimit > 0 && m.productCount >= pkg.productLimit) {
                    setLimitBlocked(true);
                    setLimitInfo(
                        `You've used ${m.productCount}/${pkg.productLimit} product slots (${pkg.name}). Upgrade or remove existing products to add more.`
                    );
                }
            })
            .catch(() => {});
    }, [isNew, user?._id]);

    if (activePlugins === null || !user || !statusReady) {
        return (
            <div className="flex items-center justify-center py-24 text-gray-400">
                <Icon icon="svg-spinners:ring-resize" width={32} />
            </div>
        );
    }

    // Block add form when over limit
    if (isNew && limitBlocked) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Link href="/account/post/product"
                        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition">
                        <Icon icon="solar:arrow-left-bold" width={16} />
                        My Products
                    </Link>
                    <span className="text-gray-300">/</span>
                    <h1 className="text-2xl font-bold">Add Product</h1>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <Icon icon="solar:crown-bold" width={32} className="text-red-400" />
                    </div>
                    <p className="text-base font-bold text-red-700 mb-2">Product upload limit reached</p>
                    <p className="text-sm text-red-600 mb-6 max-w-md mx-auto">{limitInfo}</p>
                    <Link href="/account/membership"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-400 transition">
                        <Icon icon="solar:crown-bold" width={16} />
                        Upgrade Membership
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
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
                defaultStatus={defaultStatus}
                onSuccess={(savedId) => {
                    if (isNew) router.replace(`/account/post/product/${savedId}`);
                }}
            />
        </div>
    );
}
