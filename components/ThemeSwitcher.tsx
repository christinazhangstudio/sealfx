"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const currentTheme = mounted && theme ? theme : "light";

    return (
        <div
            className={`flex items-center bg-switcher-bg rounded-full p-1 ml-2 md:ml-4 border border-switcher-border transition-all duration-300 overflow-hidden relative ${isExpanded ? 'w-auto' : 'w-32'}`}
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
            suppressHydrationWarning
        >
            {/* Collapsed State Text */}
            <div
                className={`absolute inset-0 flex items-center justify-center text-xs font-semibold text-switcher-text pointer-events-none transition-opacity duration-300 ${isExpanded ? 'opacity-0' : 'opacity-100'}`}
                suppressHydrationWarning
            >
                Change Theme
            </div>

            {/* Expanded Options */}
            <div className={`flex items-center transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                <button
                    onClick={() => setTheme("light")}
                    className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${currentTheme === "light" ? "bg-white text-primary shadow-sm" : "text-switcher-button-text hover:text-switcher-button-hover"
                        }`}
                    suppressHydrationWarning
                >
                    Sealift
                </button>
                <button
                    onClick={() => setTheme("ebay")}
                    className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${currentTheme === "ebay" ? "bg-white text-[#0064D2] shadow-sm" : "text-switcher-button-text hover:text-switcher-button-hover"
                        }`}
                    suppressHydrationWarning
                >
                    eBay
                </button>
                <button
                    onClick={() => setTheme("dark")}
                    className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${currentTheme === "dark" ? "bg-slate-700 text-white shadow-sm" : "text-switcher-button-text hover:text-switcher-button-hover"
                        }`}
                    suppressHydrationWarning
                >
                    Dark
                </button>
            </div>
        </div>
    );
}
