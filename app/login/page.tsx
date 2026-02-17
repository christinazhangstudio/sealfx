"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [username, setUsername] = useState("sealift");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const result = await signIn("credentials", {
                username,
                password,
                rememberMe: rememberMe.toString(),
                redirect: false,
            });

            if (result?.error) {
                setError("Invalid credentials. Please try again.");
            } else {
                router.push("/");
                router.refresh();
            }
        } catch (err) {
            setError("An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center py-20 px-4">
            <div className="w-full max-w-sm bg-[var(--color-surface)]/30 backdrop-blur-xl rounded-[1.5rem] p-8 shadow-sm border border-[var(--color-border)] relative z-10 hover:border-[var(--color-primary)]/30 transition-all duration-500 group">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-[var(--color-primary)] tracking-tight mb-1">
                        sign in
                    </h1>
                    <p className="text-[var(--color-text-secondary)] text-[10px] font-bold uppercase tracking-[0.2em]">
                        Sealift Admin
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-xl text-[var(--color-error-text)] text-xs font-semibold text-center">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1">
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-secondary)]/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-all duration-300 text-sm"
                            placeholder="Username"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-secondary)]/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-all duration-300 text-sm"
                            placeholder="Password"
                            required
                        />
                    </div>

                    <div className="flex items-center px-1">
                        <label className="flex items-center space-x-3 cursor-pointer group/check">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="w-5 h-5 border border-[var(--color-border)] rounded-md transition-all duration-200 peer-checked:bg-[var(--color-primary)] peer-checked:border-[var(--color-primary)] group-hover/check:border-[var(--color-primary)]/50 flex items-center justify-center">
                                    <svg
                                        className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </div>
                            <span className="text-[11px] text-[var(--color-text-secondary)] group-hover/check:text-[var(--color-primary)] transition-colors font-bold uppercase tracking-wider">
                                Remember Device
                            </span>
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] text-white rounded-xl py-4 font-bold shadow-sm transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 mt-4 text-sm uppercase tracking-widest"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <span>authorize</span>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
