"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { trackedFetch as fetch } from "@/lib/api-tracker";
import StatusAlert from "./StatusAlert";

interface Source {
    source: string;
    text: string;
}

// Themed markdown for assistant replies. Children-only (no prop spreading) so
// react-markdown's internal `node` prop never leaks onto DOM elements.
const markdownComponents: Components = {
    h1: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1.5 first:mt-0">{children}</h2>,
    h2: ({ children }) => <h3 className="text-sm font-bold mt-3 mb-1.5 first:mt-0">{children}</h3>,
    h3: ({ children }) => <h4 className="text-[13px] font-bold mt-2.5 mb-1 first:mt-0">{children}</h4>,
    h4: ({ children }) => <h5 className="text-[13px] font-semibold mt-2 mb-1 first:mt-0">{children}</h5>,
    p: ({ children }) => <p className="leading-relaxed mb-2 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    a: ({ children, href }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline underline-offset-2 hover:opacity-80">
            {children}
        </a>
    ),
    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    code: ({ children }) => <code className="px-1 py-0.5 rounded bg-[var(--color-text-primary)]/10 font-mono text-[0.85em]">{children}</code>,
    pre: ({ children }) => (
        <pre className="bg-[var(--color-text-primary)]/5 border border-[var(--color-border)] rounded-lg p-3 overflow-x-auto text-xs font-mono mb-2 [&_code]:bg-transparent [&_code]:p-0">
            {children}
        </pre>
    ),
    blockquote: ({ children }) => <blockquote className="border-l-2 border-[var(--color-primary)]/40 pl-3 italic opacity-80 mb-2">{children}</blockquote>,
    hr: () => <hr className="my-3 border-[var(--color-border)]" />,
    table: ({ children }) => (
        <div className="overflow-x-auto mb-2">
            <table className="w-full text-xs border-collapse">{children}</table>
        </div>
    ),
    th: ({ children }) => <th className="border border-[var(--color-border)] px-2 py-1 font-bold text-left">{children}</th>,
    td: ({ children }) => <td className="border border-[var(--color-border)] px-2 py-1">{children}</td>,
};

// Collapsible reasoning trace. Expanded (with a pulsing label) while the model is
// still thinking, then auto-collapses once the actual answer starts streaming.
function ThinkingBlock({ thinking, isActive }: { thinking: string; isActive: boolean }) {
    const [expanded, setExpanded] = useState(true);
    const traceRef = useRef<HTMLDivElement>(null);
    const traceStickRef = useRef(true);
    useEffect(() => {
        if (!isActive) setExpanded(false);
    }, [isActive]);
    // The trace pane is height-capped, so without this the newest reasoning
    // streams in below the fold and the trace looks frozen. Follow the bottom
    // while streaming, unless the user scrolled up to read.
    useEffect(() => {
        const el = traceRef.current;
        if (el && traceStickRef.current) el.scrollTop = el.scrollHeight;
    }, [thinking, expanded]);
    return (
        <div className="mb-2">
            <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 text-[10px] font-medium tracking-wider uppercase text-[var(--color-text-secondary)] opacity-70 hover:opacity-100 transition-opacity"
            >
                <span className={isActive ? "animate-pulse" : ""}>{isActive ? "Thinking…" : "Thought process"}</span>
                <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                    className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                >
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </button>
            {expanded && (
                <div
                    ref={traceRef}
                    onScroll={() => {
                        const el = traceRef.current;
                        if (el) traceStickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                    }}
                    className="mt-1.5 text-[10px] text-[var(--color-text-secondary)] opacity-80 border-l-2 border-[var(--color-primary)]/40 pl-2 whitespace-pre-wrap leading-snug max-h-44 overflow-y-auto"
                >
                    {thinking}
                </div>
            )}
        </div>
    );
}

// Must match the breakpoint in client-layout-wrapper.tsx: the wrapper reserves
// space for whichever form this panel takes, and a mismatch left a dead zone
// (roughly tablet widths) padded for a bottom sheet while showing a side panel.
function useIsMobile(breakpoint = 1024) {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
        setIsMobile(mql.matches);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    }, [breakpoint]);
    return isMobile;
}

export default function AiHelpButton({
    isOpen,
    setIsOpen,
    panelWidth,
    setPanelWidth,
    panelHeight,
    setPanelHeight,
    isResizingState,
    setIsResizing
}: {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    panelWidth: number;
    setPanelWidth: (width: number) => void;
    panelHeight: number;
    setPanelHeight: (height: number) => void;
    isResizingState: boolean;
    setIsResizing: (resizing: boolean) => void;
}) {
    const { data: session } = useSession();
    const isGuest = !!(session?.user && (session.user as any).isGuest);
    const allowGuestAi = process.env.NEXT_PUBLIC_ALLOW_GUEST_AI === "true";
    const isBlocked = isGuest && !allowGuestAi;

    interface Message {
        role: "user" | "assistant";
        content: string;
        thinking?: string;   // for reasoning/thinking tokens from extended OpenAI-compatible endpoints
        sources?: Source[];
    }
    const [query, setQuery] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState("");
    const panelRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const stickToBottomRef = useRef(true);
    const abortRef = useRef<AbortController | null>(null);
    const assistantMessageIndexRef = useRef<number | null>(null);
    const isMobile = useIsMobile();

    // Follow the stream like a modern chat: stick to the bottom while tokens
    // arrive, but stop following as soon as the user scrolls up to read.
    const handleMessagesScroll = () => {
        const el = scrollContainerRef.current;
        if (!el) return;
        stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    useEffect(() => {
        if (stickToBottomRef.current) {
            const el = scrollContainerRef.current;
            el?.scrollTo({ top: el.scrollHeight });
        }
    }, [messages]);

    // Abort any in-flight generation when the panel unmounts
    useEffect(() => () => abortRef.current?.abort(), []);

    // Resizing State
    const isResizing = useRef(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            e.preventDefault();
            if (isMobile) {
                // Bottom sheet: drag to resize height
                const newHeight = window.innerHeight - e.clientY;
                if (newHeight >= 200 && newHeight <= window.innerHeight * 0.85) {
                    setPanelHeight(newHeight);
                }
            } else {
                // Side panel: drag to resize width
                const newWidth = window.innerWidth - e.clientX;
                if (newWidth >= 300 && newWidth <= 800) {
                    setPanelWidth(newWidth);
                }
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isResizing.current) return;
            const touch = e.touches[0];
            if (isMobile) {
                const newHeight = window.innerHeight - touch.clientY;
                if (newHeight >= 200 && newHeight <= window.innerHeight * 0.85) {
                    setPanelHeight(newHeight);
                }
            }
        };

        const handleEnd = () => {
            if (isResizing.current) {
                isResizing.current = false;
                setIsResizing(false);
                document.body.style.cursor = "default";
                document.body.style.userSelect = "auto";
            }
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleEnd);
        document.addEventListener("touchmove", handleTouchMove, { passive: false });
        document.addEventListener("touchend", handleEnd);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleEnd);
            document.removeEventListener("touchmove", handleTouchMove);
            document.removeEventListener("touchend", handleEnd);
        };
    }, [isMobile]);

    const handleAsk = async (e: React.FormEvent) => {
        e.preventDefault();
        const currentQuery = query.trim();
        if (!currentQuery || loading || isStreaming) return;

        // Add user query to UI immediately
        setMessages(prev => [...prev, { role: "user", content: currentQuery }]);
        setQuery("");
        setLoading(true);
        setError("");
        stickToBottomRef.current = true;
        assistantMessageIndexRef.current = null;
        const controller = new AbortController();
        abortRef.current = controller;

        // Rolling history (for backend context only)
        const historyText = messages
            .slice(-4)
            .map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
            .join("\n");

        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const aiUrl = process.env.NEXT_PUBLIC_AI_URI;
        let url = `${apiUrl}/${aiUrl}?q=${encodeURIComponent(currentQuery)}`;
        if (historyText) {
            url += `&history=${encodeURIComponent(historyText)}`;
        }

        // Request streaming when the backend supports it
        const streamUrl = url + (url.includes("?") ? "&" : "?") + "stream=1";

        try {
            const res = await fetch(streamUrl, { signal: controller.signal });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "AI service failed");
            }

            const contentType = res.headers.get("content-type") || "";
            console.log("[AI Chat] Response content-type:", contentType, "body?", !!res.body);

            if (contentType.includes("text/event-stream") && res.body) {
                console.log("[AI Chat] Using streaming path");
                // Pre-create exactly one assistant bubble as soon as we know this is streaming.
                // This makes the chat bubble visible early (before first token arrives), then we update it in place.
                // The pre-create + index ref ensures only ONE bubble for the entire response.
                setMessages(prev => {
                    const newMsg: Message = {
                        role: 'assistant',
                        content: '',
                        thinking: '',
                        sources: []
                    };
                    const newList = [...prev, newMsg];
                    assistantMessageIndexRef.current = newList.length - 1;
                    return newList;
                });
                setLoading(false);
                setIsStreaming(true);
                const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();

                // SSE events can be split across (or coalesced within) network
                // chunks, so buffer and only parse complete "\n\n"-terminated
                // events; the incomplete tail carries over to the next read.
                let sseBuffer = "";

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    if (!value) continue;

                    sseBuffer += value;
                    const events = sseBuffer.split(/\n\n/);
                    sseBuffer = events.pop() ?? "";
                    for (const evt of events) {
                        const line = evt.trim();
                        if (!line.startsWith("data:")) continue;
                        const jsonStr = line.slice(5).trim();
                        if (!jsonStr) continue;

                        try {
                            const payload = JSON.parse(jsonStr);

                            if (payload.thinking || payload.token) {
                                setLoading(false);

                                setMessages(prev => {
                                    let idx = assistantMessageIndexRef.current;
                                    if (idx === null || !prev[idx] || prev[idx].role !== 'assistant') {
                                        // Create exactly one new assistant bubble for this response
                                        console.log("[AI Chat] creating new assistant message bubble (once per response)");
                                        const newMsg: Message = {
                                            role: 'assistant',
                                            content: payload.token || '',
                                            thinking: payload.thinking || '',
                                            sources: []
                                        };
                                        const newList = [...prev, newMsg];
                                        assistantMessageIndexRef.current = newList.length - 1;
                                        return newList;
                                    } else {
                                        // Update the existing one (append to thinking/content)
                                        console.log("[AI Chat] updating existing assistant message");
                                        const updated = { ...prev[idx] };
                                        if (payload.thinking) {
                                            updated.thinking = (updated.thinking || '') + payload.thinking;
                                        }
                                        if (payload.token) {
                                            updated.content = updated.content + payload.token;
                                        }
                                        const newList = [...prev];
                                        newList[idx] = updated;
                                        return newList;
                                    }
                                });
                            }

                            if (payload.done) {
                                console.log("[AI Chat] stream done, sources:", payload.sources?.length || 0);
                                setMessages(prev => {
                                    const idx = assistantMessageIndexRef.current;
                                    if (idx !== null && prev[idx] && prev[idx].role === 'assistant') {
                                        const updated = { ...prev[idx] };
                                        if (payload.sources && payload.sources.length > 0) {
                                            updated.sources = payload.sources;
                                        }
                                        const newList = [...prev];
                                        newList[idx] = updated;
                                        return newList;
                                    }
                                    return prev;
                                });
                            }

                            if (payload.error) {
                                setError(payload.error);
                            }
                        } catch {
                            // ignore partial / non-JSON lines
                        }
                    }
                }
            } else {
                // --- Fallback: old non-streaming JSON response ---
                console.log("[AI Chat] Falling back to non-streaming JSON (no text/event-stream)");
                const data = await res.json();
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: data.answer || data.content || "",
                    thinking: data.thinking || "",
                    sources: data.sources || []
                }]);
            }
        } catch (err: any) {
            if (err?.name !== "AbortError") {
                setError(err.message || "Failed to reach the AI assistant.");
            }
        } finally {
            setLoading(false);
            setIsStreaming(false);
            abortRef.current = null;
        }
    };

    // Dynamic style and classes based on mobile vs desktop
    const panelStyle = isMobile
        ? {
            height: `${panelHeight}px`,
            transform: isOpen ? 'translateY(0)' : `translateY(${panelHeight}px)`,
        }
        : {
            width: `${panelWidth}px`,
            transform: isOpen ? 'translateX(0)' : `translateX(${panelWidth}px)`,
        };

    const panelClassName = isMobile
        ? `fixed bottom-0 left-0 right-0 bg-[var(--color-surface)]/95 backdrop-blur-3xl border-t border-[var(--color-border)] shadow-[0_-20px_50px_-15px_rgba(0,0,0,0.5)] flex flex-col z-[var(--z-panel)] rounded-t-2xl ${isResizingState ? '' : 'transition-[transform,opacity] duration-300 ease-in-out'} ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`
        : `fixed top-0 right-0 h-screen bg-[var(--color-surface)]/90 backdrop-blur-3xl border-l border-[var(--color-border)] shadow-[-40px_0_60px_-15px_rgba(0,0,0,0.2)] flex flex-col z-[var(--z-panel)] ${isResizingState ? '' : 'transition-[transform,opacity] duration-300 ease-in-out'} ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;

    const startResize = () => {
        isResizing.current = true;
        setIsResizing(true);
        document.body.style.cursor = isMobile ? "row-resize" : "col-resize";
        document.body.style.userSelect = "none";
    };

    return (
        <>
            {/* AI Search Panel */}
            <aside
                ref={panelRef}
                style={panelStyle}
                className={panelClassName}
            >
                {/* Resizer Handle */}
                {isMobile ? (
                    <div
                        className="absolute top-0 left-0 right-0 h-3 -mt-1.5 cursor-row-resize hover:bg-[var(--color-primary)]/50 z-50 transition-colors flex items-center justify-center"
                        onMouseDown={startResize}
                        onTouchStart={startResize}
                    >
                        <div className="w-10 h-1 rounded-full bg-[var(--color-border)] mt-1.5" />
                    </div>
                ) : (
                    <div
                        className="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 cursor-col-resize hover:bg-[var(--color-primary)]/50 z-50 transition-colors"
                        onMouseDown={startResize}
                    />
                )}

                {/* Header */}
                <div className={`p-4 sm:p-6 border-b border-[var(--color-border)]/50 bg-[var(--color-primary)]/5 flex items-center justify-between ${isMobile ? 'pt-5' : ''}`}>
                    <div>
                        <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-widest">AI Documentation Assistant</h3>
                        <p className="text-[10px] text-[var(--color-text-secondary)] opacity-60">Powered by Sealift Self-Hosted AI</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {messages.length > 0 && (
                            <button
                                onClick={() => { setMessages([]); setError(""); assistantMessageIndexRef.current = null; }}
                                title="New Conversation"
                                className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-text-primary)]/10 transition-all"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                </svg>
                            </button>
                        )}
                        <button onClick={() => setIsOpen(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div ref={scrollContainerRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-hide">
                    {messages.length === 0 && !loading && !error && (
                        <div className="text-center py-10 space-y-4">
                            <div className="w-16 h-16 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center mx-auto text-[var(--color-primary)]">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                            </div>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                                {isBlocked
                                    ? "AI Assistant is reserved for registered users. Please sign in to ask questions."
                                    : "Ask me anything about Sealift, eBay stores, or troubleshooting."}
                            </p>
                            {isBlocked && (
                                <button
                                    onClick={() => window.location.href = "/register"}
                                    className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
                                >
                                    Sign In / Register
                                </button>
                            )}
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`p-4 rounded-2xl max-w-[85%] text-sm ${msg.role === 'user'
                                ? 'bg-[var(--color-primary)] text-white rounded-br-none shadow-sm'
                                : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-tl-none shadow-sm'
                                }`}>
                                {msg.thinking && (
                                    <ThinkingBlock
                                        thinking={msg.thinking}
                                        isActive={i === messages.length - 1 && !msg.content}
                                    />
                                )}
                                {msg.content ? (
                                    msg.role === 'assistant' ? (
                                        <div className="leading-relaxed">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    )
                                ) : !msg.thinking ? (
                                    <p className="whitespace-pre-wrap leading-relaxed opacity-60">...</p>
                                ) : null}
                            </div>

                            {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-3 p-4 bg-[var(--color-primary)]/5 border border-[var(--color-border)] rounded-2xl rounded-tl-none w-full max-w-[85%] space-y-3">
                                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-primary)]/80">Verified Documentation</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {msg.sources.map((s, idx) => (
                                            <div key={idx} className="px-3 py-1.5 bg-black/20 border border-[var(--color-border)] rounded-full text-[10px] text-[var(--color-text-secondary)] font-medium">
                                                {s.source}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {error && (
                        <StatusAlert
                            className="text-center text-xs font-semibold italic"
                            emphasis="subtle"
                            message={error}
                            variant="error"
                        />
                    )}

                    {loading && (
                        <div className="space-y-4 animate-pulse w-[85%]">
                            <div className="h-4 bg-[var(--color-primary)]/10 rounded w-3/4"></div>
                            <div className="h-4 bg-[var(--color-primary)]/10 rounded w-full"></div>
                            <div className="h-4 bg-[var(--color-primary)]/10 rounded w-5/6"></div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleAsk} className="p-4 sm:p-6 pt-0 mt-auto">
                    <div className="relative group">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={isBlocked ? "Sign in to use AI assistant..." : "Type your question..."}
                            disabled={isBlocked}
                            className={`w-full bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-2xl px-5 py-4 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-all pr-12 ${isBlocked ? 'cursor-not-allowed opacity-50' : ''}`}
                        />
                        {isStreaming ? (
                            <button
                                type="button"
                                onClick={() => abortRef.current?.abort()}
                                title="Stop generating"
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-hover)] transition-all"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={loading || !query.trim() || isBlocked}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-hover)] disabled:opacity-30 disabled:hover:bg-[var(--color-primary)] transition-all"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m12 19 7-7-7-7M5 12h14" /></svg>
                            </button>
                        )}
                    </div>
                </form>
            </aside>

            {/* Sliding Toggle Tab */}
            {isMobile ? (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    title="AI Documentation Assistant"
                    className={`fixed bottom-4 right-4 z-[var(--z-launcher)] w-14 h-14 bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl flex items-center justify-center transition-all duration-300 hover:bg-[var(--color-primary)] hover:text-white rounded-full ${isOpen ? "scale-0 opacity-0 pointer-events-none" : "scale-100 text-[var(--color-primary)]"
                        }`}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M9 10h.01M12 10h.01M15 10h.01" /></svg>
                </button>
            ) : (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    title="AI Documentation Assistant"
                    className={`fixed top-[10rem] right-0 z-[var(--z-launcher)] w-12 h-14 bg-[var(--color-surface)] border-y border-l border-[var(--color-border)] shadow-xl flex items-center justify-center transition-all duration-300 hover:bg-[var(--color-primary)] hover:text-white rounded-l-xl opacity-90 hover:opacity-90 ${isOpen ? "translate-x-full opacity-0 pointer-events-none" : "translate-x-0 text-[var(--color-primary)]"
                        }`}
                >
                    <div className="flex flex-col items-center justify-center gap-0.5">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M9 10h.01M12 10h.01M15 10h.01" /></svg>
                        <span className="text-[9px] font-bold">AI</span>
                    </div>
                </button>
            )}
        </>
    );
}
