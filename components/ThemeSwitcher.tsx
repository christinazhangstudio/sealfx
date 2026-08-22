"use client";

import { useTheme } from "next-themes";
import { useState } from "react";
import Image from "next/image";

export default function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    const [isExpanded, setIsExpanded] = useState(false);

    // No mounted flag: every node below carries suppressHydrationWarning, so
    // rendering the real theme on the first client paint is safe.
    const currentTheme = theme ?? "light";

    return (
        <div
            className={`flex items-center bg-switcher-bg rounded-full p-1 transition-all duration-300 overflow-hidden relative ${isExpanded ? 'w-auto' : 'w-18'}`}
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
            // Touch devices have no hover: without this the control could never
            // be expanded, and taps landed on the transparent buttons behind it.
            onClick={() => setIsExpanded((v) => !v)}
            suppressHydrationWarning
        >
            {/* Collapsed State Text */}
            <div
                className={`absolute inset-0 flex items-center justify-center text-xs font-semibold text-switcher-text pointer-events-none transition-opacity duration-300 ${isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                suppressHydrationWarning
            >
                Theme
            </div>

            {/* Expanded Options */}
            <div className={`flex items-center transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <button
                    onClick={() => setTheme("light")}
                    className={`whitespace-nowrap px-2 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${currentTheme === "light" ? "bg-white text-primary shadow-sm" : "text-switcher-button-text hover:text-switcher-button-hover hover:scale-110"
                        }`}
                    suppressHydrationWarning
                >
                    💮
                </button>
                <button
                    onClick={() => setTheme("ebay")}
                    className={`flex items-center justify-center whitespace-nowrap px-2 py-1 rounded-full transition-all duration-300 ${currentTheme === "ebay" ? "bg-white shadow-sm" : "opacity-70 hover:opacity-100 hover:scale-110"
                        }`}
                    suppressHydrationWarning
                >
                    <Image src="/ebay-icon.png" width={16} height={16} alt="eBay Theme" className="object-contain" />
                </button>
                <button
                    onClick={() => setTheme("dark")}
                    className={`whitespace-nowrap px-2 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${currentTheme === "dark" ? "bg-slate-700 text-white shadow-sm" : "text-switcher-button-text hover:text-switcher-button-hover hover:scale-110"
                        }`}
                    suppressHydrationWarning
                >
                    🐈‍⬛
                </button>
            </div>
        </div>
    );
}
