import { headers } from "next/headers";
import LoginCtaBanner from "@/components/LoginCtaBanner";

export default async function GuestPage() {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || "/";

    let title = "Access Restricted";
    let description = "Sign in to access this feature.";
    let cta = "Sign In";
    let blockTitle = "Requires Authentication";
    let blockDesc: React.ReactNode = "Please sign in to view this page.";

    if (pathname === "/") {
        title = "Manage Your Sellers";
        description = "Sign in to add and manage your eBay seller accounts. Connect multiple seller profiles and centralize your marketplace operations.";
        cta = "Sign In to Add Sellers";
        blockTitle = "Seller Management Hub";
        blockDesc = "Add and monitor all your authorized eBay seller accounts in one place.";
    } else if (pathname.startsWith("/payouts")) {
        title = "Track Your Payouts";
        description = "Sign in to view and manage payouts across all your eBay seller accounts";
        cta = "Sign In to View Payouts";
        blockTitle = "Centralized Payout Tracking";
        blockDesc = "Monitor daily payouts, track statuses, and view historical payout data for all your linked eBay accounts in one unified dashboard.";
    } else if (pathname.startsWith("/listings")) {
        title = "Manage Your Inventory";
        description = "Sign in to view and manage all your active eBay listings";
        cta = "Sign In";
        blockTitle = "Complete Inventory Control";
        blockDesc = "Track inventory, edit prices, and manage listings across all your accounts";
    } else if (pathname.startsWith("/transaction")) {
        title = "View Transactions";
        description = "Sign in to view detailed transaction histories and summaries";
        cta = "Sign In";
        blockTitle = "Transaction History";
        blockDesc = "Monitor credits, debits, holds, and processing transactions across all your accounts";
    } else if (pathname.startsWith("/notifications")) {
        title = "Notifications";
        description = "Sign in to receive alert settings and notifications";
        cta = "Sign In";
        blockTitle = "Smart Notifications";
        blockDesc = "Customize alerts and never miss important updates";
    } else if (pathname.startsWith("/notes")) {
        title = "Access Your Notes";
        description = "Sign in to view and create personal notes";
        cta = "Sign In";
        blockTitle = "Notes & Reminders";
        blockDesc = "Organize your thoughts and keep track of important reminders";
    } else if (pathname.startsWith("/inbox")) {
        title = "Unlock Your Inbox";
        description = "Sign in to read, reply, and manage important messages from your buyers and eBay contacts.";
        cta = "Sign In to Message";
        blockTitle = "Live Message Stream";
        blockDesc = (
            <>
                Stay connected with real-time notifications across all your seller accounts.
                <ul className="text-left text-text-secondary space-y-2 inline-block mt-4">
                    <li>✓ Instant buyer notifications</li>
                    <li>✓ Multi-account management</li>
                    <li>✓ Read & reply to messages</li>
                </ul>
            </>
        );
    } else if (pathname.startsWith("/charts")) {
        title = "View Analytics";
        description = "Sign in to see charts and performance metrics";
        cta = "Sign In";
        blockTitle = "Sales Analytics Dashboard";
        blockDesc = "Track sales trends, performance metrics, and market insights";
    } else if (pathname.startsWith("/admin")) {
        title = "Admin Dashboard";
        description = "Sign in to access admin controls";
        cta = "Sign In";
        blockTitle = "System Administration";
        blockDesc = "Manage system settings and administrative functions";
    } else if (pathname.startsWith("/accounts")) {
        title = "Manage Accounts";
        description = "Sign in to configure your seller accounts";
        cta = "Sign In";
        blockTitle = "Account Management";
        blockDesc = "Connect and manage multiple eBay seller accounts";
    } else if (pathname.startsWith("/gallery")) {
        title = "Manage Your Gallery";
        description = "Sign in to organize and upload product images";
        cta = "Sign In";
        blockTitle = "Image Management";
        blockDesc = "Upload, organize, and manage product photos across your inventory";
    }

    return (
        <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8 relative">
            <div className="max-w-2xl mx-auto space-y-6">
                <LoginCtaBanner
                    title={title}
                    description={description}
                    cta={cta}
                />
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-8 text-center mt-8">
                    <h2 className="text-2xl font-semibold text-primary mb-4">
                        {blockTitle}
                    </h2>
                    <div className="text-text-secondary">
                        {blockDesc}
                    </div>
                </div>
            </div>
        </div>
    );
}
