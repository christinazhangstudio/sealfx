"use client";

import { useState, useEffect } from "react";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import NavMenu from "./navmenu";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import AiHelpButton from "@/components/AiHelpButton";
import { footerLinks, isFooterPath, rememberReturnPath } from "@/lib/footer-links";

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

export default function ClientLayoutWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isLoginPage = pathname?.startsWith("/login");
    const isRegisterPage = pathname?.startsWith("/register");
    const isFooterPage = isFooterPath(pathname);
    const usesMinimalLayout = isLoginPage || isRegisterPage || isFooterPage;
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [aiPanelWidth, setAiPanelWidth] = useState(450);
    const [aiPanelHeight, setAiPanelHeight] = useState(350);
    const [isAiResizing, setIsAiResizing] = useState(false);
    const isMobile = useIsMobile();

    useEffect(() => {
        if (usesMinimalLayout) setIsAiOpen(false);
    }, [usesMinimalLayout]);

    const paddingStyle = isAiOpen && !usesMinimalLayout
        ? isMobile
            ? { paddingBottom: `${aiPanelHeight}px` }
            : { paddingRight: `${aiPanelWidth}px` }
        : {};

    return (
        <div
            className={`flex flex-col min-h-screen relative w-full ${!isAiResizing ? 'transition-[padding] duration-300 ease-in-out' : ''}`}
            style={paddingStyle}
        >
            <>
                <div className="relative z-20 w-full">
                    <div className="border-b py-4 border-border/50 backdrop-blur-md bg-white/5">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 @container">
                            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 p-2">
                                {/* Left: Logo + Title */}
                                <div className="flex items-center space-x-2 sm:space-x-4">
                                    <Image
                                        src="/seal.png"
                                        alt="Sealift Logo"
                                        width={256}
                                        height={256}
                                        priority
                                        quality={100}
                                        className="h-10 w-auto sm:h-16 object-contain"
                                    />
                                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-primary-hover drop-shadow-sm font-heading">
                                        sealift
                                    </h1>
                                </div>

                                {/* Center: Empty space */}
                                <div></div>

                                {/* Minimal pages match the Sign In header. */}
                                <div className="flex items-center justify-end">
                                    {usesMinimalLayout ? (
                                        <ThemeSwitcher />
                                    ) : (
                                        <div className="hidden sm:block">
                                            <p className="text-base sm:text-lg md:text-xl text-primary drop-shadow-sm font-heading whitespace-nowrap">
                                                your marketplace manager
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {!usesMinimalLayout && <NavMenu isMobile={isMobile} />}

                {/* Main content */}
                <main className={`@container/main max-w-7xl px-4 sm:px-6 lg:px-8 py-8 border-0 w-full ${!isAiOpen || usesMinimalLayout ? 'mx-auto' : 'ml-0 lg:ml-8'}`}>
                    {children}
                </main>

                <footer className="mt-auto border-t border-[var(--color-border)]/10 bg-[var(--color-surface)]/10 backdrop-blur-sm">
                    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-3 text-center text-[10px] font-medium tracking-[0.2em] uppercase text-[var(--color-text-secondary)]/80 sm:px-6 lg:px-8">
                        {footerLinks.map(({ label, href }) => (
                            <Link
                                key={href}
                                href={href}
                                onClick={() => {
                                    if (!isFooterPage) {
                                        rememberReturnPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
                                    }
                                }}
                                className="rounded-sm underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/50"
                            >
                                {label}
                            </Link>
                        ))}
                    </div>
                </footer>

                {/* Global AI Assistant Overlay */}
                {!usesMinimalLayout && (
                    <AiHelpButton isOpen={isAiOpen} setIsOpen={setIsAiOpen} panelWidth={aiPanelWidth} setPanelWidth={setAiPanelWidth} panelHeight={aiPanelHeight} setPanelHeight={setAiPanelHeight} isResizingState={isAiResizing} setIsResizing={setIsAiResizing} />
                )}
            </>
        </div>
    );
}
