"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
    const params = useSearchParams();
    const router = useRouter();
    const token = params.get("token") ?? "";

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }
        if (password !== confirm) {
            setError("The passwords don't match.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, newPassword: password }),
            });
            if (!res.ok) throw new Error((await res.text()) || "Couldn't reset your password.");
            setDone(true);
            setTimeout(() => router.push("/login"), 2500);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't reset your password.");
        } finally {
            setSubmitting(false);
        }
    };

    const field =
        "w-full bg-[var(--color-surface)]/50 border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-secondary)]/30 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] text-sm";

    if (!token) {
        return (
            <div className="space-y-4">
                <p className="text-sm text-[var(--color-text-primary)]">
                    This reset link is missing its token. Request a new one.
                </p>
                <Link href="/forgot-password" className="text-sm font-medium text-[var(--color-primary)] hover:opacity-80">
                    Request a new link
                </Link>
            </div>
        );
    }

    if (done) {
        return (
            <p className="text-sm text-[var(--color-text-primary)]">
                Password updated. Taking you to sign in…
            </p>
        );
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                required
                className={field}
            />
            <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                required
                className={field}
            />
            {error && <p className="text-xs font-medium text-[var(--color-error-text)]">{error}</p>}
            <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
                {submitting ? "Saving…" : "Set new password"}
            </button>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-[var(--color-surface)]/60 border border-[var(--color-border)] rounded-2xl p-8 space-y-6">
                <h1 className="page-title text-2xl font-bold text-[var(--color-text-primary)]">Choose a new password</h1>
                <Suspense fallback={<p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>}>
                    <ResetPasswordForm />
                </Suspense>
            </div>
        </div>
    );
}
