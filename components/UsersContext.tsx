"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { trackedFetch as fetch } from "@/lib/api-tracker";

export interface SellerStatus {
    user: string;
    status: "connected" | "expiring" | "expired";
    expiresAt?: string;
}

interface UsersContextProps {
    users: string[];
    sellers: SellerStatus[];
    loadingUsers: boolean;
    usersError: string | null;
    refetchUsers: () => Promise<void>;
}

const UsersContext = createContext<UsersContextProps | undefined>(undefined);

export function UsersProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const [users, setUsers] = useState<string[]>([]);
    const [sellers, setSellers] = useState<SellerStatus[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [usersError, setUsersError] = useState<string | null>(null);

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const usersUri = process.env.NEXT_PUBLIC_USERS_URI;

    const refetchUsers = useCallback(async () => {
        if (!apiBaseUrl || !usersUri) {
            setUsersError("API base URL or Users URI env not defined");
            setLoadingUsers(false);
            return;
        }

        try {
            setLoadingUsers(true);
            setUsersError(null);
            const res = await fetch(`${apiBaseUrl}/${usersUri}`);
            if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
            const data = await res.json();
            setUsers(data.users || []);
            setSellers(data.sellers || []);
        } catch (err) {
            setUsersError(err instanceof Error ? err.message : "Failed to load users");
        } finally {
            setLoadingUsers(false);
        }
    }, [apiBaseUrl, usersUri]);

    const isGuest = (session?.user as any)?.isGuest === true;
    const sessionUser = session?.user?.email;

    useEffect(() => {
        // Guest users should not fetch data
        if (isGuest) {
            setLoadingUsers(false);
            return;
        }
        if (!sessionUser) {
            // Without a session there is nothing to load — don't leave every
            // consumer stuck on a permanent loading state.
            setLoadingUsers(false);
            return;
        }
        refetchUsers();
    }, [sessionUser, isGuest, refetchUsers]);

    return (
        <UsersContext.Provider value={{ users, sellers, loadingUsers, usersError, refetchUsers }}>
            {children}
        </UsersContext.Provider>
    );
}

export function useUsers() {
    const context = useContext(UsersContext);
    if (context === undefined) {
        throw new Error("useUsers must be used within a UsersProvider");
    }
    return context;
}
