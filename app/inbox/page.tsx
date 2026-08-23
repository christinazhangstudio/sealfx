"use client";

import DOMPurify from "dompurify";
import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useNotifications } from "@/components/NotificationContext";
import type { NotifEnvelope } from "@/components/NotificationContext";
import { trackedFetch as fetch } from "@/lib/api-tracker";
import PageHeader from "@/components/PageHeader";
import PageActionBar from "@/components/PageActionBar";
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


function envelopeEventTime(envelope: { notif: { notification?: { eventDate?: string; publishDate?: string; data?: { createdDate?: string } } } }) {
    return envelope.notif?.notification?.eventDate
        ?? envelope.notif?.notification?.publishDate
        ?? envelope.notif?.notification?.data?.createdDate
        ?? "";
}

function notificationHasParsedMessage(envelope: Pick<NotifEnvelope, "notif">): boolean {
    const data = envelope.notif?.notification?.data;
    return (typeof data?.messageBody === "string" && data.messageBody.trim() !== "")
        || (typeof data?.subject === "string" && data.subject.trim() !== "");
}

function messageListPreview(envelope: Pick<NotifEnvelope, "notif">): string {
    const data = envelope.notif?.notification?.data;
    const plain = messageBodyToPlainText(data?.messageBody)
        .replace(/\s+/g, " ")
        .trim();
    if (plain) return plain;

    const subject = String(data?.subject ?? "").trim();
    if (subject) return subject;

    return envelope.notif?.notification?.notificationId || "No ID";
}

function conversationParticipant(envelope: Pick<NotifEnvelope, "notif" | "user">): string {
    const data = envelope.notif?.notification?.data;
    const sender = typeof data?.senderUserName === "string" ? data.senderUserName.trim() : "";
    const recipient = typeof data?.recipientUserName === "string" ? data.recipientUserName.trim() : "";
    if (sender && sender !== envelope.user) return sender;
    if (recipient && recipient !== envelope.user) return recipient;
    if (sender) return sender;
    if (recipient) return recipient;
    return String(envelope.notif?.metadata?.topic ?? "Notification").replace(/_/g, " ");
}

function participantInitial(participant: string): string {
    return participant.trim().charAt(0).toUpperCase() || "?";
}

const EMAIL_SCALE_OPTIONS = [0.5, 0.75, 1, 1.25] as const;
type EmailScale = typeof EMAIL_SCALE_OPTIONS[number];

function generateEmailFrameHead(cspImgSrc: string, scale: EmailScale) {
    const styleBlock = `html,body{max-width:100%;overflow-wrap:anywhere}body{zoom:${scale}!important;margin:0;padding:16px}img{max-width:100%;height:auto}table{max-width:100%}`;
    return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src ${cspImgSrc}; font-src data:; form-action 'none'; base-uri 'none'">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>${styleBlock}</style>`;
}

function sanitizeEmailHtml(html: string, showImages: boolean, scale: EmailScale): string {
    const purifier = DOMPurify(window);
    const sanitized = purifier.sanitize(html, {
        WHOLE_DOCUMENT: true,
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "textarea", "select", "link", "meta", "base"],
        FORBID_ATTR: ["action", "formaction", "ping", ...(showImages ? [] : ["src", "srcset"])],
    });

    const frameHead = generateEmailFrameHead(showImages ? "https: data: cid:" : "data: cid:", scale);
    return /<head(?:\s[^>]*)?>/i.test(sanitized)
        ? sanitized.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${frameHead}`)
        : `<!doctype html><html><head>${frameHead}</head><body>${sanitized}</body></html>`;
}

function HtmlMessageBody({
    html,
    scale,
    onScaleChange,
}: {
    html: string;
    scale: EmailScale;
    onScaleChange: (scale: EmailScale) => void;
}) {
    const [showImages, setShowImages] = useState(false);
    const sanitizedHtml = useMemo(
        () => typeof window === "undefined" ? "" : sanitizeEmailHtml(html, showImages, scale),
        [html, scale, showImages],
    );

    if (sanitizedHtml === "") {
        return (
            <div className="bg-message-pill/4 rounded-lg p-8 border border-primary/20 shadow-inner text-text-secondary leading-relaxed whitespace-pre-wrap">
                {messageBodyToPlainText(html)}
            </div>
        );
    }

    const hasHiddenImages = /<img[^>]+src=/i.test(html) && !showImages;

    return (
        <div className="flex h-full flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-sm">
                {hasHiddenImages && (
                    <>
                        <span className="min-w-48 flex-1 text-sm italic text-text-secondary">
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
                    </>
                )}
                <label className="ml-auto inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-text-secondary">
                    Email scale
                    <select
                        aria-label="Email scale"
                        value={scale}
                        onChange={(event) => {
                            const selected = EMAIL_SCALE_OPTIONS.find((option) => option === Number(event.target.value));
                            if (selected) onScaleChange(selected);
                        }}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-text-primary outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                        {EMAIL_SCALE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {Math.round(option * 100)}%
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <iframe
                title="Rendered email message"
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
                srcDoc={sanitizedHtml}
                className="min-h-[420px] flex-grow w-full rounded-t-lg border-x border-t border-primary/20 bg-white shadow-inner"
            />
        </div>
    );
}

function MessageBody({
    body,
    emailScale,
    onEmailScaleChange,
}: {
    body: unknown;
    emailScale: EmailScale;
    onEmailScaleChange: (scale: EmailScale) => void;
}) {
    const content = String(body ?? "");
    if (content === "") {
        return (
            <p className="italic text-text-muted">
                No message content.
            </p>
        );
    }
    if (messageBodyHasHtml(content)) {
        return (
            <HtmlMessageBody
                html={content}
                scale={emailScale}
                onScaleChange={onEmailScaleChange}
            />
        );
    }
    return (
        <div className="whitespace-pre-wrap break-words leading-relaxed text-text-primary">
            {content}
        </div>
    );
}

interface MessageMediaAttachment {
    mediaUrl?: string;
    mediaName?: string;
    mediaType?: string;
}

function isImageAttachment(attachment: MessageMediaAttachment): boolean {
    const mediaType = attachment.mediaType?.trim().toUpperCase() || "";
    if (mediaType === "IMAGE" || mediaType.startsWith("IMAGE/")) return true;

    const candidate = attachment.mediaName || attachment.mediaUrl || "";
    return /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(candidate);
}

function ImageAttachmentThumbnail({
    mediaUrl,
    label,
}: {
    mediaUrl: string;
    label: string;
}) {
    const [failed, setFailed] = useState(false);

    return (
        <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-attachment-kind="image"
            className="group/attachment block w-40 overflow-hidden rounded-xl border border-border/70 bg-background/60 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md motion-reduce:transform-none"
        >
            <span className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-surface">
                {failed ? (
                    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="m21 15-5-5L5 21" />
                    </svg>
                ) : (
                    <>
                        {/* Attachment URLs are dynamic eBay media; load them directly instead of proxying them through Next.js. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={mediaUrl}
                            alt={label}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={() => setFailed(true)}
                            className="h-full w-full object-cover transition-transform duration-200 group-hover/attachment:scale-[1.03] motion-reduce:transform-none"
                        />
                    </>
                )}
            </span>
            <span className="block truncate border-t border-border/50 px-2.5 py-2 text-xs font-medium text-text-primary">
                {label}
            </span>
        </a>
    );
}

function MessageAttachments({
    messageId,
    media,
}: {
    messageId: string;
    media: MessageMediaAttachment[];
}) {
    if (!media.some((item) => item.mediaUrl)) return null;

    return (
        <div className="flex flex-wrap gap-2 border-t border-border/40 pt-3">
            {media.map((item, mediaIndex) => {
                if (!item.mediaUrl) return null;
                const label = item.mediaName || `Attachment ${mediaIndex + 1}`;
                if (isImageAttachment(item)) {
                    return (
                        <ImageAttachmentThumbnail
                            key={`${messageId}-${mediaIndex}`}
                            mediaUrl={item.mediaUrl}
                            label={label}
                        />
                    );
                }

                return (
                    <a
                        key={`${messageId}-${mediaIndex}`}
                        href={item.mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-attachment-kind="file"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-3 py-1.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15 transition-colors hover:bg-primary/10"
                    >
                        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        {label}
                    </a>
                );
            })}
        </div>
    );
}


function notificationFieldLabel(field: string): string {
    return field
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/^./, (character) => character.toUpperCase());
}

function NotificationSummary({ envelope }: { envelope: NotifEnvelope }) {
    const notification = envelope.notif?.notification;
    const data = notification?.data;
    const fields = data && typeof data === "object"
        ? Object.entries(data)
            .filter(([, value]) =>
                typeof value === "string"
                || typeof value === "number"
                || typeof value === "boolean",
            )
            .slice(0, 12)
        : [];
    const dateValue = envelopeEventTime(envelope);
    const date = dateValue ? new Date(dateValue) : null;

    return (
        <div className="flex-grow pb-6">
            <section className="rounded-2xl border border-border/50 bg-background/35 p-4 sm:p-5">
                <h3 className="font-semibold text-text-primary">Notification details</h3>
                <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    <div>
                        <dt className="text-xs text-text-muted">Seller</dt>
                        <dd className="mt-0.5 break-words text-text-primary">{envelope.user}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-text-muted">Notification ID</dt>
                        <dd className="mt-0.5 break-all text-text-primary">
                            {notification?.notificationId || "Unavailable"}
                        </dd>
                    </div>
                    {date && !Number.isNaN(date.getTime()) && (
                        <div>
                            <dt className="text-xs text-text-muted">Received</dt>
                            <dd className="mt-0.5 text-text-primary">
                                {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </dd>
                        </div>
                    )}
                    {fields.map(([field, value]) => (
                        <div key={field}>
                            <dt className="text-xs text-text-muted">{notificationFieldLabel(field)}</dt>
                            <dd className="mt-0.5 break-words text-text-primary">{String(value)}</dd>
                        </div>
                    ))}
                </dl>
            </section>
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


interface MessageThread {
    id: string;
    messages: NotifEnvelope[];
    latest: NotifEnvelope;
}

function messageThreadKey(envelope: NotifEnvelope): string {
    const topic = envelope.notif?.metadata?.topic;
    const conversationId = envelope.notif?.notification?.data?.conversationId;
    if (topic === "NEW_MESSAGE" && typeof conversationId === "string" && conversationId.trim() !== "") {
        return `${envelope.user}\u0000conversation\u0000${conversationId.trim()}`;
    }
    return `${envelope.user}\u0000message\u0000${envelope.id}`;
}

function groupMessageThreads(envelopes: NotifEnvelope[]): MessageThread[] {
    const grouped = new Map<string, NotifEnvelope[]>();
    for (const envelope of envelopes) {
        const key = messageThreadKey(envelope);
        const messages = grouped.get(key);
        if (messages) messages.push(envelope);
        else grouped.set(key, [envelope]);
    }

    return [...grouped.entries()]
        .map(([id, messages]) => {
            messages.sort((left, right) => envelopeEventTime(left).localeCompare(envelopeEventTime(right)));
            return { id, messages, latest: messages[messages.length - 1] };
        })
        .sort((left, right) => envelopeEventTime(right.latest).localeCompare(envelopeEventTime(left.latest)));
}

export default function InboxPage() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const { users, envelopes, unreadCount, isSandbox, selectMessage: contextSelectMessage, trashMessage, deleteMessage, loadingUsers, error } = useNotifications();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"inbox" | "trash">("inbox");
    const [emailScale, setEmailScale] = useState<EmailScale>(0.75);
    const [testingDelivery, setTestingDelivery] = useState(false);
    const [testFeedback, setTestFeedback] = useState<TestFeedback | null>(null);
    const [pendingTests, setPendingTests] = useState<PendingTest[]>([]);
    const [selectedMessageKeys, setSelectedMessageKeys] = useState<Set<string>>(() => new Set());
    const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(() => new Set());
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
    const savedRuleAnalysisRequest = useRef<AbortController | null>(null);
    const rulePreferenceSaveRequest = useRef<AbortController | null>(null);

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const usersBaseUri = process.env.NEXT_PUBLIC_NOTIFICATIONS_USERS_BASE_URI;
    const subscriptionsUri = process.env.NEXT_PUBLIC_NOTIFICATIONS_SUBSCRIPTIONS_URI;

    const activeRules = ruleSuggestions.filter((rule) => activeRuleIds.includes(rule.id));
    const uniqueDestinations = [...new Set(activeRules.map((r) => r.destination))];
    const inboxMessageIds = new Set(
        envelopes
            .filter((envelope) => !envelope.trashed && !hiddenUsers.has(envelope.user))
            .map((envelope) => envelope.id),
    );
    const tabEnvelopes = envelopes
        .filter((envelope) => activeTab === "trash" ? envelope.trashed : !envelope.trashed)
        .filter((envelope) => !hiddenUsers.has(envelope.user));
    const tabThreads = groupMessageThreads(tabEnvelopes);
    const displayedThreads = activeTab === "trash" || ruleFilter === "all"
        ? tabThreads
        : tabThreads.filter((thread) =>
            thread.messages.some((envelope) =>
                activeRules.some((rule) =>
                    rule.destination === ruleFilter && rule.matchingIds.includes(envelope.id),
                ),
            ),
        );
    const displayedEnvelopes = displayedThreads.flatMap((thread) => thread.messages);
    const tabHasMessages = envelopes.some((envelope) =>
        (activeTab === "trash" ? envelope.trashed : !envelope.trashed)
        && (activeTab === "trash"
            || ruleFilter === "all"
            || activeRules.some((rule) => rule.destination === ruleFilter && rule.matchingIds.includes(envelope.id))));
    const selectedThread = displayedThreads.find((thread) =>
        thread.messages.some((envelope) => envelope.id === selectedId),
    ) ?? null;
    const selectedEnvelope = selectedThread?.latest ?? null;
    const selectedHasParsedMessage = selectedEnvelope
        ? notificationHasParsedMessage(selectedEnvelope)
        : false;
    const selectedParticipant = selectedEnvelope
        ? conversationParticipant(selectedEnvelope)
        : null;
    const selectedDisplayedEnvelopes = displayedEnvelopes.filter((envelope) =>
        selectedMessageKeys.has(messageSelectionKey(envelope)),
    );
    const allDisplayedMessagesSelected = displayedEnvelopes.length > 0
        && selectedDisplayedEnvelopes.length === displayedEnvelopes.length;


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
    }, [activeTab, ruleFilter, hiddenUsers]);

    const toggleUserFilter = (user: string) => {
        const hiding = !hiddenUsers.has(user);
        setHiddenUsers((current) => {
            const next = new Set(current);
            if (hiding) next.add(user);
            else next.delete(user);
            return next;
        });
        if (hiding && selectedEnvelope?.user === user) {
            setSelectedId(null);
        }
    };

    const toggleThreadSelection = (thread: MessageThread) => {
        const keys = thread.messages.map(messageSelectionKey);
        const allSelected = keys.every((key) => selectedMessageKeys.has(key));
        setSelectedMessageKeys((current) => {
            const next = new Set(current);
            for (const key of keys) {
                if (allSelected) next.delete(key);
                else next.add(key);
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

    const selectThread = (thread: MessageThread) => {
        setSelectedId(thread.latest.id);
        for (const message of thread.messages) {
            if (!message.read) void contextSelectMessage(message.id, message.user);
        }
    };

    const trashThread = async (thread: MessageThread) => {
        await Promise.all(thread.messages.map((message) => trashMessage(message.id, message.user)));
        if (selectedThread?.id === thread.id) setSelectedId(null);
    };

    const deleteThread = async (thread: MessageThread) => {
        const count = thread.messages.length;
        if (!confirm(`Permanently delete this thread and its ${count} message${count === 1 ? "" : "s"}? This cannot be undone.`)) return;
        await Promise.all(thread.messages.map((message) => deleteMessage(message.id, message.user)));
        if (selectedThread?.id === thread.id) setSelectedId(null);
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
                    description="Live notifications across all sellers."
                />

                <PageActionBar ariaLabel="Inbox controls">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <BellIcon count={unreadCount} />
                            <InboxRulesToggle
                                savedCount={ruleSuggestions.length}
                                expanded={showRuleConfigurator}
                                loading={ruleAnalysisLoading}
                                onToggle={() => setShowRuleConfigurator((current) => !current)}
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Link
                                href="/notifications"
                                className="shrink-0 rounded-full border border-border/60 bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
                                        className="shrink-0 rounded-full border border-border/60 bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {testingDelivery ? "Sending test…" : "Test delivery"}
                                    </button>
                                    <span
                                        id="test-delivery-tooltip"
                                        role="tooltip"
                                        className="pointer-events-none invisible absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs font-normal leading-relaxed text-text-secondary opacity-0 shadow-lg transition-opacity sm:left-1/2 sm:right-auto sm:-translate-x-1/2 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                                    >
                                        Sends one eBay test per seller, preferring the NEW_MESSAGE subscription. Sealift then waits up to 45 seconds for the exact test notification to arrive here.
                                    </span>
                                </span>
                            )}
                        </div>
                    </div>

                    {testFeedback && (
                        <p
                            role="status"
                            className={`px-1 whitespace-pre-wrap break-words text-xs ${testFeedback.kind === "success"
                                ? "text-success-text"
                                : testFeedback.kind === "pending"
                                    ? "text-primary"
                                    : "text-error-text"
                                }`}
                        >
                            {testFeedback.message}
                        </p>
                    )}

                    {loadingUsers ? (
                        <div className="flex items-center gap-3 px-1 pb-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Sellers</span>
                            <div className="h-7 w-40 animate-pulse rounded-full bg-background/70" />
                        </div>
                    ) : users.length > 0 ? (
                        <div className="-mx-1 overflow-x-auto px-1 pb-1">
                            <div className="flex min-w-max items-center gap-2">
                                <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Sellers</span>
                                {users.map((user) => {
                                    const visible = !hiddenUsers.has(user);
                                    return (
                                        <label
                                            key={user}
                                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                                visible
                                                    ? "border-primary/25 bg-primary/10 text-primary"
                                                    : "border-border/60 bg-background/60 text-text-muted"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={visible}
                                                onChange={() => toggleUserFilter(user)}
                                                aria-label={`Show messages for ${user}`}
                                                className="h-3.5 w-3.5 cursor-pointer accent-primary"
                                            />
                                            {user}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                </PageActionBar>

                {error && (
                    <StatusAlert
                        className="border-l-4 shadow-sm"
                        message={error}
                        variant="error"
                    />
                )}
                {showRuleConfigurator && (
                    <InboxRuleSuggestions
                        envelopes={envelopes.filter((envelope) => !hiddenUsers.has(envelope.user))}
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
                <div className="grid min-h-[500px] flex-grow grid-cols-1 gap-6 lg:grid-cols-3">

                    {/* Sidebar – message list. Hidden on mobile once a message
                        is open, so the phone shows a single pane at a time. */}
                    <div className={`min-w-0 flex-col gap-4 ${selectedId ? "hidden lg:flex" : "flex"}`}>
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
                            <span className="text-right text-xs text-text-muted font-mono">
                                {displayedThreads.length} {displayedThreads.length === 1 ? "thread" : "threads"} · {displayedEnvelopes.length} {displayedEnvelopes.length === 1 ? "message" : "messages"}
                            </span>
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
                                </button>
                            </div>
                        )}


                        {loadingUsers ? (
                            <div className="animate-pulse flex flex-col gap-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="bg-surface h-24 rounded-xl shadow-sm border border-border" />
                                ))}
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="pointer-events-none absolute bottom-0 left-4 right-0 z-10 h-8 bg-gradient-to-t from-background to-transparent" />
                                <div
                                    className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pb-3 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                >
                                {displayedThreads.length === 0 ? (
                                    <div className="text-secondary p-4 bg-surface rounded-xl border border-border text-center flex flex-col items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /><path d="m16 19 2 2 4-4" /></svg>
                                        {activeTab === "inbox"
                                            ? (tabHasMessages
                                                ? "No messages for the selected sellers."
                                                : "No messages yet — waiting for live notifications.")
                                            : (tabHasMessages
                                                ? "No trashed messages for the selected sellers."
                                                : "Trash is empty.")}
                                    </div>
                                ) : displayedThreads.map((thread) => {
                                    const env = thread.latest;
                                    const data = env.notif?.notification?.data;
                                    const subject = typeof data?.subject === "string" ? data.subject.trim() : "";
                                    const participant = conversationParticipant(env);
                                    const preview = messageListPreview(env);
                                    const dateValue = envelopeEventTime(env);
                                    const date = dateValue ? new Date(dateValue) : null;
                                    const validDate = date && !Number.isNaN(date.getTime()) ? date : null;
                                    const dateLabel = validDate
                                        ? (validDate.toDateString() === new Date().toDateString()
                                            ? validDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                            : validDate.toLocaleDateString([], { month: "short", day: "numeric" }))
                                        : null;
                                    const isSelected = selectedThread?.id === thread.id;
                                    const isBulkSelected = thread.messages.every((message) =>
                                        selectedMessageKeys.has(messageSelectionKey(message)),
                                    );
                                    const isUnread = thread.messages.some((message) => !message.read);
                                    const matchingRules = activeRules.filter((rule) =>
                                        thread.messages.some((message) => rule.matchingIds.includes(message.id)),
                                    );

                                    return (
                                        <div
                                            key={thread.id}
                                            onClick={() => selectThread(thread)}
                                            className={`group relative shrink-0 cursor-pointer rounded-2xl border px-3 py-3.5 transition-all duration-200 ${
                                                isBulkSelected
                                                    ? "border-primary/50 bg-primary/10 ring-2 ring-primary/15"
                                                    : isSelected
                                                        ? "border-primary/40 bg-primary/[0.07] shadow-sm"
                                                        : isUnread
                                                            ? "border-border/60 bg-blue-500/[0.08] hover:bg-blue-500/[0.11] hover:shadow-sm"
                                                            : "border-border/60 bg-surface/75 hover:border-primary/25 hover:bg-surface hover:shadow-sm"
                                            }`}
                                        >
                                            <div className="flex min-w-0 items-start gap-3 pr-6">
                                                <input
                                                    type="checkbox"
                                                    checked={isBulkSelected}
                                                    onChange={() => toggleThreadSelection(thread)}
                                                    onClick={(event) => event.stopPropagation()}
                                                    aria-label={`Select conversation with ${participant}`}
                                                    className="mt-3.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-primary"
                                                />
                                                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                                    {participantInitial(participant)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
                                                            {participant}
                                                        </span>
                                                        {dateLabel && (
                                                            <time
                                                                className="flex-shrink-0 whitespace-nowrap text-[11px] text-text-muted"
                                                                dateTime={validDate?.toISOString()}
                                                            >
                                                                {dateLabel}
                                                            </time>
                                                        )}
                                                    </div>
                                                    {subject && (
                                                        <p className="mt-0.5 truncate text-xs text-text-secondary">
                                                            {subject}
                                                        </p>
                                                    )}
                                                    <p className="mt-0.5 truncate text-xs text-text-muted">
                                                        {preview}
                                                    </p>
                                                    <div className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5">
                                                        {users.length > 1 && (
                                                            <span className="text-[10px] text-text-muted">
                                                                via {env.user}
                                                            </span>
                                                        )}
                                                        {thread.messages.length > 1 && (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                                                <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                                                                </svg>
                                                                {thread.messages.length}
                                                            </span>
                                                        )}
                                                        {matchingRules.map((rule) => {
                                                            const ruleIndex = ruleSuggestions.findIndex((suggestion) => suggestion.id === rule.id);
                                                            const amber = ruleIndex % 2 === 1;
                                                            return (
                                                                <span
                                                                    key={rule.id}
                                                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                                        amber
                                                                            ? "bg-amber-500/10 text-amber-600 [[data-theme=dark]_&]:text-amber-200"
                                                                            : "bg-blue-500/10 text-blue-600 [[data-theme=dark]_&]:text-blue-200"
                                                                    }`}
                                                                >
                                                                    {rule.destination}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                            {!env.trashed ? (
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void trashThread(thread);
                                                    }}
                                                    className="absolute bottom-2 right-2 rounded-md p-1.5 text-text-muted opacity-60 transition-opacity hover:bg-error-bg hover:text-error-text group-hover:opacity-100"
                                                    title="Move conversation to Trash"
                                                    aria-label="Move conversation to Trash"
                                                >
                                                    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                    </svg>
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void deleteThread(thread);
                                                    }}
                                                    className="absolute bottom-2 right-2 rounded-md p-1.5 text-text-muted opacity-60 transition-opacity hover:bg-orange-600/10 hover:text-orange-600 group-hover:opacity-100"
                                                    title="Permanently delete conversation"
                                                    aria-label="Permanently delete conversation"
                                                >
                                                    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Main message panel. On mobile it replaces the list. */}
                    <div className={`min-w-0 flex-col bg-surface rounded-2xl shadow-sm border border-border overflow-hidden lg:col-span-2 ${selectedId ? "flex" : "hidden lg:flex"}`}>
                        {selectedEnvelope && (
                            <button
                                onClick={() => setSelectedId(null)}
                                className="lg:hidden flex items-center gap-2 px-4 py-3 text-sm font-semibold text-primary border-b border-border/30 min-h-[44px]"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m15 18-6-6 6-6" />
                                </svg>
                                Back to {activeTab === "inbox" ? "inbox" : "trash"}
                            </button>
                        )}
                        {selectedThread && selectedEnvelope ? (
                            <>
                                <div className="relative border-b border-border/30 bg-surface/80 p-4 sm:p-5">
                                    {selectedHasParsedMessage ? (
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                                {participantInitial(selectedParticipant || "Notification")}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h2 className="break-words text-xl font-bold leading-tight text-text-primary sm:text-2xl">
                                                    {selectedEnvelope.notif.notification?.data?.subject || "Conversation"}
                                                </h2>
                                                <p className="mt-1 text-sm text-text-muted">
                                                    {selectedParticipant || "Unknown participant"}
                                                    <span aria-hidden="true"> · </span>
                                                    {selectedThread.messages.length} {selectedThread.messages.length === 1 ? "message" : "messages"}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <h2 className="break-words text-xl font-bold text-text-primary sm:text-2xl">
                                                {String(selectedEnvelope.notif?.metadata?.topic || "Notification").replace(/_/g, " ")}
                                            </h2>
                                            <p className="mt-1 text-sm text-text-muted">{selectedEnvelope.user}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-grow overflow-y-auto bg-background/25 px-3 py-5 text-text-primary sm:px-6 sm:py-6">
                                    {selectedHasParsedMessage ? (
                                        <div className="space-y-4">
                                            {selectedThread.messages.map((message, index) => {
                                                const data = message.notif?.notification?.data;
                                                const dateValue = envelopeEventTime(message);
                                                const date = dateValue ? new Date(dateValue) : null;
                                                const validDate = date && !Number.isNaN(date.getTime()) ? date : null;
                                                const previousDateValue = index > 0
                                                    ? envelopeEventTime(selectedThread.messages[index - 1])
                                                    : "";
                                                const previousDate = previousDateValue ? new Date(previousDateValue) : null;
                                                const showDay = validDate && (
                                                    !previousDate
                                                    || Number.isNaN(previousDate.getTime())
                                                    || validDate.toDateString() !== previousDate.toDateString()
                                                );
                                                const dayLabel = validDate
                                                    ? (validDate.toDateString() === new Date().toDateString()
                                                        ? "Today"
                                                        : validDate.toLocaleDateString([], {
                                                            weekday: "short",
                                                            month: "short",
                                                            day: "numeric",
                                                        }))
                                                    : "";
                                                const media = (Array.isArray(data?.messageMedia)
                                                    ? data.messageMedia
                                                    : []) as MessageMediaAttachment[];
                                                const isOwnMessage = data?.senderUserName === message.user;
                                                const sender = isOwnMessage
                                                    ? "You"
                                                    : data?.senderUserName || selectedParticipant || "Unknown";
                                                const messageBody = String(data?.messageBody ?? "");
                                                const isHtmlMessage = messageBodyHasHtml(messageBody);

                                                return (
                                                    <div key={message.id} className="space-y-4">
                                                        {showDay && (
                                                            <div className="flex items-center gap-3 py-1" aria-label={dayLabel}>
                                                                <span className="h-px flex-1 bg-border/50" />
                                                                <span className="text-[11px] font-medium text-text-muted">{dayLabel}</span>
                                                                <span className="h-px flex-1 bg-border/50" />
                                                            </div>
                                                        )}
                                                        <article
                                                            data-thread-message-id={message.id}
                                                            data-message-direction={isOwnMessage ? "outgoing" : "incoming"}
                                                            data-message-format={isHtmlMessage ? "html" : "plain"}
                                                            className={isHtmlMessage
                                                                ? "w-full"
                                                                : `flex items-end gap-2 ${isOwnMessage ? "justify-end" : "justify-start"}`
                                                            }
                                                        >
                                                            {isHtmlMessage ? (
                                                                <div className="w-full overflow-hidden rounded-xl border border-border/70 bg-surface shadow-sm">
                                                                    <header className="flex items-center gap-3 border-b border-border/50 bg-surface/80 px-4 py-3">
                                                                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                                            {participantInitial(String(sender))}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <span className="block truncate text-sm font-semibold text-text-primary">{sender}</span>
                                                                            {validDate && (
                                                                                <time className="block text-[11px] text-text-muted" dateTime={validDate.toISOString()}>
                                                                                    {validDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                                                </time>
                                                                            )}
                                                                        </div>
                                                                    </header>
                                                                    <div className="space-y-3 p-3 sm:p-4">
                                                                        <MessageBody body={messageBody} emailScale={emailScale} onEmailScaleChange={setEmailScale} />
                                                                        <MessageAttachments messageId={message.id} media={media} />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {!isOwnMessage && (
                                                                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-primary shadow-sm ring-1 ring-border/50">
                                                                            {participantInitial(String(sender))}
                                                                        </div>
                                                                    )}
                                                                    <div className={`min-w-0 max-w-[84%] sm:max-w-[78%] ${isOwnMessage ? "items-end" : "items-start"}`}>
                                                                        <div className={`mb-1 flex items-center gap-2 px-1 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                                                                            <span className="text-xs font-semibold text-text-secondary">{sender}</span>
                                                                            {validDate && (
                                                                                <time className="text-[11px] text-text-muted" dateTime={validDate.toISOString()}>
                                                                                    {validDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                                                </time>
                                                                            )}
                                                                        </div>
                                                                        <div className={`space-y-3 px-4 py-3 shadow-sm ${
                                                                            isOwnMessage
                                                                                ? "rounded-2xl rounded-tr-md bg-primary/12 ring-1 ring-inset ring-primary/15"
                                                                                : "rounded-2xl rounded-tl-md bg-surface ring-1 ring-inset ring-border/60"
                                                                        }`}>
                                                                            <MessageBody body={messageBody} emailScale={emailScale} onEmailScaleChange={setEmailScale} />
                                                                            <MessageAttachments messageId={message.id} media={media} />
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </article>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <NotificationSummary envelope={selectedEnvelope} />
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-grow flex items-center justify-center p-12 text-center">
                                <p className="text-secondary text-lg">Select a thread to read.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
