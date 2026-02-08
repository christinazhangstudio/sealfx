"use client";

import { useState, useEffect } from "react";

export default function ThemeSwitcher() {
    const [theme, setTheme] = useState("default");

    useEffect(() => {
        // Check for saved preference or system preference if we were persisting
        // For now, default to 'default'
        const storedTheme = document.body.getAttribute("data-theme");
        if (storedTheme) {
            setTheme(storedTheme);
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === "default" ? "ebay" : "default";
        setTheme(newTheme);
        if (newTheme === "default") {
            document.body.removeAttribute("data-theme");
        } else {
            document.body.setAttribute("data-theme", newTheme);
        }
    };

    return (
        <button
            onClick={toggleTheme}
            className="px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-300 ml-2 md:ml-4
        border-primary text-primary hover:bg-primary hover:text-white"
            title={theme === "default" ? "Switch to eBay Theme" : "Switch to Default Theme"}
        >
            {theme === "default" ? "Sealift" : "eBay"}
        </button>
    );
}
