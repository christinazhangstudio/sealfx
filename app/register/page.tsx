"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser } from "../actions/register";
import TutorialSlideshow from "../../components/TutorialSlideshow";

export default function RegisterPage() {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const [showHelp, setShowHelp] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const formData = new FormData(e.currentTarget);
            const result = await registerUser(formData);

            if (result.error) {
                setError(result.error);
            } else {
                // Registration successful! Redirect to login
                router.push("/login?registered=true");
            }
        } catch (err) {
            setError("An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center py-20 px-4 min-h-screen relative overflow-x-hidden">
            {/* Mobile Help Button */}
            <button
                onClick={() => setShowHelp(true)}
                className="lg:hidden fixed bottom-6 right-6 z-[100] w-12 h-12 bg-[var(--color-primary)] text-white rounded-full shadow-2xl flex items-center justify-center border border-white/20 active:scale-95 transition-transform"
                aria-label="How to use the app"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            </button>

            {/* Mobile Help Overlay/Drawer */}
            <div className={`lg:hidden fixed inset-0 z-[200] transition-all duration-500 ${showHelp ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowHelp(false)}
                />
                <div className={`absolute bottom-0 left-0 right-0 bg-[var(--color-background)] rounded-t-[2rem] border-t border-[var(--color-border)] p-4 max-h-[85vh] overflow-y-auto shadow-2xl transition-transform duration-500 transform ${showHelp ? "translate-y-0" : "translate-y-full"}`}>
                    <div className="flex justify-end mb-2">
                        <button
                            onClick={() => setShowHelp(false)}
                            className="p-2 text-[var(--color-text-secondary)] hover:text-white"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                    <div className="pb-12 h-full min-h-[500px]">
                        <TutorialSlideshow />
                    </div>
                </div>
            </div>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Left Side: Registration Form */}
                <div className="bg-[var(--color-surface)]/30 backdrop-blur-xl rounded-[1.5rem] p-8 shadow-sm border border-[var(--color-border)] relative z-10 hover:border-[var(--color-primary)]/30 transition-all duration-500 group group/form">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-[var(--color-primary)] tracking-tight mb-1">
                            create an account
                        </h1>
                        <p className="text-[var(--color-text-secondary)] text-[10px] font-bold uppercase tracking-[0.2em] mt-2">
                            Sealift Multi-Store Integration
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4 text-sm font-medium">
                        {error && (
                            <div className="p-3 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-xl text-[var(--color-error-text)] text-xs font-semibold text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-[11px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider mb-2 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-text-hover)] bg-clip-text text-transparent">User Credentials</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <input
                                        type="email"
                                        name="email"
                                        className="w-full bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-secondary)]/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-all duration-300"
                                        placeholder="Email Address"
                                        required
                                    />
                                    <input
                                        type="password"
                                        name="password"
                                        className="w-full bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-secondary)]/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-all duration-300"
                                        placeholder="Password"
                                        required
                                        minLength={8}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider mb-2 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-text-hover)] bg-clip-text text-transparent">eBay Developer API Keys</label>
                                <p className="text-xs text-[var(--color-text-secondary)] mb-3 leading-relaxed opacity-60">
                                    You must <a href="https://developer.ebay.com/" target="_blank" className="underline hover:text-[var(--color-primary)] font-bold">create a free eBay Developer account</a> to generate these keys. Your keys are encrypted.
                                </p>

                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        name="appId"
                                        className="w-full bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-secondary)]/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-all duration-300 font-mono text-xs"
                                        placeholder="App ID (Client ID)"
                                        required
                                    />

                                    <input
                                        type="text"
                                        name="devId"
                                        className="w-full bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-secondary)]/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-all duration-300 font-mono text-xs"
                                        placeholder="Dev ID"
                                        required
                                    />

                                    <input
                                        type="password"
                                        name="certId"
                                        className="w-full bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-secondary)]/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-all duration-300 font-mono text-xs"
                                        placeholder="Cert ID (Client Secret)"
                                        required
                                    />

                                    <input
                                        type="text"
                                        name="redirectUri"
                                        className="w-full bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl px-4 py-3  text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-secondary)]/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] transition-all duration-300 font-mono text-xs"
                                        placeholder="RuName (Redirect URI)"
                                        required
                                    />

                                    <div className="flex items-center space-x-3 p-3 bg-[var(--color-surface)]/30 border border-[var(--color-border)] rounded-xl transition-all duration-300 hover:border-[var(--color-primary)]/30 group/sandbox">
                                        <input
                                            type="checkbox"
                                            name="isSandbox"
                                            id="isSandbox"
                                            className="w-5 h-5 border border-[var(--color-border)] rounded-md transition-all duration-200 peer-checked:bg-[var(--color-primary)] peer-checked:border-[var(--color-primary)] group-hover/check:border-[var(--color-primary)]/50 flex items-center justify-center"
                                        />
                                        <label htmlFor="isSandbox" className="text-xs text-[var(--color-text-secondary)] font-bold uppercase tracking-wider cursor-pointer group-hover/sandbox:text-[var(--color-text-primary)] transition-colors">
                                            This is a Sandbox account
                                        </label>
                                    </div>
                                    <p className="text-xs">
                                        Your eBay Application Keysets will correspond to either the Sandbox or Production environment.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] text-white rounded-xl py-4 font-bold shadow-sm transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 mt-4 uppercase tracking-widest text-xs"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <span>Create Account</span>
                            )}
                        </button>

                        <div className="text-center mt-6">
                            <Link href="/login" className="text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors font-bold uppercase tracking-wider">
                                already have an account? sign in
                            </Link>
                        </div>
                    </form>
                </div>

                {/* Right Side: Tutorial Slideshow (Hidden on mobile) */}
                <div className="hidden lg:block h-full min-h-[500px] border-l border-[var(--color-border)]/50 pl-12">
                    <TutorialSlideshow />
                </div>
            </div>
        </div>
    );


}
