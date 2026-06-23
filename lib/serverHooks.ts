/**
 * plugin/seller/lib/serverHooks.ts — Server-only hook registration.
 *
 * Auto-discovered by hook/serverDataHooks.ts via require.context.
 *
 * Registers a data provider for the "seller" content type:
 *   - Reads info.userId (the seller's user _id, set by getSellerBySlug in page.tsx)
 *   - Fetches User record + UserInfo (bio, website, twitter)
 *   - Fetches all published products whose PostInfo userId === that user
 *   - Returns fully-serialized plain objects — no ObjectId / Date / Buffer
 *
 * NEVER import from plugin/seller/index.ts or any client component.
 */

import { registerServerDataHook } from "@/hook/serverDataHooks";
import connectDB from "@/lib/mongodb";
import Post from "@/models/post";
import PostInfo from "@/models/post_info";
import User from "@/models/Users";
import UserInfo from "@/models/Users_info";

registerServerDataHook("seller", async (_id, _slug, data) => {
    try {
        await connectDB();

        const userIdInfo = data?.info?.userId as string | undefined;
        if (!userIdInfo) return { seller: null, products: [], activeBox: null };

        // ── Fetch user ────────────────────────────────────────────────────────
        const user = await User.findById(userIdInfo).lean() as any;
        if (!user) return { seller: null, products: [], activeBox: null };

        const userInfoDocs = await UserInfo.find({ userId: user._id }).lean() as any[];
        const uiMap: Record<string, string> = {};
        userInfoDocs.forEach((d: any) => { uiMap[d.name] = String(d.value ?? ""); });

        // ── Find all published products uploaded by this seller ───────────────
        // Query post.userId directly — no PostInfo join needed
        const products = await Post.find({
            type:   "product",
            status: "published",
            userId: String(user._id),
        }).sort({ createdAt: -1 }).lean() as any[];

        // Enrich + fully serialize (no ObjectId / Date / Buffer on any field)
        const enrichedProducts = await Promise.all(
            products.map(async (product: any) => {
                const infoRecords = await PostInfo.find({ postId: product._id }).lean() as any[];
                const infoMap: Record<string, string> = {};
                infoRecords.forEach((r: any) => { infoMap[r.name] = String(r.value ?? ""); });
                return {
                    _id:   String(product._id),
                    title: String(product.title ?? ""),
                    slug:  String(product.slug  ?? ""),
                    info:  infoMap,
                };
            })
        );

        // Fully-serialized seller — no Mongoose types
        const seller = {
            _id:     String(user._id),
            name:    String(user.name    ?? ""),
            slug:    String(user.slug    ?? ""),
            image:   String(user.image   ?? ""),
            type:    String(user.type    ?? ""),
            address: String(user.address ?? ""),
            city:    String(user.city    ?? ""),
            state:   String(user.state   ?? ""),
            bio:     String(uiMap.bio     ?? ""),
            website: String(uiMap.website ?? ""),
            twitter: String(uiMap.twitter ?? ""),
        };

        return { seller, products: enrichedProducts, activeBox: null };
    } catch (err) {
        console.error("Seller serverDataHook error:", err);
        return { seller: null, products: [], activeBox: null };
    }
});
