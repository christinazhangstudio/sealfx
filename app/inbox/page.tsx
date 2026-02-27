"use client";

import { useEffect, useState } from "react";
import { trackedFetch as fetch } from "@/lib/api-tracker";

export default function InboxPage() {
    const [users, setUsers] = useState<string[]>([]);
    const [selectedUser, setSelectedUser] = useState<string>("");
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedNotif, setSelectedNotif] = useState<any | null>(null);

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const usersUri = process.env.NEXT_PUBLIC_USERS_URI || "users";

    useEffect(() => {
        if (!apiBaseUrl) {
            setError("API base URL not defined");
            setLoadingUsers(false);
            return;
        }

        const fetchUsers = async () => {
            try {
                const response = await fetch(`${apiBaseUrl}/${usersUri}`);
                if (!response.ok) throw new Error(`Error fetching users: ${response.statusText}`);
                const data = await response.json();
                setUsers(data.users || []);
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : "Failed to load users");
            } finally {
                setLoadingUsers(false);
            }
        };

        fetchUsers();
    }, [apiBaseUrl]);

    useEffect(() => {
        if (!selectedUser || !apiBaseUrl) {
            setNotifications([]);
            setSelectedNotif(null);
            return;
        }

        const fetchNotifications = async () => {
            setLoadingNotifications(true);
            try {
                // The webhook endpoint does not fall under /api, so we remove /api from base url
                const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL || "";
                const response = await fetch(`${webhookUrl}/${selectedUser}`);
                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(text || `Error code ${response.status}`);
                }
                const data = await response.json();
                setNotifications(data || []);
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : "Failed to load notifications");
                setNotifications([]);
            } finally {
                setLoadingNotifications(false);
            }
        };

        fetchNotifications();
    }, [selectedUser, apiBaseUrl]);

    return (
        <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8 relative">
            <div className="max-w-7xl mx-auto space-y-8 h-full flex flex-col">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border flex-shrink-0">
                    <div>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl text-primary font-heading mb-2">
                            Inbox
                        </h1>
                        <p className="text-text-secondary text-sm sm:text-base">
                            View destination webhooks pushed from eBay.
                        </p>
                    </div>
                    <div className="w-full md:w-72">
                        <label className="block text-sm font-medium text-secondary mb-2">
                            Select Seller
                        </label>
                        <select
                            value={selectedUser}
                            onChange={(e) => {
                                setSelectedUser(e.target.value);
                                setSelectedNotif(null);
                            }}
                            className="w-full bg-surface border border-border text-text-primary rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary transition-all"
                        >
                            <option value="" disabled>-- Select a Seller --</option>
                            {users.map(user => (
                                <option key={user} value={user}>{user}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {error && (
                    <div className="bg-error-bg border-l-4 border-error-border text-error-text p-4 rounded shadow-sm">
                        {error}
                    </div>
                )}

                {!selectedUser && !loadingUsers ? (
                    <div className="text-center py-20 bg-surface rounded-3xl border-2 border-dashed border-border/50">
                        <p className="text-xl text-secondary">Select a seller above to view their inbox messages.</p>
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row gap-6 flex-grow min-h-[500px]">
                        {/* Sidebar */}
                        <div className="lg:w-1/3 flex flex-col gap-4">
                            <div className="font-bold text-xl text-primary">Recent Messages</div>
                            {loadingNotifications ? (
                                <div className="animate-pulse flex flex-col gap-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="bg-surface h-24 rounded-xl shadow-sm border border-border"></div>
                                    ))}
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="text-secondary p-4 bg-surface rounded-xl border border-border text-center">
                                    No messages found.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3 overflow-y-auto pr-2" style={{ maxHeight: '70vh' }}>
                                    {notifications.map((notif, idx) => {
                                        const topic = notif?.metadata?.topic || "UNKNOWN_TOPIC";
                                        const dateStr = notif?.notification?.eventDate || notif?.notification?.publishDate;
                                        const date = dateStr ? new Date(dateStr) : null;
                                        const isSelected = selectedNotif === notif;

                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => setSelectedNotif(notif)}
                                                className={`text-left p-4 rounded-xl border transition-all duration-200 
                                                    ${isSelected ? 'bg-primary/10 border-primary shadow-sm' : 'bg-surface border-border hover:border-primary/50'}`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-bold font-mono text-sm text-primary truncate pr-2">
                                                        {topic}
                                                    </span>
                                                    {date && (
                                                        <span className="text-xs text-text-muted whitespace-nowrap">
                                                            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-text-secondary truncate">
                                                    {notif?.notification?.notificationId || "No ID"}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Main Detail View */}
                        <div className="lg:w-2/3 flex flex-col bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
                            {selectedNotif ? (
                                <>
                                    <div className="bg-background/50 border-b border-border p-4 sm:p-6 flex justify-between items-center">
                                        <div>
                                            <div className="text-2xl font-bold font-mono text-primary break-all">
                                                {selectedNotif.metadata?.topic || "Unknown payload topic"}
                                            </div>
                                            <div className="text-sm text-text-secondary mt-1">
                                                ID: {selectedNotif.notification?.notificationId || "N/A"}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 sm:p-6 bg-[#0d1117] text-[#c9d1d9] overflow-auto flex-grow" style={{ maxHeight: 'calc(70vh - 80px)' }}>
                                        <pre className="text-xs sm:text-sm font-mono whitespace-pre-wrap break-all">
                                            {JSON.stringify(selectedNotif, null, 2)}
                                        </pre>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-grow flex items-center justify-center p-12 text-center">
                                    <p className="text-secondary text-lg">Select a message from the list to view its contents.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
