"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { trackedFetch as fetch } from "@/lib/api-tracker";

// Define the notification envelope structure
export interface NotifEnvelope {
    notif: any;
    user: string;
    id: string; // stable key: notificationId or fallback
    read: boolean;
    trashed: boolean;
}

interface NotificationContextProps {
    envelopes: NotifEnvelope[];
    unreadCount: number;
    selectMessage: (id: string, user: string) => void;
    trashMessage: (id: string, user: string) => Promise<void>;
    deleteMessage: (id: string, user: string) => Promise<void>;
    users: string[];
    loadingUsers: boolean;
    error: string | null;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [users, setUsers] = useState<string[]>([]);
    const [envelopes, setEnvelopes] = useState<NotifEnvelope[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const usersUri = process.env.NEXT_PUBLIC_USERS_URI;
    const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL;
    const inboxUri = process.env.NEXT_PUBLIC_INBOX_URI;
    const trashUri = process.env.NEXT_PUBLIC_TRASH_URI;
    const markReadUri = process.env.NEXT_PUBLIC_MARK_READ_URI;

    // Track EventSources so we can clean them up
    const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

    const unreadCount = envelopes.filter((e) => !e.read && !e.trashed).length;

    // Fetch users once
    useEffect(() => {
        if (!apiBaseUrl) {
            setError("API base URL not defined");
            setLoadingUsers(false);
            return;
        }
        const run = async () => {
            try {
                const res = await fetch(`${apiBaseUrl}/${usersUri}`);
                if (!res.ok) throw new Error(`Error fetching users: ${res.statusText}`);
                const data = await res.json();
                setUsers(data.users || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load users");
            } finally {
                setLoadingUsers(false);
            }
        };
        run();
    }, [apiBaseUrl, usersUri]);

    // Open one SSE connection per user
    useEffect(() => {
        if (!webhookUrl || users.length === 0) return;

        const existing = eventSourcesRef.current;

        users.forEach((user) => {
            if (existing.has(user)) return; // already connected

            const es = new EventSource(`${webhookUrl}/${user}`);

            const addNotifs = (raw: any[]) => {
                const newEnvs: NotifEnvelope[] = raw.map((notif) => ({
                    notif,
                    user,
                    id: notif?.notification?.notificationId ?? `${user}-${Date.now()}-${Math.random()}`,
                    read: notif?.sealift_read === true,
                    trashed: notif?.sealift_trashed === true,
                }));
                setEnvelopes((prev) => {
                    // Deduplicate by id (initial loads can overlap with live pushes)
                    const existingIds = new Set(prev.map((e) => e.id));
                    const fresh = newEnvs.filter((e) => !existingIds.has(e.id));
                    if (fresh.length === 0) return prev;
                    const merged = [...fresh, ...prev];
                    // Sort newest first by eventDate
                    merged.sort((a, b) => {
                        const da = a.notif?.notification?.eventDate ?? a.notif?.notification?.publishDate ?? "";
                        const db = b.notif?.notification?.eventDate ?? b.notif?.notification?.publishDate ?? "";
                        return db.localeCompare(da);
                    });
                    return merged.slice(0, 200); // cap at 200 total
                });
            };

            es.addEventListener("initial", (e) => {
                try {
                    const data = JSON.parse(e.data);
                    // Historical messages parse their read state as delivered from MongoDB
                    if (Array.isArray(data)) addNotifs(data);
                } catch (err) {
                    console.error("Failed to parse initial SSE for", user, err);
                }
            });

            es.addEventListener("message", (e) => {
                try {
                    const notif = JSON.parse(e.data);
                    addNotifs([notif]); // live pushes parse their read state
                } catch (err) {
                    console.error("Failed to parse SSE message for", user, err);
                }
            });

            es.onerror = () => {
                console.warn(`SSE disconnected for ${user}, will retry automatically`);
            };

            existing.set(user, es);
        });

        return () => {
            existing.forEach((es) => es.close());
            existing.clear();
        };
    }, [users, webhookUrl]);

    const selectMessage = async (id: string, user: string) => {
        let wasUnread = false;

        setEnvelopes((prev) =>
            prev.map((e) => {
                if (e.id === id) {
                    if (!e.read) wasUnread = true;
                    return { ...e, read: true };
                }
                return e;
            })
        );

        if (!wasUnread || !apiBaseUrl) return;

        try {
            await fetch(`${apiBaseUrl}/${inboxUri}/${user}/${id}/${markReadUri}`, { method: "PUT" });
        } catch (err) {
            console.error(err);
        }
    };

    const trashMessage = async (id: string, user: string) => {
        setEnvelopes((prev) =>
            prev.map((e) => (e.id === id ? { ...e, trashed: true } : e))
        );
        if (!apiBaseUrl) return;
        try {
            const res = await fetch(`${apiBaseUrl}/${inboxUri}/${user}/${id}/${trashUri}`, { method: "PUT" });
            if (!res.ok) throw new Error("Failed to trash message");
        } catch (err) {
            console.error(err);
            // Revert on error
            setEnvelopes((prev) =>
                prev.map((e) => (e.id === id ? { ...e, trashed: false } : e))
            );
        }
    };

    const deleteMessage = async (id: string, user: string) => {
        // Optimistically remove
        setEnvelopes((prev) => prev.filter((e) => e.id !== id));
        if (!apiBaseUrl) return;
        try {
            const res = await fetch(`${apiBaseUrl}/${inboxUri}/${user}/${id}/${trashUri}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete message");
        } catch (err) {
            console.error(err);
            // Revert on error could be complex, we just log it for now
        }
    };

    return (
        <NotificationContext.Provider value={{
            envelopes,
            unreadCount,
            selectMessage,
            trashMessage,
            deleteMessage,
            users,
            loadingUsers,
            error
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error("useNotifications must be used within a NotificationProvider");
    }
    return context;
}
