"use client";

import { useState, useEffect } from "react";
import { trackedFetch as fetch } from "@/lib/api-tracker";
// Font imports removed as they are handled globally


interface UsersResponse {
  users: string[];
}

export default function RegisterSellerPage() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setAPIError] = useState<string | null>(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  useEffect(() => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const usersUri = process.env.NEXT_PUBLIC_USERS_URI;

    if (!apiBaseUrl) {
      setAPIError("API base URL env not defined");
      setLoading(false);
      return;
    }

    if (!usersUri) {
      setAPIError("Users URI env not defined");
      setLoading(false);
      return;
    }

    const apiUrl = `${apiBaseUrl}/${usersUri}`;

    fetch(apiUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch users: ${res.status}`);
        }
        return res.json();
      })
      .then((data: UsersResponse) => {
        setUsers(data.users);
        setLoading(false);
      })
      .catch((err: Error) => {
        setAPIError(err.message);
        setLoading(false);
      });
  }, []);

  const deleteUser = async (user: string) => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const usersUri = process.env.NEXT_PUBLIC_USERS_URI;

    if (!apiBaseUrl || !usersUri) {
      setAPIError("API base URL or Users URI env not defined");
      return;
    }

    const apiUrl = `${apiBaseUrl}/${usersUri}/${user}`;

    try {
      const response = await fetch(apiUrl, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete user: ${response.status}`);
      }

      // Update the users list by filtering out the deleted user
      setUsers(users.filter((u) => u !== user));
    } catch (err: any) {
      setAPIError(err.message);
    } finally {
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

  const startOAuthFlow = () => {
    if (isLoading) {
      console.log("startOAuthFlow: Already loading, ignoring click");
      return;
    }
    setIsLoading(true);
    setError(null);

    console.log("startOAuthFlow: Attempting to open window");

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const registerSellerUri = process.env.NEXT_PUBLIC_REGISTER_SELLER_URI;

    if (!apiBaseUrl) {
      setAPIError("API base URL env not defined");
      setLoading(false);
      return;
    }

    if (!registerSellerUri) {
      setAPIError("Register seller URI env not defined");
      setLoading(false);
      return;
    }

    const apiUrl = `${apiBaseUrl}/${registerSellerUri}`;

    const oauthWindow = window.open(apiUrl, "_blank", "width=600,height=700");

    console.log("startOAuthFlow: oauthWindow =", oauthWindow);

    if (!oauthWindow) {
      console.log("startOAuthFlow: oauthWindow is null, but checking for messages");
      setError("Window may have opened, but we couldn't track it. Please complete authorization.");
    }

    const handleMessage = (event: MessageEvent) => {
      console.log("handleMessage: Received event", {
        origin: event.origin,
        data: event.data,
      });

      if (event.data === "seller_authorized") {
        console.log("handleMessage: Authorization successful");
        setIsAuthorized(true);
        setIsLoading(false);
        if (oauthWindow && !oauthWindow.closed) {
          oauthWindow.close();
        }
      } else if (event.data?.error) {
        console.log("handleMessage: Authorization error", event.data.error);
        setError(event.data.error);
        setIsLoading(false);
        if (oauthWindow && !oauthWindow.closed) {
          oauthWindow.close();
        }
      }
    };

    console.log("auth", isAuthorized);

    window.addEventListener("message", handleMessage);

    let checkWindowClosed: NodeJS.Timeout | undefined;
    if (oauthWindow) {
      checkWindowClosed = setInterval(() => {
        if (oauthWindow.closed) {
          console.log("checkWindowClosed: OAuth window closed");
          clearInterval(checkWindowClosed);
          window.removeEventListener("message", handleMessage);
          setIsLoading(false);
          if (!isAuthorized && !error) {
            setError("Authorization window closed unexpectedly.");
          }
        }
      }, 500);
    } else console.log("checkWindowClosed: No oauthWindow, relying on postMessage");

    return () => {
      console.log("startOAuthFlow: Cleaning up");
      window.removeEventListener("message", handleMessage);
      if (checkWindowClosed) {
        clearInterval(checkWindowClosed);
      }
    };
  };

  useEffect(() => {
    return () => {
      console.log("useEffect: Cleaning up on unmount");
      window.removeEventListener("message", () => { });
    };
  }, []);

  return (
    <div
      className={`min-h-screen flex justify-center bg-[var(--background)] pt-8 px-4 sm:px-6 lg:px-8 relative`}
    >
      <div className={`max-w-md w-full space-y-6 ${showDeletePopup ? 'blur-sm' : ''}`}>
        <div className="max-w-md w-full bg-surface rounded-xl shadow-lg p-8 transform transition-all duration-300 hover:shadow-xl mt-8">
          <h1 className="text-4xl text-text-primary mb-6 text-center animate-fade-in">
            add sellers
          </h1>

          {isAuthorized ? (
            <div className="bg-success-bg border-l-4 border-success-border p-4 rounded-lg flex items-center space-x-3">
              <svg
                className="w-6 h-6 text-success-border"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="text-success-text text-lg">Authorization successful!</p>
            </div>
          ) : error ? (
            <div className="bg-error-bg border-l-4 border-error-border p-4 rounded-lg">
              <div className="flex items-center space-x-3">
                <svg
                  className="w-6 h-6 text-error-border"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                <p className="text-error-text text-lg">{error}</p>
              </div>
              {error.includes("track it") && (
                <div className="mt-4 text-sm text-gray-600 bg-gray-100 p-4 rounded-lg">
                  <p className="font-medium">To allow pop-ups:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Chrome: Click lock icon → Site settings → Allow Pop-ups.</li>
                    <li>Firefox: Click shield icon → Disable blocking.</li>
                    <li>Safari: Preferences → Websites → Allow Pop-up Windows.</li>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={startOAuthFlow}
              disabled={isLoading}
              className={`w-full flex justify-center items-center px-6 py-3 rounded-lg text-white text-lg font-medium transition-all duration-200 transform ${isLoading
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-primary duration-200 hover:bg-primary-hover hover:scale-105 shadow-md hover:shadow-lg focus:ring-4 focus:ring-secondary focus:outline-none"
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
          )}
        </div>

        {/* Second card */}
        <div className="bg-surface rounded-xl shadow-lg p-8 transform transition-all duration-300 hover:shadow-xl">
          <h2 className="text-2xl text-text-primary mb-4 text-center animate-fade-in">
            registered sellers for sealift
          </h2>
          {apiError && <p className="text-error-text text-lg">{apiError}</p>}
          {loading ? (
            <p className="text-secondary text-lg">Loading users... </p>
          ) : users && users.length > 0 ? (
            <div className="text-gray-600 text-lg text-center">
              {users.map((user) => (
                <div
                  key={user}
                  className="border-b border-border flex justify-between items-center py-2"
                >
                  <p>{user}</p>
                  <button
                    onClick={() => handleDeleteClick(user)}
                    className="text-error-text hover:text-error-border transition-colors duration-200"
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
              ))}
            </div>
          ) : (
            <p className="flex justify-center items-center text-gray-600 text-lg">
              No users available.
            </p>
          )}
        </div>
      </div>

      {/* Delete Confirmation Popup */}
      {showDeletePopup && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className={`bg-surface rounded-xl shadow-lg p-6 max-w-sm w-full z-50`}>
            <h3 className="text-xl text-text-primary mb-4 text-center">
              Confirm Deletion
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Are you sure you want to delete user "{userToDelete}"?
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-error-border text-white rounded-lg hover:bg-error-text transition-all duration-200 shadow-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}