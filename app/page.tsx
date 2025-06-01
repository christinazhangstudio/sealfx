"use client";

import { useState, useEffect } from "react";

import { Inconsolata } from "next/font/google";

const inconsolata = Inconsolata({
  weight: "500",
  subsets: ['latin']
});

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
        // console.log(data);
        setUsers(data.users);
        setLoading(false);
      })
      .catch((err: Error) => {
        setAPIError(err.message);
        setLoading(false);
      });
  }, []);

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

    const oauthWindow = window.open(
      apiUrl,
      "_blank",
      "width=600,height=700"
    );

    console.log("startOAuthFlow: oauthWindow =", oauthWindow);

    if (!oauthWindow) {
      console.log(
        "startOAuthFlow: oauthWindow is null, but checking for messages"
      );
      setError(
        "Window may have opened, but we couldn't track it. Please complete authorization."
      );
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
    } else {
      console.log("checkWindowClosed: No oauthWindow, relying on postMessage");
    }

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
      window.removeEventListener("message", () => {});
    };
  }, []);

  return (
    <div
      className={`${inconsolata.className} min-h-screen flex justify-center bg-gradient-to-br from-purple-50 to-gray-100 pt-8 px-4 sm:px-6 lg:px-8`}
    >
      <div className="max-w-md w-full space-y-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 transform transition-all duration-300 hover:shadow-xl mt-8">
          <h1 className="text-4xl text-pink-700 mb-6 text-center animate-fade-in">
            add sellers
          </h1>

          {isAuthorized ? (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg flex items-center space-x-3">
              <svg
                className="w-6 h-6 text-green-500"
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
              <p className="text-green-700 text-lg">
                Authorization successful!
              </p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
              <div className="flex items-center space-x-3">
                <svg
                  className="w-6 h-6 text-red-500"
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
                <p className="text-red-700 text-lg">{error}</p>
              </div>
              {error.includes("track it") && (
                <div className="mt-4 text-sm text-gray-600 bg-gray-100 p-4 rounded-lg">
                  <p className="font-medium">To allow pop-ups:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>
                      Chrome: Click lock icon → Site settings → Allow Pop-ups.
                    </li>
                    <li>Firefox: Click shield icon → Disable blocking.</li>
                    <li>
                      Safari: Preferences → Websites → Allow Pop-up Windows.
                    </li>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={startOAuthFlow}
              disabled={isLoading}
              className={`w-full flex justify-center items-center px-6 py-3 rounded-lg text-white text-lg font-medium transition-all duration-200 transform ${
                isLoading
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-pink-600 duration-200 hover:bg-pink-700 hover:scale-105 shadow-md hover:shadow-lg focus:ring-4 focus:ring-pink-300 focus:outline-none"
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

        {/* second card */}

        <div className="bg-white rounded-xl shadow-lg p-8 transform transition-all duration-300 hover:shadow-xl">
          <h2 className="text-2xl text-pink-700 mb-4 text-center animate-fade-in">
            registered sellers for sealift
          </h2>
          {apiError && <p className="text-rose-500 text-lg hidden">{apiError}</p>}
          {loading ? (
            <p className="text-pink-600 text-lg">Loading users... ♡</p>
          ) : users && users.length > 0 ? (
            <div className="text-gray-600 text-lg text-center">
              {users.map((user) => (
                <p key={user}
                 className="border-b border-pink-100">
                  {user}
                </p>
              ))}
            </div>
          ) : (
            <p className="flex justify-center items-center text-gray-600 text-lg">No users available. ♡</p>
        )}
        </div>
      </div>
    </div>
  );
}
