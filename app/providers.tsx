"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { NotificationProvider } from "@/components/NotificationContext";
import GuestSync from "@/components/GuestSync";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
                <NotificationProvider>
                    <GuestSync />
                    {children}
                </NotificationProvider>
            </ThemeProvider>
        </SessionProvider>
    );
}
