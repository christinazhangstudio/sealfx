"use client";

import DOMPurify from "dompurify";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useNotifications } from "@/components/NotificationContext";
import { trackedFetch as fetch } from "@/lib/api-tracker";
import PageHeader from "@/components/PageHeader";
import StatusAlert from "@/components/StatusAlert";
import InboxRuleSuggestions, { InboxRulesToggle, type InboxRuleSuggestion } from "./InboxRuleSuggestions";
import { messageBodyHasHtml, messageBodyToPlainText } from "./message-text";

interface Subscription {
    subscriptionId: string;
    topicId: string;
    status: string;
}

interface SubscriptionsResponse {
    subscriptions?: Subscription[];
}

interface SubscriptionTestResponse {
    notificationId?: string;
}

interface PendingTest {
    user: string;
    topicId: string;
    notificationId: string;
}

type TestFeedback = {
    kind: "pending" | "success" | "error";
    message: string;
};
type InboxAnalysis = {
    model: string;
    suggestions: InboxRuleSuggestion[];
    activeRuleIds: string[];
};


function parseInboxAnalysis(value: unknown): InboxAnalysis {
    if (value === null
        || typeof value !== "object"
        || !("model" in value)
        || typeof value.model !== "string"
        || !("suggestions" in value)
        || !Array.isArray(value.suggestions)
        || !("activeRuleIds" in value)
        || !Array.isArray(value.activeRuleIds)
        || !value.activeRuleIds.every((id: unknown) => typeof id === "string")) {
        throw new Error("Qwen returned an invalid inbox analysis.");
    }

    const suggestions: InboxRuleSuggestion[] = [];
    for (const candidate of value.suggestions) {
        if (candidate === null || typeof candidate !== "object"
            || typeof candidate.id !== "string"
            || typeof candidate.title !== "string"
            || typeof candidate.description !== "string"
            || typeof candidate.destination !== "string"
            || !Array.isArray(candidate.conditions)
            || !candidate.conditions.every((condition: unknown) => typeof condition === "string")
            || !Array.isArray(candidate.matchingIds)
            || !candidate.matchingIds.every((id: unknown) => typeof id === "string")) {
            throw new Error("Qwen returned an invalid rule suggestion.");
        }
        suggestions.push({
            id: candidate.id,
            title: candidate.title,
            description: candidate.description,
            destination: candidate.destination,
            conditions: candidate.conditions,
            matchingIds: candidate.matchingIds,
        });
    }
    const knownRuleIds = new Set(suggestions.map((suggestion) => suggestion.id));
    const activeRuleIds = [...new Set(value.activeRuleIds)].filter((id) => knownRuleIds.has(id));
    return { model: value.model, suggestions, activeRuleIds };
}

function measureMessageScrollbar(element: HTMLDivElement) {
    const { clientHeight, scrollHeight, scrollTop } = element;
    const visible = scrollHeight > clientHeight + 1;
    const height = visible ? Math.max(32, clientHeight * clientHeight / scrollHeight) : clientHeight;
    const top = visible
        ? scrollTop / (scrollHeight - clientHeight) * (clientHeight - height)
        : 0;
    return { visible, height, top };
}

function generateEmailFrameHead(cspImgSrc: string) {
    const styleBlock = "html,body{max-width:100%;overflow-wrap:anywhere}body{margin:0;padding:16px}img{max-width:100%;height:auto}table{max-width:100%}";
    return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src ${cspImgSrc}; font-src data:; form-action 'none'; base-uri 'none'">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>${styleBlock}</style>`;
}

function HtmlMessageBody({ html }: { html: string }) {
    const [sanitizedHtml, setSanitizedHtml] = useState("");
    const [showImages, setShowImages] = useState(false);
    const [hasImages, setHasImages] = useState(false);

    useEffect(() => {
        setHasImages(/<img[^>]+src=/i.test(html));

        const purifier = DOMPurify(window);
        const sanitized = purifier.sanitize(html, {
            WHOLE_DOCUMENT: true,
            USE_PROFILES: { html: true },
            FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "textarea", "select", "link", "meta", "base"],
            FORBID_ATTR: ["action", "formaction", "ping", ...(showImages ? [] : ["src", "srcset"])],
        });

        const frameHead = generateEmailFrameHead(showImages ? "https: data: cid:" : "data: cid:");
        const documentHtml = /<head(?:\s[^>]*)?>/i.test(sanitized)
            ? sanitized.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${frameHead}`)
            : `<!doctype html><html><head>${frameHead}</head><body>${sanitized}</body></html>`;
        setSanitizedHtml(documentHtml);
    }, [html, showImages]);

    if (sanitizedHtml === "") {
        return (
            <div className="bg-message-pill/4 rounded-lg p-8 border border-border/80 shadow-inner text-text-secondary leading-relaxed whitespace-pre-wrap">
                {messageBodyToPlainText(html)}
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-3">
            {hasImages && !showImages && (
                <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5 shadow-sm">
                    <span className="text-sm italic text-text-secondary">
                        Images have been hidden to{" "}
                        <Link
                            href="/privacy#tracking-pixels"
                            className="underline decoration-text-muted decoration-dotted underline-offset-4 hover:text-primary hover:decoration-primary/50"
                        >
                            protect your privacy
                        </Link>
                        .
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowImages(true)}
                        className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
                    >
                        Load Images
                    </button>
                </div>
            )}
            <iframe
                title="Rendered email message"
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
                srcDoc={sanitizedHtml}
                className="min-h-[420px] flex-grow w-full rounded-t-lg border-x border-t border-border/80 bg-white shadow-inner"
            />
        </div>
    );
}

function MessageBody({ body }: { body: unknown }) {
    const content = String(body ?? "");
    if (content === "") {
        return (
            <div className="bg-message-pill/4 rounded-lg p-8 border border-border/80 shadow-inner text-text-secondary leading-relaxed">
                No message content.
            </div>
        );
    }
    if (messageBodyHasHtml(content)) {
        return <HtmlMessageBody html={content} />;
    }
    return (
        <div className="bg-message-pill/4 rounded-lg p-8 border border-border/80 shadow-inner text-text-secondary leading-relaxed whitespace-pre-wrap">
            {content}
        </div>
    );
}


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

function messageSelectionKey(message: { id: string; user: string }): string {
    return `${message.user}\u0000${message.id}`;
}

export default function InboxPage() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const { users, envelopes, unreadCount, isSandbox, selectMessage: contextSelectMessage, trashMessage, deleteMessage, loadingUsers, error } = useNotifications();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"inbox" | "trash">("inbox");
    const [testingDelivery, setTestingDelivery] = useState(false);
    const [testFeedback, setTestFeedback] = useState<TestFeedback | null>(null);
    const [pendingTests, setPendingTests] = useState<PendingTest[]>([]);
    const [selectedMessageKeys, setSelectedMessageKeys] = useState<Set<string>>(() => new Set());
    const [bulkMessageActionLoading, setBulkMessageActionLoading] = useState(false);

    const [activeRuleIds, setActiveRuleIds] = useState<string[]>([]);
    const [ruleSuggestions, setRuleSuggestions] = useState<InboxRuleSuggestion[]>([]);
    const [ruleAnalysisModel, setRuleAnalysisModel] = useState<string | null>(null);
    const [ruleAnalysisLoading, setRuleAnalysisLoading] = useState(false);
    const [ruleAnalysisError, setRuleAnalysisError] = useState<string | null>(null);
    const [rulePreferenceError, setRulePreferenceError] = useState<string | null>(null);
    const [savingRuleId, setSavingRuleId] = useState<string | null>(null);
    const [hasRequestedRuleAnalysis, setHasRequestedRuleAnalysis] = useState(false);
    const [ruleFilter, setRuleFilter] = useState("all");
    const [showRuleConfigurator, setShowRuleConfigurator] = useState(false);
    const messageListRef = useRef<HTMLDivElement>(null);
    const [messageScrollbar, setMessageScrollbar] = useState({ visible: false, height: 0, top: 0 });
    const savedRuleAnalysisRequest = useRef<AbortController | null>(null);
    const rulePreferenceSaveRequest = useRef<AbortController | null>(null);

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const usersBaseUri = process.env.NEXT_PUBLIC_NOTIFICATIONS_USERS_BASE_URI;
    const subscriptionsUri = process.env.NEXT_PUBLIC_NOTIFICATIONS_SUBSCRIPTIONS_URI;

    const activeRules = ruleSuggestions.filter((rule) => activeRuleIds.includes(rule.id));
    const uniqueDestinations = [...new Set(activeRules.map((r) => r.destination))];
    const inboxMessageIds = new Set(envelopes.filter((envelope) => !envelope.trashed).map((envelope) => envelope.id));
    const displayedEnvelopes = envelopes
        .filter((envelope) => activeTab === "trash" ? envelope.trashed : !envelope.trashed)
        .filter((envelope) => activeTab === "trash"
            || ruleFilter === "all"
            || activeRules.some((rule) => rule.destination === ruleFilter && rule.matchingIds.includes(envelope.id)));
    const selectedEnvelope = envelopes.find((envelope) => envelope.id === selectedId) ?? null;
    const selectedDisplayedEnvelopes = displayedEnvelopes.filter((envelope) =>
        selectedMessageKeys.has(messageSelectionKey(envelope)),
    );
    const allDisplayedMessagesSelected = displayedEnvelopes.length > 0
        && selectedDisplayedEnvelopes.length === displayedEnvelopes.length;

    useEffect(() => {
        const list = messageListRef.current;
        if (!list) return;

        const update = () => setMessageScrollbar(measureMessageScrollbar(list));
        update();
        
        const observer = new ResizeObserver(update);
        observer.observe(list);
        return () => observer.disconnect();
    }, [activeTab, displayedEnvelopes.length, ruleFilter, mounted, loadingUsers]);

    useEffect(() => {
        if (!apiBaseUrl) return;

        const controller = new AbortController();
        savedRuleAnalysisRequest.current = controller;
        fetch(`${apiBaseUrl}/ai/inbox-rules`, {
            method: "GET",
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Could not load saved Qwen rules (${response.status})`);
                }
                return parseInboxAnalysis(await response.json());
            })
            .then((analysis) => {
                setActiveRuleIds(analysis.activeRuleIds);
                if (analysis.suggestions.length === 0) return;
                setRuleSuggestions(analysis.suggestions);
                setRuleAnalysisModel(analysis.model || "Qwen");
                setHasRequestedRuleAnalysis(true);
            })
            .catch((loadError: unknown) => {
                if (loadError instanceof DOMException && loadError.name === "AbortError") return;
                console.error(loadError);
            })
            .finally(() => {
                if (savedRuleAnalysisRequest.current === controller) {
                    savedRuleAnalysisRequest.current = null;
                }
            });

        return () => controller.abort();
    }, [apiBaseUrl]);

    useEffect(() => () => rulePreferenceSaveRequest.current?.abort(), []);

    useEffect(() => {
        const availableKeys = new Set(envelopes.map(messageSelectionKey));
        setSelectedMessageKeys((current) => {
            const next = new Set([...current].filter((key) => availableKeys.has(key)));
            return next.size === current.size ? current : next;
        });
    }, [envelopes]);

    useEffect(() => {
        setSelectedMessageKeys(new Set());
    }, [activeTab, ruleFilter]);

    const toggleMessageSelection = (message: { id: string; user: string }) => {
        const key = messageSelectionKey(message);
        setSelectedMessageKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };


    const toggleAllDisplayedMessages = () => {
        setSelectedMessageKeys(allDisplayedMessagesSelected
            ? new Set()
            : new Set(displayedEnvelopes.map(messageSelectionKey)));
    };

    const finishBulkMessageAction = () => {
        setSelectedMessageKeys(new Set());
        setSelectedId(null);
        setBulkMessageActionLoading(false);
    };

    const handleBulkTrash = async () => {
        if (selectedDisplayedEnvelopes.length === 0 || bulkMessageActionLoading) return;
        setBulkMessageActionLoading(true);
        try {
            await Promise.all(selectedDisplayedEnvelopes.map((message) => trashMessage(message.id, message.user)));
        } finally {
            finishBulkMessageAction();
        }
    };

    const handleBulkDelete = async () => {
        const count = selectedDisplayedEnvelopes.length;
        if (count === 0 || bulkMessageActionLoading) return;
        if (!confirm(`Permanently delete ${count} selected message${count === 1 ? "" : "s"}? This cannot be undone.`)) return;
        setBulkMessageActionLoading(true);
        try {
            await Promise.all(selectedDisplayedEnvelopes.map((message) => deleteMessage(message.id, message.user)));
        } finally {
            finishBulkMessageAction();
        }
    };

    const toggleRule = async (ruleId: string) => {
        if (rulePreferenceSaveRequest.current) return;
        const wasApplied = activeRuleIds.includes(ruleId);
        const nextRuleIds = wasApplied
            ? activeRuleIds.filter((id) => id !== ruleId)
            : [...activeRuleIds, ruleId];
        setActiveRuleIds(nextRuleIds);
        setRuleFilter("all");
        setSelectedId(null);
        setRulePreferenceError(null);

        if (!apiBaseUrl) {
            setActiveRuleIds(activeRuleIds);
            setRulePreferenceError("Could not save the applied rule preference.");
            return;
        }

        const controller = new AbortController();
        rulePreferenceSaveRequest.current = controller;
        setSavingRuleId(ruleId);
        try {
            const response = await fetch(`${apiBaseUrl}/ai/inbox-rules`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ruleId, applied: !wasApplied }),
                signal: controller.signal,
            });
            if (!response.ok) {
                const detail = (await response.text()).trim();
                throw new Error(detail || `Could not save applied rule (${response.status})`);
            }
            const analysis = parseInboxAnalysis(await response.json());
            setActiveRuleIds(analysis.activeRuleIds);
        } catch (saveError: unknown) {
            if (!(saveError instanceof DOMException && saveError.name === "AbortError")) {
                setActiveRuleIds(activeRuleIds);
                setRulePreferenceError(saveError instanceof Error
                    ? saveError.message
                    : "Could not save the applied rule preference.");
            }
        } finally {
            if (rulePreferenceSaveRequest.current === controller) {
                rulePreferenceSaveRequest.current = null;
                setSavingRuleId(null);
            }
        }
    };
    const analyzeInboxRules = async () => {
        if (ruleAnalysisLoading) return;
        savedRuleAnalysisRequest.current?.abort();
        rulePreferenceSaveRequest.current?.abort();
        rulePreferenceSaveRequest.current = null;
        setSavingRuleId(null);
        setRulePreferenceError(null);
        if (!apiBaseUrl) {
            setHasRequestedRuleAnalysis(true);
            setRuleAnalysisError("Inbox analysis is unavailable.");
            return;
        }

        const maxMessages = 100;
        const maxRequestBytes = 192 * 1024;
        const encoder = new TextEncoder();
        const messages: Array<{ id: string; sender: string; subject: string; body: string }> = [];
        let requestBytes = encoder.encode('{"messages":[]}').byteLength;
        for (const envelope of envelopes) {
            if (envelope.trashed) continue;
            if (messages.length === maxMessages) break;
            const base = {
                id: envelope.id,
                sender: String(envelope.notif?.notification?.data?.senderUserName ?? "").slice(0, 256),
                subject: String(envelope.notif?.notification?.data?.subject ?? "").slice(0, 512),
            };
            let message = {
                ...base,
                body: messageBodyToPlainText(envelope.notif?.notification?.data?.messageBody).slice(0, 1000),
            };
            let messageBytes = encoder.encode(JSON.stringify(message)).byteLength + (messages.length === 0 ? 0 : 1);
            if (requestBytes + messageBytes > maxRequestBytes) {
                message = { ...base, body: "" };
                messageBytes = encoder.encode(JSON.stringify(message)).byteLength + (messages.length === 0 ? 0 : 1);
            }
            if (requestBytes + messageBytes > maxRequestBytes) break;
            messages.push(message);
            requestBytes += messageBytes;
        }
        if (messages.length < 2) {
            setHasRequestedRuleAnalysis(true);
            setRuleAnalysisError("At least two inbox messages are required for Qwen analysis.");
            return;
        }

        setHasRequestedRuleAnalysis(true);
        setRuleAnalysisLoading(true);
        setRuleAnalysisError(null);
        setRuleAnalysisModel(null);
        setRuleSuggestions([]);
        setActiveRuleIds([]);
        setRuleFilter("all");

        try {
            const response = await fetch(`${apiBaseUrl}/ai/inbox-rules`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages }),
            });
            if (!response.ok) {
                const rawDetail = (await response.text()).trim();
                const detail = rawDetail.startsWith("<") ? "" : rawDetail;
                if (response.status === 413) {
                    throw new Error("The inbox analysis request exceeded the server size limit.");
                }
                throw new Error(detail || `AI analysis failed (${response.status})`);
            }
            const analysis = parseInboxAnalysis(await response.json());
            setActiveRuleIds(analysis.activeRuleIds);
            setRuleSuggestions(analysis.suggestions);
            setRuleAnalysisModel(analysis.model || "Qwen");
        } catch (analysisError: unknown) {
            setRuleAnalysisError(analysisError instanceof Error
                ? analysisError.message
                : "Qwen inbox analysis failed.");
        } finally {
            setRuleAnalysisLoading(false);
        }
    };



    useEffect(() => {
        if (pendingTests.length === 0) return;

        // eBay's test API returns a base notification UUID, but the delivered
        // webhook payload appends "_<deliveryUUID>" to that value. Match either
        // the exact ID or the delivered form so the E2E wait can complete.
        const matchesTestDelivery = (envelopeId: string, pendingId: string) =>
            envelopeId === pendingId || envelopeId.startsWith(`${pendingId}_`);

        const allDelivered = pendingTests.every((test) =>
            envelopes.some((envelope) => matchesTestDelivery(envelope.id, test.notificationId)),
        );
        if (!allDelivered) return;

        setTestFeedback({
            kind: "success",
            message: `End-to-end test passed. ${pendingTests.length} eBay test notification${pendingTests.length === 1 ? "" : "s"} arrived in the Inbox.`,
        });
        setPendingTests([]);
    }, [envelopes, pendingTests]);

    useEffect(() => {
        if (pendingTests.length === 0) return;

        const timer = window.setTimeout(() => {
            setTestFeedback({
                kind: "error",
                message: `eBay accepted the test, but ${pendingTests.length === 1 ? "it has" : "they have"} not reached the Inbox after 45 seconds. Check the destination status and inbound webhook logs.`,
            });
            setPendingTests([]);
        }, 45_000);

        return () => window.clearTimeout(timer);
    }, [pendingTests]);

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

    const handleTestDelivery = async () => {
        if (testingDelivery) return;
        if (!apiBaseUrl || !usersBaseUri || !subscriptionsUri) {
            setTestFeedback({ kind: "error", message: "Notification API configuration is incomplete." });
            return;
        }
        if (users.length === 0) {
            setTestFeedback({ kind: "error", message: "Connect a seller before testing notification delivery." });
            return;
        }

        setTestingDelivery(true);
        setTestFeedback(null);
        setPendingTests([]);

        const results = await Promise.all(users.map(async (user) => {
            let attemptedTopic = "";
            try {
                const seller = encodeURIComponent(user);
                const subscriptionsResponse = await fetch(
                    `${apiBaseUrl}/${usersBaseUri}/${seller}/${subscriptionsUri}`,
                );
                if (!subscriptionsResponse.ok) {
                    const detail = (await subscriptionsResponse.text()).trim();
                    throw new Error(detail || `could not load subscriptions (${subscriptionsResponse.status})`);
                }

                const data: SubscriptionsResponse = await subscriptionsResponse.json();
                const subscription = data.subscriptions
                    ?.filter((item) => item.status === "ENABLED")
                    .sort((left, right) => {
                        const leftPriority = left.topicId === "NEW_MESSAGE" ? 0 : 1;
                        const rightPriority = right.topicId === "NEW_MESSAGE" ? 0 : 1;
                        return leftPriority - rightPriority
                            || left.topicId.localeCompare(right.topicId)
                            || left.subscriptionId.localeCompare(right.subscriptionId);
                    })[0];
                if (!subscription) return { user, outcome: "skipped" as const };
                attemptedTopic = subscription.topicId;

                const testResponse = await fetch(
                    `${apiBaseUrl}/${usersBaseUri}/${seller}/${subscriptionsUri}/${encodeURIComponent(subscription.subscriptionId)}/test`,
                    { method: "POST" },
                );
                if (!testResponse.ok) {
                    const detail = (await testResponse.text()).trim();
                    throw new Error(detail || `eBay rejected the test (${testResponse.status})`);
                }

                const testData: SubscriptionTestResponse = await testResponse.json();
                return {
                    user,
                    topicId: subscription.topicId,
                    notificationId: testData.notificationId || "",
                    outcome: "sent" as const,
                };
            } catch (err) {
                return {
                    user,
                    topicId: attemptedTopic,
                    outcome: "failed" as const,
                    detail: err instanceof Error ? err.message : "test failed",
                };
            }
        }));

        const sent = results.filter((result) => result.outcome === "sent");
        const skipped = results.filter((result) => result.outcome === "skipped");
        const failed = results.filter((result) => result.outcome === "failed");

        if (failed.length > 0) {
            const successfulPrefix = sent.length > 0
                ? `eBay accepted ${sent.length} test${sent.length === 1 ? "" : "s"}. `
                : "";
            setTestFeedback({
                kind: "error",
                message: `${successfulPrefix}Could not test ${failed.map((result) => `${result.user}${result.topicId ? ` (${result.topicId})` : ""}: ${result.detail}`).join("; ")}`,
            });
        } else if (sent.length === 0) {
            setTestFeedback({
                kind: "error",
                message: "No enabled subscriptions were found. Subscribe to a notification topic first.",
            });
        } else {
            const skippedSuffix = skipped.length > 0
                ? ` ${skipped.length} seller${skipped.length === 1 ? " has" : "s have"} no enabled subscription.`
                : "";
            const traceableTests = sent
                .filter((result) => result.notificationId !== "")
                .map((result) => ({
                    user: result.user,
                    topicId: result.topicId,
                    notificationId: result.notificationId,
                }));
            setPendingTests(traceableTests);
            setTestFeedback({
                kind: traceableTests.length > 0 ? "pending" : "success",
                message: `eBay accepted ${sent.length} test${sent.length === 1 ? "" : "s"} for ${sent.map((result) => `${result.user} (${result.topicId})`).join(", ")}. ${traceableTests.length > 0 ? "Waiting for Inbox delivery…" : "Watch the Inbox for delivery."}${skippedSuffix}`,
            });
        }

        setTestingDelivery(false);
    };

    if (!mounted) {
        return null;
    }

    return (
        <div className="page-content-shell bg-background relative">
            <div className="max-w-7xl mx-auto space-y-8 h-full flex flex-col">

                <PageHeader
                    title="Inbox"
                    flush
                    description={(
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>Live notifications across all sellers.</span>
                            <Link
                                href="/notifications"
                                className="rounded-sm text-xs font-medium text-text-muted underline decoration-dotted underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            >
                                Manage Notifications
                            </Link>
                            {!isSandbox && (
                            <span className="group relative inline-flex">
                                <button
                                    type="button"
                                    onClick={handleTestDelivery}
                                    disabled={testingDelivery || loadingUsers || users.length === 0}
                                    aria-describedby="test-delivery-tooltip"
                                    className="rounded-sm text-xs font-medium text-text-muted underline decoration-dotted underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {testingDelivery ? "Sending test…" : "Test delivery"}
                                </button>
                                <span
                                    id="test-delivery-tooltip"
                                    role="tooltip"
                                    className="pointer-events-none invisible absolute left-0 top-full z-20 mt-2 w-72 rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs font-normal leading-relaxed text-text-secondary opacity-0 shadow-lg transition-opacity sm:left-1/2 sm:-translate-x-1/2 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                                >
                                    Sends one eBay test per seller, preferring the NEW_MESSAGE subscription. Sealift then waits up to 45 seconds for the exact test notification to arrive here.
                                </span>
                            </span>
                            )}
                        </div>
                    )}
                >
                    {testFeedback && (
                        <p
                            role="status"
                            className={`max-w-2xl whitespace-pre-wrap break-words text-xs ${testFeedback.kind === "success"
                                ? "text-success-text"
                                : testFeedback.kind === "pending"
                                    ? "text-primary"
                                    : "text-error-text"
                                }`}
                        >
                            {testFeedback.message}
                        </p>
                    )}
                </PageHeader>

                <div className="flex flex-wrap items-center gap-4">
                    <BellIcon count={unreadCount} />
                    <InboxRulesToggle
                        savedCount={ruleSuggestions.length}
                        expanded={showRuleConfigurator}
                        loading={ruleAnalysisLoading}
                        onToggle={() => setShowRuleConfigurator((current) => !current)}
                    />
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

                {error && (
                    <StatusAlert
                        className="border-l-4 shadow-sm"
                        message={error}
                        variant="error"
                    />
                )}
                {showRuleConfigurator && (
                    <InboxRuleSuggestions
                        envelopes={envelopes}
                        suggestions={ruleSuggestions}
                        model={ruleAnalysisModel}
                        loading={ruleAnalysisLoading}
                        error={ruleAnalysisError}
                        preferenceError={rulePreferenceError}
                        savingRuleId={savingRuleId}
                        hasAnalyzed={hasRequestedRuleAnalysis}
                        activeRuleIds={activeRuleIds}
                        onToggleRule={toggleRule}
                        onAnalyze={analyzeInboxRules}
                        onCollapse={() => setShowRuleConfigurator(false)}
                    />
                )}


                {/* Main layout */}
                <div className="flex flex-col lg:flex-row gap-6 flex-grow min-h-[500px]">

                    {/* Sidebar – message list. Hidden on mobile once a message
                        is open, so the phone shows a single pane at a time. */}
                    <div className={`lg:w-1/3 flex-col gap-4 ${selectedId ? "hidden lg:flex" : "flex"}`}>
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
                                <span className="text-sm text-text-muted font-mono">{displayedEnvelopes.length} total</span>
                            )}
                        </div>
                        {activeTab === "inbox" && activeRules.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2">
                                <span className="px-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">Show</span>
                                <button
                                    type="button"
                                    onClick={() => { setRuleFilter("all"); setSelectedId(null); }}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${ruleFilter === "all" ? "bg-primary/60 text-white" : "text-text-secondary hover:bg-hover hover:text-hover-content"}`}
                                >
                                    All
                                </button>
                                {uniqueDestinations.map((destination) => {
                                    const count = activeRules
                                        .filter((r) => r.destination === destination)
                                        .flatMap((r) => r.matchingIds)
                                        .filter((id) => inboxMessageIds.has(id))
                                        .length;
                                    return (
                                        <button
                                            key={destination}
                                            type="button"
                                            onClick={() => { setRuleFilter(destination); setSelectedId(null); }}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${ruleFilter === destination ? "bg-primary/60 text-white" : "text-text-secondary hover:bg-hover hover:text-hover-content"}`}
                                        >
                                            {destination}
                                            <span className="ml-1 opacity-70">{count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {displayedEnvelopes.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 p-2">
                                <button
                                    type="button"
                                    onClick={toggleAllDisplayedMessages}
                                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-primary/40 hover:text-primary"
                                >
                                    {allDisplayedMessagesSelected ? "Clear all" : "Select all"}
                                </button>
                                <span className="mr-auto text-xs font-medium text-text-secondary">
                                    {selectedDisplayedEnvelopes.length} selected
                                </span>
                                <button
                                    type="button"
                                    onClick={activeTab === "inbox" ? handleBulkTrash : handleBulkDelete}
                                    disabled={selectedDisplayedEnvelopes.length === 0 || bulkMessageActionLoading}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${activeTab === "inbox"
                                        ? "bg-primary/20 hover:opacity-90"
                                        : "bg-error-text/20 hover:opacity-90"
                                        }`}
                                >
                                    {activeTab === "inbox" ? (
                                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" />
                                        </svg>
                                    ) : (
                                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                                        </svg>
                                    )}
                                    {/* <span>
                                        {bulkMessageActionLoading
                                            ? "Working..."
                                            : activeTab === "inbox"
                                                ? "" // move to trash
                                                : "Delete forever"}
                                    </span> */}
                                </button>
                            </div>
                        )}


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
                            <div className="relative">
                                <div className="pointer-events-none absolute bottom-0 left-4 right-0 z-10 h-8 bg-gradient-to-t from-background to-transparent" />
                                
                                <div
                                    ref={messageListRef}
                                    onScroll={(event) => setMessageScrollbar(measureMessageScrollbar(event.currentTarget))}
                                    className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pl-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                >
                                {displayedEnvelopes.map((env) => {
                                    const topic = env.notif?.metadata?.topic || "UNKNOWN_TOPIC";
                                    const dateStr =
                                        env.notif?.notification?.eventDate ??
                                        env.notif?.notification?.publishDate;
                                    const date = dateStr ? new Date(dateStr) : null;
                                    const isSelected = env.id === selectedId;
                                    const isBulkSelected = selectedMessageKeys.has(messageSelectionKey(env));
                                    const isUnread = !env.read;
                                        const matchingRules = activeRules.filter((rule) => rule.matchingIds.includes(env.id));

                                        return (
                                        <div
                                            key={env.id}
                                            onClick={() => selectMessage(env.id, env.user)}
                                            className={`relative h-36 shrink-0 overflow-hidden rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer
                                                ${isBulkSelected
                                                    ? "border-primary/70 bg-primary/10 ring-2 ring-primary/30"
                                                    : isSelected
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
                                                    <input
                                                        type="checkbox"
                                                        checked={isBulkSelected}
                                                        onChange={() => toggleMessageSelection(env)}
                                                        onClick={(event) => event.stopPropagation()}
                                                        aria-label={`Select ${topic} message`}
                                                        className="h-4 w-4 flex-shrink-0 cursor-pointer accent-primary"
                                                    />
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
                                            {matchingRules.length > 0 && (
                                                <div className="mb-1 flex flex-wrap gap-1">
                                                    {matchingRules.map((rule) => {
                                                        const ruleIndex = ruleSuggestions.findIndex((suggestion) => suggestion.id === rule.id);
                                                        const amber = ruleIndex % 2 === 1;
                                                        return (
                                                            <span
                                                                key={rule.id}
                                                                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${amber
                                                                    ? "border-amber-500/50 bg-amber-500/10 text-amber-500 [[data-theme=dark]_&]:text-amber-200"
                                                                    : "border-blue-500/50 bg-blue-500/10 text-blue-500 [[data-theme=dark]_&]:text-blue-200"
                                                                    }`}
                                                            >
                                                                {rule.destination}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <div className={`text-xs truncate ${isUnread ? "text-text-primary font-medium" : "text-text-secondary"}`}>
                                                {topic === "NEW_MESSAGE" && env.notif?.notification?.data?.messageBody
                                                    ? env.notif.notification.data.messageBody
                                                    : env.notif?.notification?.notificationId || "No ID"}
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-y-0 left-1 w-1.5 rounded-full bg-border/40"
                                    style={{
                                        visibility: messageScrollbar.visible ? "visible" : "hidden"
                                    }}
                                >
                                    <div
                                        className="absolute inset-x-0 rounded-full bg-text-muted/80"
                                        style={{
                                            height: `${messageScrollbar.height}px`,
                                            transform: `translateY(${messageScrollbar.top}px)`,
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Main message panel. On mobile it replaces the list. */}
                    <div className={`lg:w-2/3 flex-col bg-surface rounded-2xl shadow-sm border border-border overflow-hidden ${selectedId ? "flex" : "hidden lg:flex"}`}>
                        {selectedEnvelope && (
                            <button
                                onClick={() => setSelectedId(null)}
                                className="lg:hidden flex items-center gap-2 px-4 py-3 text-sm font-semibold text-primary border-b border-border min-h-[44px]"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m15 18-6-6 6-6" />
                                </svg>
                                Back to {activeTab === "inbox" ? "inbox" : "trash"}
                            </button>
                        )}
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
                                    className="px-4 pb-0 pt-4 sm:px-6 sm:pb-0 sm:pt-6 text-text-primary flex-grow flex flex-col"
                                >
                                    {selectedEnvelope.notif?.metadata?.topic === "NEW_MESSAGE" ? (
                                        <div className="flex-grow flex flex-col space-y-6">
                                            <MessageBody body={selectedEnvelope.notif.notification?.data?.messageBody} />

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
