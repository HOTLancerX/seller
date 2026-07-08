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
