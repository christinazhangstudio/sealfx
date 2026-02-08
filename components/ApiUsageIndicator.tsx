"use client";

import React, { useState, useEffect } from "react";
import { getApiUsageStats, ApiUsage } from "../lib/api-tracker";

export default function ApiUsageIndicator() {
    const [usage, setUsage] = useState<ApiUsage | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Initial fetch
        setUsage(getApiUsageStats());

        // Listen for updates from the tracker
        const handleUpdate = (event: Event) => {
            const customEvent = event as CustomEvent<ApiUsage>;
            setUsage(customEvent.detail);
        };

        window.addEventListener("api-usage-update", handleUpdate);
        return () => window.removeEventListener("api-usage-update", handleUpdate);
    }, []);

    if (!usage) return null;

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-3 py-1 rounded-full bg-surface border border-border hover:border-primary transition-colors text-xs font-medium text-text-secondary"
                title="View API Usage"
            >
                <div className={`w-2 h-2 rounded-full ${usage.total > 1000 ? 'bg-error-border' : 'bg-success-border'}`}></div>
                <span>API Calls: {usage.total}</span>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-surface border border-border rounded-lg shadow-xl z-[100] p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <h3 className="text-xs font-bold text-primary mb-2 uppercase tracking-wider font-heading">Daily Usage</h3>
                    <div className="space-y-2">
                        {Object.entries(usage.endpoints).map(([category, count]) => (
                            <div key={category} className="flex justify-between items-center text-[10px]">
                                <span className="text-text-secondary">{category}</span>
                                <span className="font-mono font-bold text-primary">{count}</span>
                            </div>
                        ))}
                        {Object.keys(usage.endpoints).length === 0 && (
                            <p className="text-[10px] text-text-secondary italic text-center">No calls recorded yet.</p>
                        )}
                    </div>
                    <div className="mt-3 pt-2 border-t border-border flex justify-between items-center text-[9px] text-text-secondary">
                        <span>Resets daily</span>
                        {/* <button
                            onClick={() => {
                                localStorage.removeItem("sealfx_api_usage");
                                window.location.reload();
                            }}
                            className="hover:text-primary underline"
                        >
                            Reset
                        </button> */}
                    </div>
                </div>
            )}
        </div>
    );
}
