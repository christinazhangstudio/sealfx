"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import LoginCtaBanner from "@/components/LoginCtaBanner";
import { signOut } from "next-auth/react";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<{ status: string; sellers_removed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE") return;
    setIsDeleting(true);
    setError(null);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiBaseUrl) throw new Error("API base URL not configured");

      const res = await fetch(`${apiBaseUrl}/delete-account`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed with status ${res.status}`);
      }

      const data = await res.json();
      setResult(data);

      // Sign out after successful deletion (account no longer exists)
      setTimeout(() => {
        signOut({ callbackUrl: "/login" });
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  const isGuest = status === "unauthenticated" || !!(session?.user && (session.user as any).isGuest);

  if (!mounted || status === "loading") {
    return (
      <div className="min-h-screen flex justify-center items-center py-20 bg-[var(--background)]">
        <svg className="animate-spin h-10 w-10 text-[var(--color-primary)] opacity-50" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div>
      {isGuest ? (
        <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
          <div className="max-w-2xl mx-auto">
            <LoginCtaBanner
              title="Admin Dashboard"
              description="Sign in to access admin controls"
              cta="Sign In"
            />
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-8 text-center mt-8">
              <h2 className="text-2xl font-semibold text-primary mb-4">
                System Administration
              </h2>
              <p className="text-text-secondary">
                Manage system settings and administrative functions
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
        <h1 className="text-2xl sm:text-3xl lg:text-5xl text-primary mb-6 lg:mb-10 text-center lg:text-left drop-shadow-sm font-heading break-words">
          Admin
        </h1>

        <div className="max-w-2xl space-y-8">
          {/* Delete Account */}
          <div className="bg-surface rounded-lg border border-error-border shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-error-bg/30 border-b border-error-border">
              <h2 className="text-lg font-bold text-error-text uppercase tracking-wider font-heading flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Danger Zone
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-text-primary font-bold">Delete Sealift Account</h3>
                  <p className="text-text-secondary text-sm mt-1">
                    Permanently delete your account and all associated data. This removes all eBay seller registrations, notification subscriptions, destinations, inbox messages, and notes.
                  </p>
                  <br />
                  <p className="text-text-secondary text-sm mt-1">
                    Your eBay Developer account won't be deleted, so you can recreate a new Sealift account anytime.
                    (Your eBay accounts also won't be deleted.)
                  </p>
                </div>
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={isDeleting || !!result}
                  className="flex-shrink-0 px-6 py-2 bg-error-bg border border-error-border text-error-text rounded-md font-bold hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>

          {/* Success Message */}
          {result && (
            <div className="p-6 bg-success-bg border border-success-border rounded-lg text-success-text">
              <p className="font-bold text-lg">Account deleted successfully.</p>
              <p className="text-sm mt-1">{result.sellers_removed} seller(s) removed. Redirecting to login...</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-6 bg-error-bg border border-error-border rounded-lg text-error-text">
              <p className="font-bold">Failed to delete account</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => { setShowConfirm(false); setConfirmText(""); }}
            />
            <div className="relative bg-surface border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-error-bg flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-error-text" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-text-primary font-bold text-lg">Are you absolutely sure?</h3>
                  <p className="text-text-secondary text-sm">This action cannot be undone.</p>
                </div>
              </div>

              <div className="bg-error-bg/20 border border-error-border/50 rounded-lg p-4 text-sm text-text-primary space-y-1">
                <p>This will permanently:</p>
                <ul className="list-disc pl-5 space-y-0.5 text-text-secondary">
                  <li>Delete all eBay notification subscriptions</li>
                  <li>Remove your webhook notification destination</li>
                  <li>Delete all registered eBay seller accounts</li>
                  <li>Purge all inbox messages</li>
                  <li>Delete your Sealift tenant account</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Type <span className="font-mono font-bold text-error-text">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-4 py-2 bg-surface border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-error-border font-mono"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowConfirm(false); setConfirmText(""); }}
                  className="px-5 py-2 rounded-md border border-border text-text-secondary hover:bg-hover hover:text-hover-content transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowConfirm(false);
                    handleDeleteAccount();
                  }}
                  disabled={confirmText !== "DELETE" || isDeleting}
                  className="px-5 py-2 rounded-md bg-red-600 text-white font-bold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  {isDeleting ? "Deleting..." : "Delete My Account"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    )}
  </div>
);
}
