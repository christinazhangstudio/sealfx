"use client";

import { useState } from "react";
import type { NotifEnvelope } from "@/components/NotificationContext";

export type InboxRuleSuggestion = {
    id: string;
    title: string;
    description: string;
    destination: string;
    conditions: string[];
    matchingIds: string[];
};

type Props = {
    envelopes: NotifEnvelope[];
    suggestions: InboxRuleSuggestion[];
    model: string | null;
    loading: boolean;
    error: string | null;
    preferenceError: string | null;
    savingRuleId: string | null;
    hasAnalyzed: boolean;
    activeRuleIds: string[];
    onToggleRule: (ruleId: string) => void;
    onCollapse?: () => void;
    onAnalyze: () => void;
};

function SparklesIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m12 3-1.8 5.2L5 10l5.2 1.8L12 17l1.8-5.2L19 10l-5.2-1.8L12 3Z" />
            <path d="m5 16-.7 2.3L2 19l2.3.7L5 22l.7-2.3L8 19l-2.3-.7L5 16Z" />
        </svg>
    );
}

export function InboxRulesToggle({
    savedCount,
    expanded,
    loading,
    onToggle,
}: {
    savedCount: number;
    expanded: boolean;
    loading: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? "Collapse AI suggested rules" : "Expand AI suggested rules"}
            aria-controls="ai-inbox-rules-configurator"
            aria-expanded={expanded}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/20 bg-surface px-2.5 py-1.5 shadow-sm transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
            <span className={`shine-button inline-flex h-7 w-7 items-center justify-center rounded-md text-white ${loading ? "animate-pulse bg-primary/70" : "bg-primary"}`} aria-hidden="true">
                <SparklesIcon />
            </span>
            <span className="inline-flex items-center whitespace-nowrap">
                <span className="glass-caps !mb-0 text-[10px]">AI Suggested Rules&nbsp;({savedCount} saved)</span>
            </span>
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`flex-shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                aria-hidden="true"
            >
                <path d="m6 9 6 6 6-6" />
            </svg>
        </button>
    );
}

export default function InboxRuleSuggestions({
    envelopes,
    suggestions,
    model,
    loading,
    error,
    preferenceError,
    savingRuleId,
    hasAnalyzed,
    activeRuleIds,
    onToggleRule,
    onAnalyze,
    onCollapse,
}: Props) {
    const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
    const handleAnalyze = () => {
        setExpandedRuleId(null);
        onAnalyze();
    };


    return (
        <section id="ai-inbox-rules-configurator" className="ai-rules-configurator relative z-10 mb-8">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-2xl">
                    <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Inbox rules</span>
                    </div>
                    <h2 className="glass-caps text-lg font-bold text-text-primary">
                        {loading
                            ? "AI is analyzing this inbox"
                            : hasAnalyzed
                                ? `${suggestions.length} rule suggestion${suggestions.length === 1 ? "" : "s"}`
                                : "Organize your inbox with AI"}
                    </h2>
                    <p className="text-xs leading-relaxed text-text-secondary">
                        AI will analyze themes in your messages and propose rules for you to review. Nothing is applied automatically.
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-text-muted">
                        Analysis includes up to 100 messages and truncates long message bodies. The pool is made up of messages across all sellers.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:max-w-xs sm:justify-end">
                    <span className="w-fit rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-text-muted">
                        {model ? `Analyzed by ${model}` : "On-demand AI analysis"}
                    </span>
                    {hasAnalyzed && !loading && !error && (
                        <button
                            type="button"
                            onClick={handleAnalyze}
                            className="min-h-10 whitespace-nowrap rounded-lg border border-primary/30 bg-surface px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        >
                            Reanalyze inbox
                        </button>
                    )}
                </div>
            </div>
            {preferenceError && (
                <p className="mt-4 rounded-lg border border-error-text/30 bg-error-bg p-3 text-xs text-error-text" role="alert">
                    {preferenceError}
                </p>
            )}
            {!hasAnalyzed && !loading && (
                <div className="mt-3 flex justify-center bg-surface sm:justify-start">
                    <button
                        type="button"
                        onClick={handleAnalyze}
                        className="shine-button min-h-11 whitespace-nowrap rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                        Suggest new rules
                    </button>
                </div>
            )}

            {loading && (
                <div className="mt-5 grid gap-4 xl:grid-cols-2" aria-label="Analyzing inbox">
                    {[0, 1].map((item) => (
                        <div key={item} className="h-52 animate-pulse rounded-xl border border-border bg-surface/70 p-4">
                            <div className="h-5 w-24 rounded bg-primary/10" />
                            <div className="mt-4 h-5 w-2/3 rounded bg-primary/10" />
                            <div className="mt-3 h-3 w-full rounded bg-primary/5" />
                            <div className="mt-2 h-3 w-4/5 rounded bg-primary/5" />
                        </div>
                    ))}
                </div>
            )}

            {error && !loading && (
                <div className="mt-5 flex flex-col gap-3 rounded-xl border border-error-text/30 bg-error-bg p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-error-text">{error}</p>
                    <button
                        type="button"
                        onClick={handleAnalyze}
                        className="min-h-10 rounded-lg border border-error-text/30 px-4 py-2 text-xs font-bold text-error-text transition-colors hover:bg-error-text/10"
                    >
                        Try analysis again
                    </button>
                </div>
            )}

            {hasAnalyzed && !loading && !error && suggestions.length === 0 && (
                <p className="mt-5 rounded-xl border border-border bg-surface p-4 text-sm text-text-secondary">
                    AI did not find a recurring pattern strong enough to suggest a rule.
                </p>
            )}


            {hasAnalyzed && !loading && !error && suggestions.length > 0 && (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {suggestions.map((rule, index) => {
                    const isActive = activeRuleIds.includes(rule.id);
                    const isExpanded = expandedRuleId === rule.id;
                    const matches = envelopes.filter((envelope) => rule.matchingIds.includes(envelope.id));
                    const accent = index % 2 === 1 ? "amber" : "blue";
                    const accentClasses = accent === "amber"
                        ? "border-amber-500/30 bg-amber-500/8 text-amber-900 dark:text-amber-500"
                        : "border-blue-500/30 bg-blue-500/8 text-blue-700 dark:text-blue-500";

                    return (
                        <article key={rule.id} className="rounded-xl border border-border/40 bg-background/70 p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${accentClasses}`}>
                                        {matches.length} messages matched
                                    </span>
                                    <h3 className="mt-3 text-base font-bold text-text-primary">{rule.title}</h3>
                                    <p className="mt-1 text-sm leading-relaxed text-text-secondary">{rule.description}</p>
                                </div>
                                <div className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full ${accent === "amber" ? "bg-amber-500" : "bg-blue-500"}`} />
                            </div>

                            <div className="mt-4 rounded-lg border border-border/30 bg-background/10 p-3 text-xs">
                                <div className="font-mono font-semibold text-text-primary decoration-dotted underline underline-offset-4">When</div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    {rule.conditions.map((condition, conditionIndex) => (
                                        <span key={condition} className="contents">
                                            {conditionIndex > 0 && (
                                                <span className="font-mono font-semibold text-text-muted decoration-dotted underline underline-offset-4">and</span>
                                            )}
                                            <span className="font-mono rounded-md border border-border bg-surface px-2 py-1">{condition}</span>
                                        </span>
                                    ))}
                                </div>
                                <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
                                    <span className="font-mono font-semibold text-text-primary decoration-dotted underline underline-offset-4">Then</span>
                                    <span className="font-mono">
                                        place matching messages in&nbsp;<strong className="font-mono decoration-dotted underline underline-offset-4 text-text-primary">{rule.destination}</strong>.
                                    </span>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
                                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">Preview</div>
                                    <ul className="space-y-2">
                                        {matches.map((envelope) => (
                                            <li key={envelope.id} className="flex items-start gap-2 text-xs text-text-secondary">
                                                <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${accent === "amber" ? "bg-amber-500" : "bg-blue-500"}`} />
                                                <span>{envelope.notif?.notification?.data?.subject ?? "Untitled notification"}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setExpandedRuleId(isExpanded ? null : rule.id)}
                                    className="min-h-10 rounded-lg bg-btn-reset px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-btn-reset-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                    aria-expanded={isExpanded}
                                >
                                    {isExpanded ? "Hide preview" : "Show preview"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onToggleRule(rule.id)}
                                    disabled={savingRuleId !== null}
                                    aria-busy={savingRuleId === rule.id}
                                    className={`min-h-10 rounded-lg px-4 py-2 text-xs font-bold transition-colors disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${isActive
                                        ? "border border-success-text/30 bg-success-bg text-success-text"
                                        : "shine-button bg-primary text-white hover:opacity-90"
                                        }`}
                                >
                                    {savingRuleId === rule.id ? "Saving..." : isActive ? "Rule applied" : "Apply rule"}
                                </button>
                                {isActive && <span className="text-xs text-text-muted">Select again to undo</span>}
                            </div>
                        </article>
                    );
                })}
            </div>
            )}
            </div>
            {onCollapse && (
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={onCollapse}
                        className="-mt-px flex h-[34px] items-center justify-center gap-2 rounded-b-xl border border-t-0 border-border bg-surface px-6 text-xs font-bold text-text-secondary shadow-sm transition-colors hover:bg-hover hover:text-text-primary"
                        aria-label="Collapse suggestions"
                    >
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m18 15-6-6-6 6" />
                        </svg>
                        Collapse
                    </button>
                </div>
            )}
        </section>
    );
}
