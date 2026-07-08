/**
 * plugin/seller/index.ts — Seller / Vendor plugin.
 *
 * ── Admin features ────────────────────────────────────────────────────────────
 *   • Seller Commission % field on product-category (Number component)
 *     → stored as cat info "seller_commission"
 *   • Seller Approved toggle on User form (admin-only)
 *   • Admin withdrawal management page  → /admin/seller/withdrawals
 *
 * ── Seller account features ──────────────────────────────────────────────────
 *   • My Products     → /account/post/product
 *   • Seller Orders   → /account/seller-orders
 *   • Wallet          → /account/seller-wallet
 *   • Return Requests → /account/seller-returns
 *
 * ── Commission & wallet logic ─────────────────────────────────────────────────
 *   When an order item reaches "delivered" status:
 *     1. A seller_transaction is created (status: pending, 7-day hold).
 *        availableAfter = deliveredAt + 7 days.
 *        wallet.pendingBalance += sellerNetAmount, wallet.totalEarned += sellerNetAmount.
 *     2. After 7 days, POST /api/seller/wallet/process releases it to available.
 *        wallet.balance += amount, wallet.pendingBalance -= amount.
 *     3. If the order is cancelled during the hold, the transaction is voided.
 *        wallet.pendingBalance -= amount.
 *     4. Seller can request a withdrawal; admin approves/rejects.
 *
 * ── Return & refund logic ─────────────────────────────────────────────────────
 *   Within 7 days of delivery, the buyer can open a return request.
 *   Flow:
 *     buyer submits  → status: pending_seller
 *     seller accepts → status: pending_admin
 *     seller rejects → status: rejected_seller (terminal)
 *     admin approves → status: approved (triggers full refund)
 *       - order.status    = "cancelled"
 *       - order.paymentStatus = "refunded"
 *       - pending seller transactions → cancelled, pendingBalance reversed
 *       - available seller transactions → cancelled, balance reversed + debit created
 *     admin rejects  → status: rejected_admin (terminal)
 *
 * ── API routes (auto-discovered by hook/pluginApiRoutes.ts) ──────────────────
 *   GET  /api/seller/products               → seller's product list
 *   GET  /api/seller/orders                 → orders with seller's items
 *   GET  /api/seller/wallet                 → wallet + transactions
 *   POST /api/seller/wallet/withdraw        → request withdrawal
 *   POST /api/seller/wallet/process         → cron: release/cancel pending
 *   GET  /api/seller/withdrawals            → admin: list requests
 *   PUT  /api/seller/withdrawals            → admin: approve/reject
 *
 * ── Return request API (in product plugin, auto-discovered) ──────────────────
 *   POST /api/orders/:orderNumber/return    → buyer submits return request
 *   GET  /api/orders/:orderNumber/return    → fetch return request(s) for order
 *   GET  /api/returns                       → list returns (role-scoped)
 *   PUT  /api/returns                       → seller/admin respond to return
 */

import { addHook, addPostType, type PluginMeta } from "@/hook";
import { Switch, Number as NumberField, Select } from "@/components/ui";
import SellerProductList  from "./pages/SellerProductList";
import SellerProductForm  from "./pages/SellerProductForm";
import SellerOrderList    from "./pages/SellerOrderList";
import SellerOrderDetails from "./pages/SellerOrderDetails";
import SellerWallet       from "./pages/SellerWallet";
import SellerReturns      from "./pages/SellerReturns";
import WithdrawalManager  from "./admin/WithdrawalManager";
import SellerList         from "./admin/SellerList";
import SellerLayout1      from "./layout/Layout1";
import { registerService, addAction } from "@/hook/pluginHooks";

// ─── Plugin metadata ──────────────────────────────────────────────────────────
export const PLUGINS: PluginMeta = {
    nx:          "com.system.seller",
    name:        "seller",
    version:     "1.0.0",
    description: "Seller / vendor portal — commission, wallet, withdrawals.",
    author:      "System",
    path:        "https://github.com/HOTLancerX/seller.git",
    icon:        "solar:shop-bold",
    color:       "from-orange-500 to-amber-600",
};

/**
 * Register all hooks for this plugin.
 * Called by PluginList.reregisterHooks() after the gate is armed.
 */
export function register() {

    // ─── Register server-side model services ─────────────────────────────────
    // Other plugins (e.g. product) resolve these via resolveService() instead
    // of importing Mongoose models directly. This breaks the hard dependency.
    registerService(
        "seller.Transaction",
        () => import("./models/Transaction"),
        PLUGINS.nx
    );
    registerService(
        "seller.Wallet",
        () => import("./models/Wallet"),
        PLUGINS.nx
    );

    // ─── Action: return.approved ─────────────────────────────────────────────
    // Fired by product/api/returns/route.ts when admin approves a return.
    // Handles wallet reversal for the seller — completely isolated from the
    // product plugin. If seller plugin is inactive, this handler is never called.
    addAction<{
        orderNumber: string;
        callerId: string;
    }>("return.approved", async ({ orderNumber }) => {
        const [txMod, walletMod] = await Promise.all([
            import("./models/Transaction"),
            import("./models/Wallet"),
        ]);
        const TxModel      = txMod.getTransactionModel();
        const updateWallet = walletMod.updateWallet;

        const now = new Date();
        const sellerTxs = await TxModel.find({
            orderNumber,
            type:   "credit",
            status: { $in: ["pending", "available"] },
        }).lean() as any[];

        for (const tx of sellerTxs) {
            if (tx.status === "pending") {
                await TxModel.updateOne(
                    { _id: tx._id },
                    { $set: { status: "cancelled", note: `Reversed: return approved for order ${orderNumber}` } }
                );
                await updateWallet(tx.userId, { pendingBalance: -tx.amount });
            } else if (tx.status === "available") {
                await TxModel.updateOne(
                    { _id: tx._id },
                    { $set: { status: "cancelled", note: `Reversed: return approved for order ${orderNumber}` } }
                );
                await updateWallet(tx.userId, { balance: -tx.amount, totalEarned: -tx.amount });

                await TxModel.create({
                    userId:         tx.userId,
                    orderId:        tx.orderId,
                    orderNumber,
                    type:           "debit",
                    status:         "paid",
                    gross:          tx.gross,
                    commissionRate: tx.commissionRate,
                    adminAmount:    tx.adminAmount,
                    amount:         tx.amount,
                    note:           `Return refund reversal for order ${orderNumber}`,
                    createdAt:      now,
                    updatedAt:      now,
                });
            }
        }
    }, PLUGINS.nx, 10);

    // ─── Action: order.delivered ─────────────────────────────────────────────
    // Fired by product/api/orders/[orderNumber]/route.ts when an order
    // transitions to "delivered". Handles commission credit for sellers.
    addAction<{
        order: any;
        orderNumber: string;
        orderId: string;
        userId: string;
        items: any[];
        now: Date;
    }>("order.delivered", async ({ order, orderNumber, orderId, items, now }) => {
        const [{ default: connectDB }, { getTransactionModel }, { updateWallet }, { default: PostInfo }] =
            await Promise.all([
                import('@/lib/mongodb'),
                import('./models/Transaction'),
                import('./models/Wallet'),
                import('@/models/post_info'),
            ]);

        await connectDB();

        const TxModel        = getTransactionModel();
        const availableAfter = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Group items by seller (uploadedBy)
        const bySellerMap = new Map<string, any[]>();
        for (const item of items) {
            if (!item.uploadedBy) continue;
            const arr = bySellerMap.get(item.uploadedBy) ?? [];
            arr.push(item);
            bySellerMap.set(item.uploadedBy, arr);
        }

        for (const [sellerId, sellerItems] of bySellerMap) {
            // Idempotency: skip if credit already exists for this seller+order
            const existing = await TxModel.findOne({
                userId:      sellerId,
                orderNumber,
                type:        'credit',
                status:      { $in: ['pending', 'available'] },
            }).lean();
            if (existing) continue;

            let gross          = 0;
            let commissionRate = 0;

            for (const item of sellerItems) {
                gross += item.subtotal ?? 0;

                if (commissionRate === 0 && item.productId) {
                    try {
                        const catInfo = await PostInfo.findOne({
                            postId: item.productId,
                            name:   'category',
                        }).lean() as any;

                        if (catInfo?.value) {
                            const { getCollection } = await import('@/lib/mongodb');
                            const catInfoCol = await getCollection('cat_infos');
                            const commInfo = await catInfoCol.findOne({
                                catId: catInfo.value,
                                name:  'seller_commission',
                            });
                            const rate = parseFloat((commInfo as any)?.value ?? '0');
                            if (!isNaN(rate) && rate > 0) commissionRate = rate;
                        }
                    } catch { /* commission stays 0 */ }
                }
            }

            const adminAmount  = parseFloat(((gross * commissionRate) / 100).toFixed(2));
            const sellerAmount = parseFloat((gross - adminAmount).toFixed(2));

            await TxModel.create({
                userId:         sellerId,
                orderId,
                orderNumber,
                type:           'credit',
                status:         'pending',
                gross,
                commissionRate,
                adminAmount,
                amount:         sellerAmount,
                availableAfter,
                note:           `Earnings from order ${orderNumber}. Available after ${availableAfter.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}.`,
            });

            await updateWallet(sellerId, {
                pendingBalance: sellerAmount,
                totalEarned:    sellerAmount,
            });
        }
    }, PLUGINS.nx, 10);

    // ─── Seller profile page template ────────────────────────────────────────
    // URL: /<permalink-prefix>/<user-slug>  (default: /seller/<user-slug>)
    // The page is driven by User.slug — no Post document needed.
    // Permalink "seller" is seeded automatically when the seller plugin is active.
    // To change it go to Admin → Permalinks and set the "seller" prefix.
    // URL: /<permalink-prefix>/<seller-slug>
    // Set the prefix to "seller" in the Permalink admin page.
    // The template shows the seller's profile + their product grid.
    addHook("root.pages", [
        {
            key:      "seller",
            label:    "Seller Layout 1",
            type:     "seller",
            slug:     "dynamic",
            style:    "left",
            position: 10,
            active:   true,
            component: SellerLayout1,
        },
    ], PLUGINS.nx);

    // ─── cat.form — Seller Commission % on product categories ────────────────
    // Only admins visit the category form, so no extra type-gating needed.
    addHook("cat.form", [
        {
            key:      "seller_commission",
            label:    "Seller Commission (%)",
            type:     "product-category",
            style:    "right",
            position: 15,
            component: NumberField,
        },
    ], PLUGINS.nx);

    // ─── User.form — seller approval + post status default (admin-only) ─────
    addHook("User.form", [
        {
            key:       "seller_approved",
            label:     "Seller Approved",
            type:      "admin",
            style:     "right",
            position:  10,
            component: Switch,
        },
        {
            key:      "seller_post_status",
            label:    "Product Default Status",
            type:     "admin",
            style:    "right",
            position: 11,
            component: Select,
            options: [
                { value: "published", label: "Published (auto-live)" },
                { value: "draft",     label: "Draft (needs review)"  },
            ],
        },
    ], PLUGINS.nx);

    // ─── Admin nav — Seller section ───────────────────────────────────────────
    addHook("admin.nav", [
        {
            key:      "seller",
            label:    "Seller",
            icon:     "solar:shop-bold",
            slug:     "seller",
            parent:   "",
            position: 20,
        },
        {
            key:      "seller-withdrawals",
            label:    "Withdrawals",
            icon:     "solar:wallet-money-bold",
            slug:     "seller/withdrawals",
            parent:   "seller",
            position: 1,
        },
    ], PLUGINS.nx);

    // ─── Admin pages — withdrawal manager ────────────────────────────────────
    // URL: /admin/seller/withdrawals
    addHook("admin.pages", [
        {
            key:      "seller/withdrawals",
            label:    "Seller Withdrawals",
            type:     "seller-admin",
            style:    "left",
            position: 50,
            path:     WithdrawalManager,
        },
        {
            key:      "seller",
            label:    "Seller",
            type:     "seller-admin",
            style:    "left",
            position: 50,
            path:     SellerList,
        },
    ], PLUGINS.nx);

    // ─── User account sidebar nav — seller-only items ─────────────────────
    addHook("user.nav", [
        {
            key:        "seller-products",
            label:      "My Products",
            icon:       "solar:cart-large-bold",
            slug:       "post/product",
            parent:     "",
            position:   5,
            sellerOnly: true,
        },
        {
            key:        "seller-orders",
            label:      "Seller Orders",
            icon:       "lucide:shopping-bag",
            slug:       "seller-orders",
            parent:     "",
            position:   6,
            sellerOnly: true,
        },
        {
            key:        "seller-wallet",
            label:      "My Wallet",
            icon:       "solar:wallet-bold",
            slug:       "seller-wallet",
            parent:     "",
            position:   7,
            sellerOnly: true,
        },
        {
            key:        "seller-returns",
            label:      "Return Requests",
            icon:       "solar:box-minimalistic-bold",
            slug:       "seller-returns",
            parent:     "",
            position:   8,
            sellerOnly: true,
        },
    ], PLUGINS.nx);

    // ─── User account pages ───────────────────────────────────────────────────
    addHook("user.page", [
        {
            key:      "post/product",
            label:    "My Products",
            type:     "seller-products",
            style:    "left",
            position: 5,
            path:     SellerProductList,
        },
        {
            key:      "post/product/",
            label:    "Product Form",
            type:     "seller-products",
            style:    "left",
            position: 6,
            path:     SellerProductForm,
        },
        {
            key:      "seller-orders",
            label:    "Seller Orders",
            type:     "seller-orders",
            style:    "left",
            position: 7,
            path:     SellerOrderList,
        },
        {
            key:      "seller-orders/",
            label:    "Seller Order Detail",
            type:     "seller-orders",
            style:    "left",
            position: 8,
            path:     SellerOrderDetails,
        },
        {
            key:      "seller-wallet",
            label:    "My Wallet",
            type:     "seller-wallet",
            style:    "left",
            position: 8,
            path:     SellerWallet,
        },
        {
            key:      "seller-returns",
            label:    "Return Requests",
            type:     "seller-returns",
            style:    "left",
            position: 9,
            path:     SellerReturns,
        },
    ], PLUGINS.nx);
}
