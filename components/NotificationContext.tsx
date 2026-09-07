"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { trackedFetch as fetch } from "@/lib/api-tracker";
import { useUsers } from "@/components/UsersContext";
import { SANDBOX_NOTIFICATIONS, SANDBOX_SELLERS } from "@/app/inbox/sandbox-data";
import { mergeNotifications, mutateNotification, type NotifEnvelope, type NotificationAction } from "@/lib/notification-state";

export type { NotifEnvelope } from "@/lib/notification-state";

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

function initialSandboxEnvelopes(): NotifEnvelope[] {
    return SANDBOX_NOTIFICATIONS.map((notif) => {
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
    });
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const sessionUser = session?.user;
    const { users, loadingUsers, usersError } = useUsers();
    const [messageError, setMessageError] = useState<string | null>(null);
    const isGuest = session?.user != null
        && "isGuest" in session.user
        && session.user.isGuest === true;
    const [settings, setSettings] = useState<{
        user: typeof sessionUser;
        apiBaseUrl: string;
        sandbox: boolean;
    } | null>(null);
    const [liveEnvelopes, setLiveEnvelopes] = useState<NotifEnvelope[]>([]);
    const [sandboxEnvelopes, setSandboxEnvelopes] = useState(initialSandboxEnvelopes);

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const inboxUri = process.env.NEXT_PUBLIC_INBOX_URI;
    const trashUri = process.env.NEXT_PUBLIC_TRASH_URI;
    const markReadUri = process.env.NEXT_PUBLIC_MARK_READ_URI || "mark_read";
    const forceSandbox = process.env.NEXT_PUBLIC_FORCE_SANDBOX_INBOX === "true";
    const settingsMatch = settings?.user === sessionUser && settings?.apiBaseUrl === apiBaseUrl;
    const isSandbox = forceSandbox || Boolean(!isGuest && settingsMatch && settings?.sandbox);
    const sandboxResolved = forceSandbox || !sessionUser || isGuest || !apiBaseUrl || settingsMatch;
    const effectiveUsers = isSandbox ? [...SANDBOX_SELLERS] : users;
    const envelopes = isSandbox ? sandboxEnvelopes : liveEnvelopes;
    const setEnvelopes = isSandbox ? setSandboxEnvelopes : setLiveEnvelopes;

    useEffect(() => {
        if (forceSandbox || !sessionUser || isGuest || !apiBaseUrl) return;

        let cancelled = false;
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
                if (!cancelled) setSettings({ user: sessionUser, apiBaseUrl, sandbox });
            })
            .catch((settingsError: unknown) => {
                console.warn("Failed to determine eBay environment", settingsError);
                if (!cancelled) setSettings({ user: sessionUser, apiBaseUrl, sandbox: false });
            });

        return () => {
            cancelled = true;
        };
    }, [apiBaseUrl, forceSandbox, isGuest, sessionUser]);


    // Track EventSources so we can clean them up
    const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

    const unreadCount = envelopes.filter((e) => !e.read && !e.trashed).length;


    // Open one SSE connection per user
    useEffect(() => {
        if (!sandboxResolved || isSandbox || isGuest || !apiBaseUrl || users.length === 0) return;

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
                setLiveEnvelopes((prev) => mergeNotifications(prev, newEnvs));
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
    }, [apiBaseUrl, isGuest, isSandbox, sandboxResolved, users]);

    const changeMessage = async (action: NotificationAction, id: string, user: string) => {
        const message = envelopes.find((envelope) => envelope.id === id && envelope.user === user);
        if (!message) return;
        setMessageError(null);
        try {
            await mutateNotification({
                action,
                message,
                localOnly: isSandbox || isGuest,
                apiBaseUrl,
                inboxUri,
                actionUri: action === "read" ? markReadUri : trashUri,
                update: setEnvelopes,
            });
        } catch (err) {
            console.error(err);
            setMessageError(err instanceof Error ? err.message : "Could not update message. Please try again.");
        }
    };

    return (
        <NotificationContext.Provider value={{
            envelopes,
            unreadCount,
            selectMessage: (id, user) => changeMessage("read", id, user),
            trashMessage: (id, user) => changeMessage("trash", id, user),
            deleteMessage: (id, user) => changeMessage("delete", id, user),
            isSandbox,
            users: effectiveUsers,
            loadingUsers,
            error: messageError ?? usersError,
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
