"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { trackedFetch as fetch } from "@/lib/api-tracker";

interface Source {
    source: string;
    text: string;
}

function useIsMobile(breakpoint = 768) {
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
        sources?: Source[];
    }
    const [query, setQuery] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const panelRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();

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
        if (!currentQuery) return;

        // Add user query to UI immediately
        setMessages(prev => [...prev, { role: "user", content: currentQuery }]);
        setQuery("");
        setLoading(true);
        setError("");

        try {
            // Compile rolling history for LLM context only (NOT for vector search embedding)
            const historyText = messages
                .slice(-4) // Keep context tight (last 2 full QA rounds)
                .map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
                .join("\n");

            const apiUrl = process.env.NEXT_PUBLIC_API_URL;
            const aiUrl = process.env.NEXT_PUBLIC_AI_URI;
            let url = `${apiUrl}/${aiUrl}?q=${encodeURIComponent(currentQuery)}`;
            if (historyText) {
                url += `&history=${encodeURIComponent(historyText)}`;
            }
            const res = await fetch(url);

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "AI service failed");
            }

            const data = await res.json();
            setMessages(prev => [...prev, {
                role: "assistant",
                content: data.answer,
                sources: data.sources || []
            }]);
        } catch (err: any) {
            setError(err.message || "Failed to reach the AI assistant.");
        } finally {
            setLoading(false);
            // Auto scroll down after load
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
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
        ? `fixed bottom-0 left-0 right-0 bg-[var(--color-surface)]/95 backdrop-blur-3xl border-t border-[var(--color-border)] shadow-[0_-20px_50px_-15px_rgba(0,0,0,0.5)] flex flex-col z-[500] rounded-t-2xl ${isResizingState ? '' : 'transition-[transform,opacity] duration-300 ease-in-out'} ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`
        : `fixed top-0 right-0 h-screen bg-[var(--color-surface)]/90 backdrop-blur-3xl border-l border-[var(--color-border)] shadow-[-40px_0_60px_-15px_rgba(0,0,0,0.2)] flex flex-col z-[500] ${isResizingState ? '' : 'transition-[transform,opacity] duration-300 ease-in-out'} ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;

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
                                onClick={() => { setMessages([]); setError(""); }}
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
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-hide">
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
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
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
                        <div className="p-4 bg-[var(--color-error-bg)]/20 border border-[var(--color-error-border)]/50 rounded-2xl text-[var(--color-error-text)] text-xs font-semibold text-center italic">
                            {error}
                        </div>
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
                        <button
                            type="submit"
                            disabled={loading || !query.trim() || isBlocked}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-hover)] disabled:opacity-30 disabled:hover:bg-[var(--color-primary)] transition-all"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m12 19 7-7-7-7M5 12h14" /></svg>
                        </button>
                    </div>
                </form>
            </aside>

            {/* Sliding Toggle Tab */}
            {isMobile ? (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    title="AI Documentation Assistant"
                    className={`fixed bottom-4 right-4 z-[490] w-14 h-14 bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl flex items-center justify-center transition-all duration-300 hover:bg-[var(--color-primary)] hover:text-white rounded-full ${isOpen ? "scale-0 opacity-0 pointer-events-none" : "scale-100 text-[var(--color-primary)]"
                        }`}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M9 10h.01M12 10h.01M15 10h.01" /></svg>
                </button>
            ) : (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    title="AI Documentation Assistant"
                    className={`fixed top-[10rem] right-0 z-[490] w-12 h-14 bg-[var(--color-surface)] border-y border-l border-[var(--color-border)] shadow-xl flex items-center justify-center transition-all duration-300 hover:bg-[var(--color-primary)] hover:text-white rounded-l-xl opacity-90 hover:opacity-100 ${isOpen ? "translate-x-full opacity-0 pointer-events-none" : "translate-x-0 text-[var(--color-primary)]"
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
