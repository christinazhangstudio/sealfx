"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import LoginCtaBanner from "@/components/LoginCtaBanner";
import { trackedFetch as fetch } from "@/lib/api-tracker";
import PageHeader from "@/components/PageHeader";
import { useUsers } from "@/components/UsersContext";

interface SupportedPayload {
    format: string[];
    schemaVersion: string;
    deliveryProtocol: string;
    deprecated: boolean;
}

interface Topic {
    topicId: string;
    description: string;
    status: string;
    context: string;
    scope: string;
    authorizationScopes?: string[];
    supportedPayloads: SupportedPayload[];
    filterable: boolean;
    canSubscribe: boolean;
    availability: "available" | "application" | "not_authorized" | "unavailable";
}

interface TopicsResponse {
    topics: Topic[];
}

interface Subscription {
    subscriptionId: string;
    topicId: string;
    destinationId: string;
    status: string;
    createdDate?: string;
    updatedDate?: string;
    filterId?: string;
}

interface SubscriptionsResponse {
    subscriptions: Subscription[];
}

interface UsersResponse {
    users: string[];
}

export default function NotificationsPage() {
    const { data: session } = useSession();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const [topics, setTopics] = useState<Topic[]>([]);
    const { users, loadingUsers } = useUsers();
    const [selectedUser, setSelectedUser] = useState<string>("");
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

    // Loading states
    const [loadingTopics, setLoadingTopics] = useState(true);
    const [loadingSubs, setLoadingSubs] = useState(false);
    // Tracks which topic has an action in flight, so one click doesn't put
    // every button on the page into a loading state.
    const [pendingTopic, setPendingTopic] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const topicsUri = process.env.NEXT_PUBLIC_NOTIFICATIONS_TOPICS_URI;
    const usersBaseUri = process.env.NEXT_PUBLIC_NOTIFICATIONS_USERS_BASE_URI;
    const usersUri = process.env.NEXT_PUBLIC_USERS_URI;
    const subscriptionsUri = process.env.NEXT_PUBLIC_NOTIFICATIONS_SUBSCRIPTIONS_URI;

    // Fetch Topics and Users on load
    useEffect(() => {
        if (!apiBaseUrl) {
            setError("API base URL not defined");
            setLoadingTopics(false);
            return;
        }

        const fetchTopics = async () => {
            try {
                const response = await fetch(`${apiBaseUrl}/${topicsUri}`);
                if (!response.ok) throw new Error(`Error fetching topics: ${response.statusText}`);
                const data: TopicsResponse = await response.json();
                setTopics(data.topics || []);
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : "Failed to load topics");
            } finally {
                setLoadingTopics(false);
            }
        };

        fetchTopics();
    }, [apiBaseUrl]);

    // Fetch subscriptions when user selected
    useEffect(() => {
        if (!selectedUser || !apiBaseUrl) {
            setSubscriptions([]);
            return;
        }

        const fetchSubscriptions = async () => {
            setLoadingSubs(true);
            try {
                const response = await fetch(`${apiBaseUrl}/${usersBaseUri}/${selectedUser}/${subscriptionsUri}`);
                if (!response.ok) throw new Error(`Error fetching subscriptions: ${response.statusText}`);
                const data: SubscriptionsResponse = await response.json();
                setSubscriptions(data.subscriptions || []);
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : "Failed to load subscriptions");
            } finally {
                setLoadingSubs(false);
            }
        };

        fetchSubscriptions();
    }, [selectedUser, apiBaseUrl]);

    // Clear notifications after delay
    useEffect(() => {
        if (successMsg || error) {
            const timer = setTimeout(() => {
                setSuccessMsg(null);
                setError(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMsg, error]);

    const refreshSubscriptions = async () => {
        const subsResponse = await fetch(`${apiBaseUrl}/${usersBaseUri}/${selectedUser}/${subscriptionsUri}`);
        if (!subsResponse.ok) throw new Error("Subscribed, but couldn't refresh the list");
        const subsData: SubscriptionsResponse = await subsResponse.json();
        setSubscriptions(subsData.subscriptions || []);
    };

    // Unsubscribing needs the subscription's id, which only the subscription
    // list carries — the topic list doesn't know it.
    const subscriptionFor = (topicId: string) =>
        subscriptions.find(sub => sub.topicId === topicId);

    const handleUnsubscribe = async (topicId: string) => {
        const subscription = subscriptionFor(topicId);
        if (!selectedUser || !apiBaseUrl || !subscription) return;
        setPendingTopic(topicId);
        setError(null);
        setSuccessMsg(null);

        try {
            const response = await fetch(
                `${apiBaseUrl}/${usersBaseUri}/${selectedUser}/${subscriptionsUri}/${subscription.subscriptionId}`,
                { method: "DELETE" },
            );
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || "Failed to unsubscribe");
            }
            setSuccessMsg(`Unsubscribed from ${topicId}`);
            await refreshSubscriptions();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to unsubscribe");
        } finally {
            setPendingTopic(null);
        }
    };

    const handleSubscribe = async (topicId: string) => {
        if (!selectedUser || !apiBaseUrl) return;
        setPendingTopic(topicId);
        setError(null);
        setSuccessMsg(null);

        try {
            const response = await fetch(`${apiBaseUrl}/${usersBaseUri}/${selectedUser}/${subscriptionsUri}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topicId }),
            });

            if (!response.ok) {
                const text = await response.text();
                if (response.status === 403) {
                    setTopics(current => current.map(topic =>
                        topic.topicId === topicId
                            ? { ...topic, canSubscribe: false, availability: "not_authorized" }
                            : topic
                    ));
                }
                throw new Error(text || "Failed to subscribe");
            }

            setSuccessMsg(`Successfully subscribed to ${topicId}`);
            await refreshSubscriptions();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Failed to subscribe");
        } finally {
            setPendingTopic(null);
        }
    };



    const isSubscribed = (topicId: string) => {
        return subscriptions.some(sub => sub.topicId === topicId);
    };

    if (!mounted) {
        return null;
    }

    if (loadingTopics || loadingUsers) {
        return (
            <div className="min-h-screen bg-background p-8 flex items-center justify-center">
                <p className="text-xl text-primary animate-pulse">Loading... 🌸</p>
            </div>
        );
    }

    return (
        <div className="page-content-shell bg-background relative">
            <div className="max-w-7xl mx-auto space-y-8">

                <PageHeader
                    title="Notifications"
                    description="Manage notification subscriptions for your sellers."
                    flush
                />

                <div className="w-full md:w-72">
                    <label htmlFor="user-select" className="block text-sm font-medium text-secondary mb-2">
                        Select Seller
                    </label>
                    <select
                        id="user-select"
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="w-full bg-surface border border-border text-text-primary rounded-lg p-3 ring-offset-background focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                    >
                        <option value="" disabled>-- Select a Seller --</option>
                        {users.map(user => (
                            <option key={user} value={user}>{user}</option>
                        ))}
                    </select>
                </div>

                {/* Feedback Messages */}
                {(error || successMsg) && (
                    <div className={`fixed bottom-24 right-4 left-4 sm:left-auto sm:right-8 sm:bottom-8 z-[var(--z-toast)] sm:max-w-md px-5 py-4 rounded-xl shadow-2xl transform transition-all duration-300 animate-in slide-in-from-bottom-5 ${error ? 'bg-error-bg text-error-text' : 'bg-success-bg text-success-text'
                        }`}>
                        <div className="flex min-w-0 items-center gap-3">
                            {error ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                            <p className="min-w-0 whitespace-pre-wrap break-words font-medium">{error || successMsg}</p>
                        </div>
                    </div>
                )}

                {!selectedUser ? (
                    <div className="text-center py-20 bg-surface rounded-3xl border-2 border-dashed border-border/50">
                        <svg className="w-16 h-16 mx-auto text-secondary/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                        <p className="text-xl text-secondary">Select a seller above to manage their subscriptions.</p>
                    </div>
                ) : (
                    <>
                        {/* Active Subscriptions */}
                        <section className="bg-surface rounded-2xl shadow-sm border border-border p-6 sm:p-8">
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                <h2 className="text-2xl font-bold text-primary">Active Subscriptions</h2>
                            </div>

                            {loadingSubs ? (
                                <div className="text-center py-10 text-secondary">Loading subscriptions...</div>
                            ) : subscriptions.length === 0 ? (
                                <div className="text-center py-10 bg-background/50 rounded-xl border border-dashed border-border/50">
                                    <p className="text-text-secondary">No active subscriptions found for {selectedUser}.</p>
                                    <p className="text-sm text-secondary mt-1">Select a topic below to subscribe.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {subscriptions.map(sub => (
                                        <div key={sub.subscriptionId} className="bg-background p-4 rounded-xl border border-border flex flex-col">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-sm text-primary break-all" title={sub.topicId}>
                                                    {sub.topicId}
                                                </h3>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${sub.status === 'ENABLED'
                                                    ? 'bg-success-bg text-success-text border border-success-border'
                                                    : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                                    }`}>
                                                    {sub.status}
                                                </span>
                                            </div>
                                            <div className="mt-auto pt-3 flex justify-between items-end text-xs">
                                                <div className="text-secondary">
                                                    ID: <span className="font-mono text-text-muted">{sub.subscriptionId.slice(0, 8)}...</span>
                                                </div>
                                                {/* Future: Add Disable/Delete button here */}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Available Topics */}
                        <section>
                            <h2 className="text-2xl font-bold text-primary mb-6 px-1">Available Topics</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {topics.map((topic) => {
                                    const subscribed = isSubscribed(topic.topicId);
                                    const availabilityLabel = topic.availability === "application"
                                        ? "App-level"
                                        : topic.availability === "not_authorized"
                                            ? "Not authorized"
                                            : "Unavailable";

                                    return (
                                        <div
                                            key={topic.topicId}
                                            className={`bg-surface p-6 rounded-2xl shadow-md border flex flex-col transition-all duration-200 ${subscribed
                                                ? 'border-primary/30 ring-1 ring-primary/20 opacity-80'
                                                : 'border-border hover:shadow-lg hover:-translate-y-1'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="text-lg font-bold text-primary break-all pr-2">
                                                    {topic.topicId}
                                                </h3>
                                                <span className={`w-28 shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-center text-xs font-medium ${topic.canSubscribe
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                    : topic.availability === 'not_authorized'
                                                        ? 'bg-error-bg text-error-text'
                                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                                    }`}>
                                                    {topic.canSubscribe ? topic.status : availabilityLabel}
                                                </span>
                                            </div>

                                            <p className="text-text-secondary mb-6 flex-grow text-sm leading-relaxed">
                                                {topic.description}
                                            </p>

                                            <div className="mt-auto space-y-4">
                                                {subscribed ? (
                                                    <div className="space-y-2">
                                                        <div className="w-full py-2.5 rounded-lg font-medium text-sm bg-success-bg text-success-text border border-success-border flex items-center justify-center gap-2">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                            Subscribed
                                                        </div>
                                                        <button
                                                            onClick={() => handleUnsubscribe(topic.topicId)}
                                                            disabled={pendingTopic === topic.topicId}
                                                            className={`w-full py-2 rounded-lg font-medium text-xs transition-all ${pendingTopic === topic.topicId
                                                                ? 'text-gray-400 cursor-wait'
                                                                : 'text-error-text hover:bg-error-bg/40 active:scale-95'
                                                                }`}
                                                        >
                                                            {pendingTopic === topic.topicId ? 'Unsubscribing...' : 'Unsubscribe'}
                                                        </button>
                                                    </div>
                                                ) : topic.canSubscribe ? (
                                                    <button
                                                        onClick={() => handleSubscribe(topic.topicId)}
                                                        disabled={pendingTopic === topic.topicId}
                                                        className={`w-full py-2.5 rounded-lg font-medium text-sm shadow-sm transition-all flex items-center justify-center gap-2 ${pendingTopic === topic.topicId
                                                            ? 'bg-gray-100 text-gray-400 cursor-wait'
                                                            : 'bg-primary text-white hover:bg-primary-hover hover:shadow-md active:scale-95'
                                                            }`}
                                                    >
                                                        {pendingTopic === topic.topicId ? 'Processing...' : 'Subscribe'}
                                                    </button>
                                                ) : (
                                                    <div className="space-y-1 text-center">
                                                        <button
                                                            type="button"
                                                            disabled
                                                            className="w-full cursor-not-allowed rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                                        >
                                                            {availabilityLabel}
                                                        </button>
                                                        <p className="text-xs leading-4 text-text-muted">
                                                            {topic.availability === "application"
                                                                ? "This topic is managed for the application, not an individual seller."
                                                                : topic.availability === "not_authorized"
                                                                    ? "The configured eBay permissions don’t grant access to this topic."
                                                                    : "eBay is not currently accepting subscriptions to this topic."}
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="pt-4 border-t border-border/50 text-xs text-text-muted space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="font-semibold text-secondary">Context:</span>
                                                        <span className="text-text-primary">{topic.context}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="font-semibold text-secondary">Scope:</span>
                                                        <span className="text-text-primary">{topic.scope}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="font-semibold text-secondary">Filterable:</span>
                                                        <span className="text-text-primary">{topic.filterable ? 'Yes' : 'No'}</span>
                                                    </div>

                                                    {topic.authorizationScopes && topic.authorizationScopes.length > 0 && (
                                                        <div className="pt-2">
                                                            <span className="font-semibold text-secondary block mb-1">Auth Scopes:</span>
                                                            <ul className="list-disc pl-4 space-y-1">
                                                                {topic.authorizationScopes.map((scope, idx) => (
                                                                    <li key={idx} className="truncate text-text-primary" title={scope}>
                                                                        {scope.split('/').pop()}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {topic.supportedPayloads && topic.supportedPayloads.length > 0 && (
                                                        <div className="pt-2 border-t border-border/30 mt-2">
                                                            <span className="font-semibold text-secondary block mb-1">Supported Payloads:</span>
                                                            <div className="space-y-2">
                                                                {topic.supportedPayloads.map((payload, idx) => (
                                                                    <div key={idx} className="bg-background/50 p-2 rounded text-[10px] sm:text-xs">
                                                                        <div className="flex justify-between">
                                                                            <span className="text-secondary">Format:</span>
                                                                            <span className="text-text-primary">{payload.format.join(", ")}</span>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-secondary">Schema:</span>
                                                                            <span className="text-text-primary">{payload.schemaVersion}</span>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-secondary">Protocol:</span>
                                                                            <span className="text-text-primary">{payload.deliveryProtocol}</span>
                                                                        </div>
                                                                        {payload.deprecated && (
                                                                            <div className="text-error-text mt-1 text-right font-bold">Deprecated</div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
