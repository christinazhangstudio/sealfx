"use client";

import { useState, useEffect } from "react";

import { usePathname } from "next/navigation";
import Image from "next/image";
import NavMenu from "./navmenu";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import AiHelpButton from "@/components/AiHelpButton";

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

export default function ClientLayoutWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isLoginPage = pathname?.startsWith("/login");
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [aiPanelWidth, setAiPanelWidth] = useState(450);
    const [aiPanelHeight, setAiPanelHeight] = useState(350);
    const [isAiResizing, setIsAiResizing] = useState(false);
    const isMobile = useIsMobile();

    const paddingStyle = isAiOpen && !isLoginPage
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
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center rounded-lg p-2 gap-4">
                                {/* Left column: Logo */}
                                <div className="flex items-center space-x-2 sm:space-x-4 justify-start">
                                    <Image
                                        src="/seal.png"
                                        alt="Sealift Logo"
                                        width={64}
                                        height={64}
                                        priority
                                        className="h-10 w-auto sm:h-16 object-contain"
                                    />
                                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-primary-hover drop-shadow-sm whitespace-nowrap font-heading">
                                        sealift
                                    </h1>
                                </div>

                                {/* Center/Right column: Tagline - centered on login, right-aligned otherwise */}
                                <p className={`text-base sm:text-xl md:text-2xl text-primary hidden @[600px]:block drop-shadow-sm font-heading truncate min-w-0 ${isLoginPage ? 'text-center' : 'col-span-2 text-right'}`}>
                                    See all of your marketplace!
                                </p>

                                {/* Right column: Theme Switcher (only on login page) */}
                                {isLoginPage && (
                                    <div className="flex items-center justify-end">
                                        <ThemeSwitcher />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {!isLoginPage && <NavMenu />}

                {/* Main content */}
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-0 w-full overflow-hidden">
                    {children}
                </main>

                {/* Global AI Assistant Overlay */}
                {!isLoginPage && (
                    <AiHelpButton isOpen={isAiOpen} setIsOpen={setIsAiOpen} panelWidth={aiPanelWidth} setPanelWidth={setAiPanelWidth} panelHeight={aiPanelHeight} setPanelHeight={setAiPanelHeight} isResizingState={isAiResizing} setIsResizing={setIsAiResizing} />
                )}
            </>
        </div>
    );
}
