"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useNotifications } from "@/components/NotificationContext";
import LoginCtaBanner from "@/components/LoginCtaBanner";

function BellIcon({ count }: { count: number }) {
    return (
        <div className="relative inline-flex items-center">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
            >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {count > 0 && (
                <span
                    className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(59,130,246,0.7)] animate-pulse"
                >
                    {count > 99 ? "99+" : count}
                </span>
            )}
        </div>
    );
}

export default function InboxPage() {
    const { data: session } = useSession();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const { users, envelopes, unreadCount, selectMessage: contextSelectMessage, trashMessage, deleteMessage, loadingUsers, error } = useNotifications();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"inbox" | "trash">("inbox");

    const displayedEnvelopes = envelopes.filter(e => activeTab === 'trash' ? e.trashed : !e.trashed);
    const selectedEnvelope = envelopes.find((e) => e.id === selectedId) ?? null;

    const selectMessage = (id: string, user: string) => {
        setSelectedId(id);
        contextSelectMessage(id, user);
    };

    const handleTrash = () => {
        if (!selectedEnvelope) return;
        trashMessage(selectedEnvelope.id, selectedEnvelope.user);
        setSelectedId(null);
    };

    const handleDelete = () => {
        if (!selectedEnvelope) return;
        if (confirm("Are you sure you want to permanently delete this message?")) {
            deleteMessage(selectedEnvelope.id, selectedEnvelope.user);
            setSelectedId(null);
        }
    };

    if (!mounted) {
        return null;
    }

    return (
        <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8 relative">
            <div className="max-w-7xl mx-auto space-y-8 h-full flex flex-col">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border flex-shrink-0">
                    <div>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl text-primary font-heading mb-2">
                            Inbox
                        </h1>
                        <p className="text-text-secondary text-sm sm:text-base">
                            Live notifications across all sellers.
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Bell */}
                        <BellIcon count={unreadCount} />
                        {/* User pill badges */}
                        {loadingUsers ? (
                            <div className="h-6 w-40 bg-surface rounded-full animate-pulse" />
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {users.map((u) => (
                                    <span
                                        key={u}
                                        className="text-xs font-mono bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full"
                                    >
                                        {u}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="bg-error-bg border-l-4 border-error-border text-error-text p-4 rounded shadow-sm">
                        {error}
                    </div>
                )}

                {/* Main layout */}
                <div className="flex flex-col lg:flex-row gap-6 flex-grow min-h-[500px]">

                    {/* Sidebar – message list */}
                    <div className="lg:w-1/3 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex bg-surface rounded-lg p-1 border border-border">
                                <button
                                    onClick={() => { setActiveTab("inbox"); setSelectedId(null); }}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "inbox" ? "bg-hover text-hover-content shadow-sm" : "text-text-secondary hover:text-hover-content hover:bg-hover"}`}
                                >
                                    Inbox
                                </button>
                                <button
                                    onClick={() => { setActiveTab("trash"); setSelectedId(null); }}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "trash" ? "bg-hover text-hover-content shadow-sm" : "text-text-secondary hover:text-hover-content hover:bg-hover"}`}
                                >
                                    Trash
                                </button>
                            </div>
                            {displayedEnvelopes.length > 0 && (
                                <span className="text-xs text-text-muted font-mono">{displayedEnvelopes.length} total</span>
                            )}
                        </div>

                        {loadingUsers ? (
                            <div className="animate-pulse flex flex-col gap-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="bg-surface h-24 rounded-xl shadow-sm border border-border" />
                                ))}
                            </div>
                        ) : displayedEnvelopes.length === 0 ? (
                            <div className="text-secondary p-4 bg-surface rounded-xl border border-border text-center flex flex-col items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /><path d="m16 19 2 2 4-4" /></svg>
                                {activeTab === "inbox" ? "No messages yet — waiting for live notifications." : "Trash is empty."}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 overflow-y-auto pr-2" style={{ maxHeight: "70vh" }}>
                                {displayedEnvelopes.map((env) => {
                                    const topic = env.notif?.metadata?.topic || "UNKNOWN_TOPIC";
                                    const dateStr =
                                        env.notif?.notification?.eventDate ??
                                        env.notif?.notification?.publishDate;
                                    const date = dateStr ? new Date(dateStr) : null;
                                    const isSelected = env.id === selectedId;
                                    const isUnread = !env.read;

                                    return (
                                        <div
                                            key={env.id}
                                            onClick={() => selectMessage(env.id, env.user)}
                                            className={`relative group text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden
                                                ${isSelected
                                                    ? "bg-message-pill/6 border-border shadow-sm"
                                                    : isUnread
                                                        ? "bg-blue-500/4 border-blue-500/20 hover:border-blue-500/70"
                                                        : "bg-surface border-border hover:border-primary/50"
                                                }`}
                                        >
                                            {!env.trashed ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        trashMessage(env.id, env.user);
                                                        if (isSelected) setSelectedId(null);
                                                    }}
                                                    className="absolute right-2 bottom-2 text-text-muted hover:text-error-text p-1.5 rounded-md hover:bg-error-bg z-10"
                                                    title="Move to Trash"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" />
                                                    </svg>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm("Are you sure you want to permanently delete this message?")) {
                                                            deleteMessage(env.id, env.user);
                                                            if (isSelected) setSelectedId(null);
                                                        }
                                                    }}
                                                    className="absolute right-2 bottom-2 text-text-muted hover:text-orange-600 p-1.5 rounded-md hover:bg-orange-600/10 z-10"
                                                    title="Permanently Delete"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                                                    </svg>
                                                </button>
                                            )}
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex items-center gap-2 overflow-hidden pr-2">
                                                    {isUnread && (
                                                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
                                                    )}
                                                    <span className={`font-bold font-mono text-sm truncate ${isUnread ? "text-text-primary" : "text-primary"}`}>
                                                        {topic === "NEW_MESSAGE" && env.notif?.notification?.data?.senderUserName
                                                            ? `From: ${env.notif.notification.data.senderUserName}`
                                                            : topic}
                                                    </span>
                                                </div>
                                                {date && (
                                                    <span className={`text-xs whitespace-nowrap flex-shrink-0 ${isUnread ? "text-text-primary font-medium" : "text-text-muted"}`}>
                                                        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                    </span>
                                                )}
                                            </div>
                                            {/* User badge */}
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-mono bg-surface border border-border text-text-muted px-2 py-0.5 rounded-full">
                                                    {env.user}
                                                </span>
                                            </div>
                                            <div className={`text-xs truncate ${isUnread ? "text-text-primary font-medium" : "text-text-secondary"}`}>
                                                {topic === "NEW_MESSAGE" && env.notif?.notification?.data?.messageBody
                                                    ? env.notif.notification.data.messageBody
                                                    : env.notif?.notification?.notificationId || "No ID"}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Main message panel */}
                    <div className="lg:w-2/3 flex flex-col bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
                        {selectedEnvelope ? (
                            <>
                                <div className="bg-background/50 border-b border-border p-4 sm:p-6 relative group">
                                    {selectedEnvelope.notif?.metadata?.topic === "NEW_MESSAGE" ? (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center w-full gap-3">
                                                <h2 className="text-2xl font-bold text-primary break-all pr-12">
                                                    {selectedEnvelope.notif.notification?.data?.subject || "No Subject"}
                                                </h2>
                                                <span className="text-sm font-medium px-3 py-1 bg-primary/10 text-primary rounded-full whitespace-nowrap">
                                                    {selectedEnvelope.notif.notification?.data?.conversationType?.replace(/_/g, " ")}
                                                </span>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 text-sm text-text-secondary">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-text-primary">From:</span>
                                                    <span className="bg-surface border border-border px-2 py-0.5 rounded-md">
                                                        {selectedEnvelope.notif.notification?.data?.senderUserName}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-text-primary">To:</span>
                                                    <span className="bg-surface border border-border px-2 py-0.5 rounded-md">
                                                        {selectedEnvelope.notif.notification?.data?.recipientUserName}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-text-primary">Seller:</span>
                                                    <span className="bg-primary/10 border border-primary/20 text-primary font-mono px-2 py-0.5 rounded-md text-xs">
                                                        {selectedEnvelope.user}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="text-2xl font-bold font-mono text-primary break-all">
                                                {selectedEnvelope.notif?.metadata?.topic || "Unknown Topic"}
                                            </div>
                                            <div className="text-sm text-text-secondary mt-1">
                                                ID: {selectedEnvelope.notif?.notification?.notificationId || "N/A"}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div
                                    className="p-4 sm:p-6 text-text-primary overflow-auto flex-grow"
                                    style={{ maxHeight: "calc(70vh - 80px)" }}
                                >
                                    {selectedEnvelope.notif?.metadata?.topic === "NEW_MESSAGE" ? (
                                        <div className="space-y-6">
                                            <div className="bg-message-pill/4 rounded-lg p-8 border border-border/80 shadow-inner text-text-secondary leading-relaxed whitespace-pre-wrap">
                                                {selectedEnvelope.notif.notification?.data?.messageBody || "No message content."}
                                            </div>

                                            {selectedEnvelope.notif.notification?.data?.messageMedia?.some((m: any) => m.mediaUrl) && (
                                                <div className="border-t border-border pt-4">
                                                    <h3 className="font-bold text-primary mb-3">Attachments:</h3>
                                                    <div className="flex flex-wrap gap-3">
                                                        {selectedEnvelope.notif.notification.data.messageMedia.map((media: any, i: number) =>
                                                            media.mediaUrl ? (
                                                                <a
                                                                    key={i}
                                                                    href={media.mediaUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-lg transition-colors"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                                                    </svg>
                                                                    {media.mediaName || `Attachment ${i + 1}`}
                                                                </a>
                                                            ) : null
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mt-8">
                                                <details className="group">
                                                    <summary className="cursor-pointer text-sm font-medium text-text-secondary hover:text-primary mb-2 flex items-center transition-colors">
                                                        <svg className="w-4 h-4 mr-2 transition-transform group-open:rotate-90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="m9 18 6-6-6-6" />
                                                        </svg>
                                                        View Raw Data
                                                    </summary>
                                                    <div className="mt-3 p-4 border border-border/50 rounded-lg">
                                                        <pre className="text-xs sm:text-sm font-mono text-secondary whitespace-pre-wrap break-all">
                                                            {JSON.stringify(selectedEnvelope.notif, null, 2)}
                                                        </pre>
                                                    </div>
                                                </details>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-[#0d1117] p-4 rounded-xl h-full border border-border">
                                            <pre className="text-xs sm:text-sm font-mono text-[#c9d1d9] whitespace-pre-wrap break-all">
                                                {JSON.stringify(selectedEnvelope.notif, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-grow flex items-center justify-center p-12 text-center">
                                <p className="text-secondary text-lg">Select a message to read.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
