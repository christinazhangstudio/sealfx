"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/request-password-reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            if (!res.ok) throw new Error("Something went wrong. Please try again.");
            setSent(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-[var(--color-surface)]/60 border border-[var(--color-border)] rounded-2xl p-8 space-y-6">
                <div>
                    <h1 className="page-title text-2xl font-bold text-[var(--color-text-primary)]">Reset your password</h1>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                        Enter your email address and we'll send you a link to choose a new password.
                    </p>
                </div>

                {sent ? (
                    <div className="space-y-4">
                        <p className="text-sm text-[var(--color-text-primary)]">
                            If an account exists for that address, a reset link is on its way. The link works once and
                            expires in an hour.
                        </p>
                        <Link href="/login" className="inline-block text-sm font-medium text-[var(--color-primary)] hover:opacity-80">
                            Back to sign in
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-4">
                        <input
                            type="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email Address"
                            required
                            className="w-full bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-secondary)]/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] text-sm"
                        />
                        {error && <p className="text-xs font-medium text-[var(--color-error-text)]">{error}</p>}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-3 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {submitting ? "Sending…" : "Send reset link"}
                        </button>
                        <Link href="/login" className="block text-center text-xs text-[var(--color-text-secondary)] hover:opacity-80">
                            Back to sign in
                        </Link>
                    </form>
                )}
            </div>
        </div>
    );
}
