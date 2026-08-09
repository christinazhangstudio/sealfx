"use client";

import { useState, useEffect, useRef } from "react";
import { trackedFetch as fetch } from "@/lib/api-tracker";
import { useUsers } from "@/components/UsersContext";
import PageHeader from "@/components/PageHeader";
import StatusToast, { type StatusToastVariant } from "@/components/StatusToast";

interface UsersResponse {
  users: string[];
}

// Give the seller time to sign in to eBay (including 2FA) before giving up,
// but don't poll forever if they abandon the flow.
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

export default function RegisterSellerPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { users, sellers, loadingUsers: loading, refetchUsers } = useUsers();

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setAPIError] = useState<string | null>(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: StatusToastVariant;
  } | null>(null);

  // Tear down an in-flight OAuth attempt if the page unmounts.
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const deleteUser = async (user: string) => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const usersUri = process.env.NEXT_PUBLIC_USERS_URI;

    if (!apiBaseUrl || !usersUri) {
      setNotification({
        message: "API base URL or Users URI env not defined",
        type: "error",
      });
      return;
    }

    const apiUrl = `${apiBaseUrl}/${usersUri}/${user}`;

    setIsDeleting(true);
    setAPIError(null);
    setNotification(null);
    try {
      const response = await fetch(apiUrl, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete user: ${response.status}`);
      }

      // Refresh users list from the shared context
      await refetchUsers();
      setNotification({ message: `Removed ${user}.`, type: "success" });
    } catch (err: unknown) {
      setNotification({
        message: err instanceof Error ? err.message : "Failed to delete seller",
        type: "error",
      });
    } finally {
      setIsDeleting(false);
      setShowDeletePopup(false);
      setUserToDelete(null);
    }
  };

  const handleDeleteClick = (user: string) => {
    setUserToDelete(user);
    setShowDeletePopup(true);
  };

  const handleCancelDelete = () => {
    setShowDeletePopup(false);
    setUserToDelete(null);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      deleteUser(userToDelete);
    }
  };

  // Auto-dismiss, giving errors longer since they now carry a reason to read.
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(
        () => setNotification(null),
        notification.type === "error" ? 8000 : 3000,
      );
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const startOAuthFlow = () => {
    if (isLoading) {
      console.log("startOAuthFlow: Already loading, ignoring click");
      return;
    }
    setIsLoading(true);
    setNotification(null);

    console.log("startOAuthFlow: Attempting to open window");

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const registerSellerUri = process.env.NEXT_PUBLIC_REGISTER_SELLER_URI;

    if (!apiBaseUrl) {
      setAPIError("API base URL env not defined");
      setIsLoading(false);
      return;
    }

    if (!registerSellerUri) {
      setAPIError("Register seller URI env not defined");
      setIsLoading(false);
      return;
    }

    const apiUrl = `${apiBaseUrl}/${registerSellerUri}`;

    const oauthWindow = window.open(apiUrl, "_blank", "width=600,height=700");

    if (!oauthWindow) {
      // Popup blocked: nothing to track, so stop here rather than leaving the
      // button spinning on a flow that can never complete.
      setNotification({
        message: "Your browser blocked the eBay window. Allow popups for this site, then try again.",
        type: "error",
      });
      setIsLoading(false);
      return;
    }

    // The callback runs on the eBay redirect domain (the webhook host), so accept
    // messages from there as well as from this app — and nowhere else.
    const allowedOrigins = new Set<string>([window.location.origin]);
    const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        allowedOrigins.add(new URL(webhookUrl).origin);
      } catch {
        /* malformed env value: fall back to same-origin only */
      }
    }

    let settled = false;
    let checkWindowClosed: ReturnType<typeof setInterval> | undefined;
    let fallbackPoller: ReturnType<typeof setInterval> | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // Snapshot the sellers we already know about so the fallback can spot a
    // newcomer. Only trust it once the list has actually loaded, otherwise an
    // empty in-flight list makes every existing seller look brand new.
    const knownUsers = loading ? null : new Set(users);

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      if (checkWindowClosed) clearInterval(checkWindowClosed);
      if (fallbackPoller) clearInterval(fallbackPoller);
      if (timeoutId) clearTimeout(timeoutId);
      cleanupRef.current = null;
    };
    cleanupRef.current = cleanup;

    const settle = (message: string, type: StatusToastVariant) => {
      if (settled) return;
      settled = true;
      cleanup();
      setIsLoading(false);
      setNotification({ message, type });
      if (!oauthWindow.closed) oauthWindow.close();
      refetchUsers();
    };

    const handleMessage = (event: MessageEvent) => {
      if (settled || !allowedOrigins.has(event.origin)) return;

      const data = event.data;
      const type = typeof data === "string" ? data : data?.type;

      if (type === "seller_authorized") {
        const who = typeof data === "object" ? data?.user : "";
        settle(who ? `${who} authorized!` : "Authorization successful!", "success");
      } else if (type === "seller_authorization_failed") {
        const reason = typeof data === "object" ? data?.error : "";
        settle(reason || "eBay authorization failed. Please try again.", "error");
      }
    };

    window.addEventListener("message", handleMessage);

    // Fallback for when postMessage doesn't arrive (blocked opener, etc.).
    // It can only detect newly added sellers — re-authorizing an existing
    // seller is confirmed by the message above.
    fallbackPoller = setInterval(async () => {
      if (settled || !knownUsers) return;
      const base = process.env.NEXT_PUBLIC_API_URL;
      const uri = process.env.NEXT_PUBLIC_USERS_URI;
      if (!base || !uri) return;

      try {
        const response = await fetch(`${base}/${uri}`);
        if (!response.ok) return;
        const data: UsersResponse = await response.json();
        const newcomer = (data.users || []).find((u) => !knownUsers.has(u));
        if (newcomer) settle(`${newcomer} authorized!`, "success");
      } catch {
        // Ignore polling errors; the message handler is the primary path.
      }
    }, 2000);

    checkWindowClosed = setInterval(() => {
      if (!oauthWindow.closed || settled) return;
      // The window can close moments before its message is delivered, so give
      // the message handler a beat before concluding anything.
      setTimeout(() => {
        if (settled) return;
        settle("Authorization was not completed. Please try again.", "error");
      }, 1500);
    }, 1000);

    timeoutId = setTimeout(() => {
      settle("Authorization timed out. Please try again.", "error");
    }, OAUTH_TIMEOUT_MS);
  };

  if (!mounted) {
    return null;
  }

  return (
    <div
      className="page-content-shell bg-[var(--background)] relative"
    >
      <div className={`max-w-5xl mx-auto ${showDeletePopup ? 'blur-sm' : ''}`}>
        <PageHeader title="Add Sellers" />
        <div className="max-w-md w-full space-y-6">
            <div className="w-full bg-surface rounded-xl shadow-md border border-border p-8 transform transition-all duration-300 hover:shadow-xl relative">
            <button
              onClick={startOAuthFlow}
              disabled={isLoading}
              className={`w-full flex justify-center items-center px-6 py-3 rounded-md text-white text-lg font-medium transition-all duration-200 transform ${isLoading
                ? "bg-gray-300 cursor-not-allowed"
                : "shine-button duration-300 hover:scale-101 shadow-md hover:shadow-lg focus:ring-4 focus:ring-secondary focus:outline-none"
                }`}
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 mr-3 text-white"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Authorizing...
                </>
              ) : (
                "authorize through eBay login"
              )}
            </button>
          </div>

            {/* Notification Popup */}
            {notification && (
              <StatusToast
                message={notification.message}
                variant={notification.type}
              />
            )}

            {/* Second card */}
            <div className="bg-surface rounded-lg border border-border shadow-lg p-8 transform transition-all duration-300 hover:shadow-xl">
            <h2 className="text-2xl text-primary mb-6 text-center drop-shadow-sm font-heading">
              added sellers
            </h2>
            {apiError && <p className="text-error-text text-lg">{apiError}</p>}
            {loading ? (
              <p className="text-secondary text-lg">Loading users... </p>
            ) : users && users.length > 0 ? (
              <div className="--color-text-primary text-lg text-center">
                {users.map((user) => {
                  const seller = sellers.find((s) => s.user === user);
                  const needsAttention = seller?.status === "expired" || seller?.status === "expiring";
                  return (
                  <div
                    key={user}
                    className="border-b border-border flex justify-between items-center py-2 gap-2"
                  >
                    <div className="flex flex-col items-start min-w-0">
                      <p className="truncate">{user}</p>
                      {seller?.status === "expired" && (
                        <span className="text-xs font-semibold text-error-text">
                          eBay access expired — reconnect to restore data
                        </span>
                      )}
                      {seller?.status === "expiring" && (
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                          eBay access expires soon
                          {seller.expiresAt ? ` (${new Date(seller.expiresAt).toLocaleDateString()})` : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                    {needsAttention && (
                      <button
                        onClick={startOAuthFlow}
                        disabled={isLoading}
                        className="px-3 py-2.5 min-h-[44px] rounded-md text-xs font-bold text-white bg-btn-apply hover:bg-btn-apply-hover transition-colors disabled:opacity-50"
                        title="Re-authorize this seller with eBay"
                      >
                        Reconnect
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteClick(user)}
                      disabled={isDeleting}
                      className="p-3 -m-1 text-error-text hover:text-error-border transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Delete user"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4M3 7h18"
                        />
                      </svg>
                    </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <p className="flex justify-center items-center text-gray-600 text-lg">
                No users available.
              </p>
            )}
            </div>
        </div>
      </div>

      {/* Delete Confirmation Popup */}
      {showDeletePopup && (
        <div
          className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-black/50 p-4 z-[var(--z-modal)]"
          onClick={handleCancelDelete}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-surface rounded-xl shadow-lg p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl text-text-primary mb-4 text-center">
              Confirm Deletion
            </h3>
            <p className="text-text-primary text-center mb-6">
              Are you sure you want to delete user "{userToDelete}"?
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-error-border text-white rounded-lg hover:bg-error-text transition-all duration-200 shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting && (
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
