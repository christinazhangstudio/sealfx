"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { NotificationProvider } from "@/components/NotificationContext";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
                <NotificationProvider>
                    {children}
                </NotificationProvider>
            </ThemeProvider>
        </SessionProvider>
    );
}
