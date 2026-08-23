"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { trackedFetch as fetch } from "@/lib/api-tracker";
import { useUsers } from "@/components/UsersContext";
import { SANDBOX_NOTIFICATIONS, SANDBOX_SELLERS } from "@/app/inbox/sandbox-data";

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
    isSandbox: boolean;
    loadingUsers: boolean;
    error: string | null;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const { users, loadingUsers, usersError: error } = useUsers();
    const isGuest = session?.user != null
        && "isGuest" in session.user
        && session.user.isGuest === true;
    const [isSandbox, setIsSandbox] = useState(false);
    const [sandboxResolved, setSandboxResolved] = useState(false);
    const effectiveUsers = isSandbox ? [...SANDBOX_SELLERS] : users;
    const [envelopes, setEnvelopes] = useState<NotifEnvelope[]>([]);

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const inboxUri = process.env.NEXT_PUBLIC_INBOX_URI;
    const trashUri = process.env.NEXT_PUBLIC_TRASH_URI;
    const markReadUri = process.env.NEXT_PUBLIC_MARK_READ_URI || "mark_read";
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_FORCE_SANDBOX_INBOX === "true") {
            setIsSandbox(true);
            setSandboxResolved(true);
            return;
        }
        if (!session?.user || isGuest || !apiBaseUrl) {
            setIsSandbox(false);
            setSandboxResolved(true);
            return;
        }

        let cancelled = false;
        setSandboxResolved(false);
        fetch(`${apiBaseUrl}/settings`)
            .then(async (response) => {
                if (!response.ok) throw new Error(`Could not determine eBay environment (${response.status})`);
                const settings: unknown = await response.json();
                const ebayConfig = settings && typeof settings === "object" && "ebayDeveloperConfig" in settings
                    ? settings.ebayDeveloperConfig
                    : null;
                const sandbox = ebayConfig && typeof ebayConfig === "object" && "isSandbox" in ebayConfig
                    ? ebayConfig.isSandbox === true
                    : false;
                if (!cancelled) setIsSandbox(sandbox);
            })
            .catch((settingsError: unknown) => {
                console.warn("Failed to determine eBay environment", settingsError);
                if (!cancelled) setIsSandbox(false);
            })
            .finally(() => {
                if (!cancelled) setSandboxResolved(true);
            });

        return () => {
            cancelled = true;
        };
    }, [apiBaseUrl, isGuest, session?.user]);


    // Track EventSources so we can clean them up
    const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

    const unreadCount = envelopes.filter((e) => !e.read && !e.trashed).length;
    useEffect(() => {
        if (!isSandbox) return;
        setEnvelopes(SANDBOX_NOTIFICATIONS.map((notif) => {
            const data = notif.notification.data;
            const user = SANDBOX_SELLERS.find((seller) =>
                seller === data.senderUserName || seller === data.recipientUserName,
            ) ?? data.recipientUserName;
            return {
                notif,
                user,
                id: notif.notification.notificationId,
                read: notif.sealift_read,
                trashed: notif.sealift_trashed,
            };
        }));
    }, [isSandbox]);


    // Open one SSE connection per user
    useEffect(() => {
        if (!sandboxResolved || isSandbox || !apiBaseUrl || users.length === 0) return;

        const existing = eventSourcesRef.current;

        users.forEach((user) => {
            if (existing.has(user)) return; // already connected

            const es = new EventSource(`${apiBaseUrl}/notifications/${user}/stream`, { withCredentials: true });

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

            es.addEventListener("history", (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (Array.isArray(data)) addNotifs(data);
                } catch (err) {
                    console.error("Failed to parse message history for", user, err);
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
    }, [apiBaseUrl, isSandbox, sandboxResolved, users]);

    const selectMessage = async (id: string, user: string) => {
        const wasUnread = envelopes.some(
            (envelope) => envelope.id === id && envelope.user === user && !envelope.read,
        );

        setEnvelopes((prev) =>
            prev.map((e) =>
                e.id === id && e.user === user ? { ...e, read: true } : e,
            )
        );

        // Sandbox and guest messages are local-only and never write to the API.
        if (isSandbox || isGuest || !wasUnread || !apiBaseUrl) return;

        try {
            const response = await fetch(
                `${apiBaseUrl}/${inboxUri}/${encodeURIComponent(user)}/${encodeURIComponent(id)}/${markReadUri}`,
                { method: "PUT" },
            );
            if (!response.ok) {
                throw new Error(`Failed to mark message as read (${response.status})`);
            }
        } catch (err) {
            console.error(err);
            setEnvelopes((prev) =>
                prev.map((e) =>
                    e.id === id && e.user === user ? { ...e, read: false } : e,
                )
            );
        }
    };

    const trashMessage = async (id: string, user: string) => {
        // Sandbox and guest messages are local-only and never write to the API.
        if (isSandbox || isGuest) {
            setEnvelopes((prev) =>
                prev.map((e) => (e.id === id ? { ...e, trashed: true } : e))
            );
            return;
        }

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
        // Sandbox and guest messages are local-only and never write to the API.
        if (isSandbox || isGuest) {
            setEnvelopes((prev) => prev.filter((e) => e.id !== id));
            return;
        }

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
            isSandbox,
            users: effectiveUsers,
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
