import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_API_URL = "/api";
process.env.NEXT_PUBLIC_USERS_URI = "users";
process.env.NEXT_PUBLIC_REGISTER_SELLER_URI = "register-seller";
process.env.NEXT_PUBLIC_LISTINGS_URI = "listings";
process.env.NEXT_PUBLIC_PAYOUTS_URI = "payouts";
process.env.NEXT_PUBLIC_ACCOUNT_URI = "account";
process.env.NEXT_PUBLIC_NOTIFICATIONS_TOPICS_URI = "notification/topics";
process.env.NEXT_PUBLIC_NOTIFICATIONS_USERS_BASE_URI = "notification/users";
process.env.NEXT_PUBLIC_NOTIFICATIONS_DESTINATIONS_URI = "notification/destinations";
process.env.NEXT_PUBLIC_TRANSACTION_SUMMARIES_URI = "transaction-summaries";
process.env.NEXT_PUBLIC_INBOX_URI = "inbox";
process.env.NEXT_PUBLIC_AI_URI = "ai/ask";

const { categorizeApiEndpoint } = await import("./api-tracker.ts");

test("categorizes every tracked Sealift API resource", () => {
    const cases = [
        ["/api/users", "Users"],
        ["/api/users/seller@example.com", "Users"],
        ["/api/register-seller", "Users"],
        ["https://sealift.test/api/listings/seller?page=2", "Listings"],
        ["/api/listings/seller/items/123", "Listings"],
        ["/api/payouts/seller", "Payouts"],
        ["/api/account/seller", "Account"],
        ["/api/transaction-summaries", "Transaction Summaries"],
        ["/api/notification/topics", "Notification"],
        ["/api/notification/destinations", "Notification"],
        ["/api/notification/users/seller/subscriptions", "Notification"],
        ["/api/notification/users/seller/subscriptions/id/test", "Notification"],
        ["/api/inbox/seller/id/mark_read", "Inbox"],
        ["/api/inbox/seller/id/trash", "Inbox"],
        ["/api/ai/ask?q=help", "AI Assistant"],
        ["/api/ai/inbox-rules", "AI Assistant"],
        ["/api/settings", "Settings"],
        ["/api/settings/password", "Settings"],
        ["/api/settings/ebay-config", "Settings"],
        ["/api/tracking", "Tracking"],
        ["/api/tracking/9400111899562537875111", "Tracking"],
        ["/api/inventory-notes/seller", "Inventory"],
        ["/api/inventory-notes/seller/item-1", "Inventory"],
    ];

    for (const [url, expected] of cases) {
        assert.equal(categorizeApiEndpoint(url), expected, url);
    }
});

test("matches route boundaries and leaves unknown endpoints as other", () => {
    assert.equal(categorizeApiEndpoint("/api/accounting"), "other");
    assert.equal(categorizeApiEndpoint("/api/users-report"), "other");
    assert.equal(categorizeApiEndpoint("/api/health"), "other");
});
