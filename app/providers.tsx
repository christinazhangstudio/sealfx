"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider, useSession } from "next-auth/react";
import { UsersProvider } from "@/components/UsersContext";
import { NotificationProvider } from "@/components/NotificationContext";
import GuestSync from "@/components/GuestSync";
import SessionDataBoundary from "@/components/SessionDataBoundary";
import { sessionDataKey } from "@/lib/session-data-key";

function SessionScopedProviders({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    return (
        <SessionDataBoundary identity={sessionDataKey(session, status)}>
            <UsersProvider>
                <NotificationProvider>
                    <GuestSync />
                    {children}
                </NotificationProvider>
            </UsersProvider>
        </SessionDataBoundary>
    );
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
                <SessionScopedProviders>{children}</SessionScopedProviders>
            </ThemeProvider>
        </SessionProvider>
    );
}
