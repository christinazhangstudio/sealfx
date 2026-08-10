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
    hasAnalyzed: boolean;
    activeRuleIds: string[];
    onToggleRule: (ruleId: string) => void;
    onAnalyze: () => void;
};

export default function InboxRuleSuggestions({
    envelopes,
    suggestions,
    model,
    loading,
    error,
    hasAnalyzed,
    activeRuleIds,
    onToggleRule,
    onAnalyze,
}: Props) {
    const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

    return (
        <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 via-surface to-surface p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-2xl">
                    <div className="mb-2 flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white shadow-sm" aria-hidden="true">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="m12 3-1.8 5.2L5 10l5.2 1.8L12 17l1.8-5.2L19 10l-5.2-1.8L12 3Z" />
                                <path d="m5 16-.7 2.3L2 19l2.3.7L5 22l.7-2.3L8 19l-2.3-.7L5 16Z" />
                            </svg>
                        </span>
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary">AI inbox analysis</span>
                    </div>
                    <h2 className="text-xl font-bold text-text-primary">
                        {loading
                            ? "Qwen is analyzing this inbox"
                            : hasAnalyzed
                                ? `${suggestions.length} rule suggestion${suggestions.length === 1 ? "" : "s"} from Qwen`
                                : "Have AI suggest inbox rules"}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                        Qwen will analyze recurring topics in these messages and propose rules for you to review. Nothing is applied automatically.
                    </p>
                </div>
                <span className="w-fit rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted">
                    {model ? `Analyzed by ${model}` : "On-demand Qwen analysis"}
                </span>
            </div>
            {!hasAnalyzed && !loading && (
                <div className="mt-5 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
                        Send the current inbox to Qwen to identify useful groups, labels, and priority rules.
                    </p>
                    <button
                        type="button"
                        onClick={onAnalyze}
                        className="min-h-11 whitespace-nowrap rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                        Have AI suggest rules
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
                        onClick={onAnalyze}
                        className="min-h-10 rounded-lg border border-error-text/30 px-4 py-2 text-xs font-bold text-error-text transition-colors hover:bg-error-text/10"
                    >
                        Try analysis again
                    </button>
                </div>
            )}

            {hasAnalyzed && !loading && !error && suggestions.length === 0 && (
                <p className="mt-5 rounded-xl border border-border bg-surface p-4 text-sm text-text-secondary">
                    Qwen did not find a recurring pattern strong enough to suggest a rule.
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
                        ? "border-amber-500/30 bg-amber-500/8 text-amber-700 dark:text-amber-300"
                        : "border-blue-500/30 bg-blue-500/8 text-blue-700 dark:text-blue-300";

                    return (
                        <article key={rule.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
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

                            <div className="mt-4 rounded-lg border border-border/80 bg-background/60 p-3 text-xs text-text-secondary">
                                <div className="font-semibold text-text-primary">When</div>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {rule.conditions.map((condition) => (
                                        <span key={condition} className="rounded-md border border-border bg-surface px-2 py-1">{condition}</span>
                                    ))}
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="font-semibold text-text-primary">Then</span>
                                    <span aria-hidden="true">→</span>
                                    <span>Label as <strong className="text-text-primary">{rule.destination}</strong></span>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
                                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">Historical preview</div>
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
                                    className="min-h-10 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-hover hover:text-hover-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                    aria-expanded={isExpanded}
                                >
                                    {isExpanded ? "Hide preview" : "Preview matches"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onToggleRule(rule.id)}
                                    className={`min-h-10 rounded-lg px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${isActive
                                        ? "border border-success-text/30 bg-success-bg text-success-text"
                                        : "bg-primary text-white hover:opacity-90"
                                        }`}
                                >
                                    {isActive ? "Rule applied" : "Apply rule"}
                                </button>
                                {isActive && <span className="text-xs text-text-muted">Select again to undo</span>}
                            </div>
                        </article>
                    );
                })}
            </div>
            )}
        </section>
    );
}
