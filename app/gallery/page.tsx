"use client"; // Next.js 13+ App Router client component

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import LoginCtaBanner from "@/components/LoginCtaBanner";
import { trackedFetch as fetch } from "@/lib/api-tracker";
import {
  fetchAllListings,
  ReauthRequiredError,
  MAX_DAYS_PER_CHUNK,
  formatApiDate,
  type Item,
  type Listings,
} from "@/lib/ebay-data";
import UserTableOfContents from "@/components/UserTableOfContents";









interface ListingsResponse {
  user: string;
  listings: Listings;
}

// Component
export default function ListingsPage() {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Supersede any in-flight crawl when a new one starts, and stop it on unmount.
  const fetchAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => fetchAbortRef.current?.abort(), []);
  const [users, setUsers] = useState<string[]>([]);
  const [userListings, setUserListings] = useState<{
    [user: string]: Listings;
  }>({});
  const [userPages, setUserPages] = useState<{ [user: string]: number }>({});
  const [userTotalPages, setUserTotalPages] = useState<{
    [user: string]: number;
  }>({});
  const [startFrom, setStartFrom] = useState<Date>(
    new Date(new Date().setDate(new Date().getDate() - 120))
  );
  const [startTo, setStartTo] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [userLoading, setUserLoading] = useState<{ [user: string]: boolean }>(
    {}
  );
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState<"small" | "medium" | "big">(
    "medium"
  );

  // initial page load  
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  // needed to make sure that handleApply is deferred after
  // setVariables in "Reset" have actually been set.
  const [resetTriggered, setResetTriggered] = useState<boolean>(false);

  // Define separate page sizes
  const apiPageSize = 200; // For API requests
  const pageSizeMap: { [key in "small" | "medium" | "big"]: number } = {
    small: 20,
    medium: 12,
    big: 6,
  };
  const clientPageSize = pageSizeMap[displaySize];

  const fetchUsers = async () => {
    try {
      setUserLoading((prev) => ({
        ...prev,
        global: true,
      }));

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      const uri = process.env.NEXT_PUBLIC_USERS_URI;
      const apiUrl = `${apiBaseUrl}/${uri}?`;

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }
      const data = await response.json();

      const usersData: string[] = data.users || [];
      setUsers(usersData);

      const initialPages = usersData.reduce((acc, user) => {
        acc[user] = 1;
        return acc;
      }, {} as { [user: string]: number });

      const initialTotalPages = usersData.reduce((acc, user) => {
        acc[user] = 1;
        return acc;
      }, {} as { [user: string]: number });

      const initialLoading = usersData.reduce((acc, user) => {
        acc[user] = false;
        return acc;
      }, {} as { [user: string]: boolean });

      setUserPages(initialPages);
      setUserTotalPages(initialTotalPages);
      setUserLoading((prev) => ({
        ...prev,
        ...initialLoading,
        global: false,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching users");
      setUserLoading((prev) => ({ ...prev, global: false }));
    }
  };

  const fetchListingsForUser = async (user: string, signal?: AbortSignal) => {
    try {
      setUserLoading((prev) => ({ ...prev, [user]: true }));

      const { items, truncated } = await fetchAllListings(user, startFrom, startTo, { signal });
      if (signal?.aborted) return;

      setUserListings((prev) => ({
        ...prev,
        [user]: {
          PaginationResult: {
            TotalNumberOfEntries: items.length,
            TotalNumberOfPages: Math.ceil(items.length / clientPageSize),
          },
          HasMoreItems: false,
          ItemArray: { Items: items },
          ItemsPerPage: apiPageSize,
          PageNumber: 1,
          ReturnedItemCountActual: items.length,
        },
      }));

      setUserTotalPages((prev) => ({
        ...prev,
        [user]: Math.ceil(items.length / clientPageSize) || 1,
      }));

      if (truncated) {
        setError(`${user} has more listings than can be shown at once; narrow the date range to see the rest.`);
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      if (err instanceof ReauthRequiredError) {
        setError(`${err.user}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : `Error fetching listings for ${user}`);
      }
    } finally {
      if (!signal?.aborted) {
        setUserLoading((prev) => ({ ...prev, [user]: false }));
      }
    }
  };


  const handleApply = useCallback(() => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    if (startFrom > startTo) {
      setDateError("Start date cannot be after end date");
      return;
    }
    setDateError(null);
    setError(null);
    users.forEach((user) => {
      setUserPages((prev) => ({ ...prev, [user]: 1 }));
      fetchListingsForUser(user, controller.signal);
    });
  }, [startFrom, startTo, users]);

  const resetDateRange = () => {
    const newStartFrom = new Date(new Date().setDate(new Date().getDate() - 120));
    const newStartTo = new Date();
    setStartFrom(newStartFrom);
    setStartTo(newStartTo);
    setStatusFilter("ALL");
    setDateError(null);
    setError(null);
    setUserListings({});
    setUserTotalPages(
      users.reduce((acc, user) => {
        acc[user] = 1;
        return acc;
      }, {} as { [user: string]: number })
    );
    setUserPages(
      users.reduce((acc, user) => {
        acc[user] = 1;
        return acc;
      }, {} as { [user: string]: number })
    );
    setResetTriggered(true); // Signal that a reset has occurred
  };

  // Effect to handle initial fetch of users
  useEffect(() => {
    fetchUsers();
  }, []);

  // Effect to handle initial data fetch and reset
  useEffect(() => {
    if (users.length > 0 && (isInitialLoad || resetTriggered)) {
      handleApply();
      setIsInitialLoad(false); // Prevent re-fetching on subsequent user changes
      setResetTriggered(false); // Reset the trigger
    }
  }, [users, isInitialLoad, resetTriggered, handleApply]);

  // Effect to handle pagination adjustments when displaySize changes
  useEffect(() => {
    if (Object.keys(userListings).length > 0) {
      // Update total pages for all users based on the new clientPageSize
      const newTotalPages = { ...userTotalPages };
      const newCurrentPages = { ...userPages };

      Object.keys(userListings).forEach((user) => {
        const items = Array.isArray(userListings[user]?.ItemArray?.Items)
          ? userListings[user].ItemArray.Items
          : [];

        // Apply same status filter logic as in renderUserGallery to get accurate total count
        const filteredItems =
          statusFilter === "ALL"
            ? items
            : items.filter(
              (item) => item.SellingStatus.ListingStatus === statusFilter
            );

        newTotalPages[user] = Math.ceil(filteredItems.length / clientPageSize) || 1;
        newCurrentPages[user] = 1; // Reset to page 1 to avoid out-of-bounds
      });

      setUserTotalPages(newTotalPages);
      setUserPages(newCurrentPages);
    }
  }, [displaySize, statusFilter]); // Also update when statusFilter changes

  const sizeStyles = {
    small: {
      grid: "grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10",
      imageHeight: "h-[160px]",
      captionSize: "text-sm",
      placeholder: "https://via.placeholder.com/150x112?text=No+Image",
    },
    medium: {
      grid: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
      imageHeight: "h-[180px]",
      captionSize: "text-s",
      placeholder: "https://via.placeholder.com/300x225?text=No+Image",
    },
    big: {
      grid: "grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      imageHeight: "h-[300px]",
      captionSize: "text-lg",
      placeholder: "https://via.placeholder.com/450x337?text=No+Image",
    },
  };

  // dedicated image component to handle image loading errors (flickers otherwise?)
  const GalleryImage = ({ src, alt, placeholder, className }: { src: string, alt: string, placeholder: string, className: string }) => {
    const [imgSrc, setImgSrc] = useState(src);
    const [hasError, setHasError] = useState(false);

    // Update src if it changes from props (e.g. pagination or filter change)
    useEffect(() => {
      setImgSrc(src);
      setHasError(false);
    }, [src]);

    const handleError = () => {
      if (!hasError) {
        setImgSrc(placeholder);
        setHasError(true);
      }
    };

    return (
      <img
        src={imgSrc}
        alt={alt}
        className={className}
        onError={handleError}
      />
    );
  };

  const renderUserGallery = (
    user: string,
    listings: Listings,
    statusFilter: string,
    pageIdx: number,
    clientPageSize: number
  ) => {
    const items = Array.isArray(listings?.ItemArray?.Items)
      ? listings.ItemArray.Items
      : [];

    const filteredItems =
      statusFilter === "ALL"
        ? items
        : items.filter(
          (item) => item.SellingStatus.ListingStatus === statusFilter
        );

    const startIdx = (pageIdx - 1) * clientPageSize;
    const paginatedItems = filteredItems.slice(startIdx, startIdx + clientPageSize);

    return (
      <div
        key={user}
        id={`user-section-${user}`}
        className="bg-surface p-6 rounded-2xl shadow-md border border-border mb-8"
      >
        <h2 className="text-2xl text-primary mb-4">{user} 🌸</h2>
        <p className="text-xl text-primary mb-8">
          Total Items: {filteredItems.length} 📦
        </p>
        {paginatedItems.length > 0 ? (
          <div className={`grid ${sizeStyles[displaySize].grid} gap-6`}>
            {paginatedItems.map((item) => {
              const pictureURLs = item.PictureDetails?.PictureURLs || [];
              const imageUrl =
                pictureURLs.length > 0
                  ? pictureURLs[0]
                  : sizeStyles[displaySize].placeholder;
              return (
                <div key={item.ItemID} className="relative group">
                  <a
                    href={item.ListingDetails.ViewItemURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="duration-500 group-hover:scale-105">
                      <GalleryImage
                        src={imageUrl}
                        alt={`Image for ${item.Title}`}
                        placeholder={sizeStyles[displaySize].placeholder}
                        className={`w-full ${sizeStyles[displaySize].imageHeight} max-w-full object-contain rounded-lg transition-transform`}
                      />
                      <div className="text-transform: uppercase absolute bottom-0 left-0 right-0 bg-[var(--nav-bg)] text-primary text-center py-2 rounded-b-lg transition-transform">
                        <p className={sizeStyles[displaySize].captionSize}>
                          {item.SellingStatus.ListingStatus}
                        </p>
                      </div>
                    </div>
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-text-secondary text-lg">
            No items available for {user}.
          </p>
        )}
      </div>
    );
  };

  if (!mounted) {
    return null;
  }

  return (
    <>
          <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 lg:mb-10 gap-4">
          <h1 className="text-2xl sm:text-3xl lg:text-5xl text-primary text-center sm:text-left drop-shadow-sm font-heading break-words">
            Listing Gallery
          </h1>
        </div>
        <div className="mb-8 flex flex-col lg:flex-row gap-6 items-center lg:items-center lg:flex-wrap">
          <div className="flex flex-wrap justify-center lg:justify-start gap-4">
            <div className="flex items-center rounded-lg shadow-sm border border-border overflow-hidden focus-within:ring-2 focus-within:ring-primary transition-all">
              <label className="bg-surface text-primary font-bold text-sm uppercase tracking-wider px-3 py-2 border-r border-border flex items-center h-full">From</label>
              <input
                type="date"
                value={formatApiDate(startFrom)}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  if (!isNaN(newDate.getTime())) {
                    setStartFrom(newDate);
                  }
                }}
                className="px-4 py-2 h-full border-none text-text-primary focus:outline-none focus:ring-0 bg-surface hover:bg-hover hover:text-hover-content cursor-pointer font-heading transition-colors"
                max={formatApiDate(new Date())}
              />
            </div>
            <div className="flex items-center rounded-lg shadow-sm border border-border overflow-hidden focus-within:ring-2 focus-within:ring-primary transition-all">
              <label className="bg-surface text-primary font-bold text-sm uppercase tracking-wider px-3 py-2 border-r border-border flex items-center h-full">To</label>
              <input
                type="date"
                value={formatApiDate(startTo)}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  if (!isNaN(newDate.getTime())) {
                    setStartTo(newDate);
                  }
                }}
                className="px-4 py-2 h-full border-none text-text-primary focus:outline-none focus:ring-0 bg-surface hover:bg-hover hover:text-hover-content cursor-pointer font-heading transition-colors"
                max={formatApiDate(new Date())}
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-center lg:justify-start gap-4 items-center">
            <div className="flex gap-2">
              <button
                onClick={handleApply}
                className="px-6 py-2 bg-btn-apply text-white rounded-lg hover:bg-btn-apply-hover transition-all shadow-sm font-bold active:scale-95"
              >
                Apply ✿
              </button>
              <button
                onClick={resetDateRange}
                className="px-6 py-2 bg-btn-reset text-white rounded-lg hover:bg-btn-reset-hover transition-all shadow-sm font-bold active:scale-95"
              >
                Reset ✿
              </button>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center rounded-lg shadow-sm border border-border overflow-hidden focus-within:ring-2 focus-within:ring-primary transition-all">
                <label className="bg-surface text-primary font-bold text-sm uppercase tracking-wider px-3 py-2 border-r border-border flex items-center h-full">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 h-full border-none text-text-primary focus:outline-none focus:ring-0 bg-surface hover:bg-hover hover:text-hover-content cursor-pointer font-heading transition-colors"
                >
                  <option value="ALL" className="bg-surface text-text-primary">ALL</option>
                  <option value="Active" className="bg-surface text-text-primary">Active</option>
                  <option value="Completed" className="bg-surface text-text-primary">Completed</option>
                  <option value="Ended" className="bg-surface text-text-primary">Ended</option>
                </select>
              </div>

              <div className="flex items-center rounded-lg shadow-sm border border-border overflow-hidden focus-within:ring-2 focus-within:ring-primary transition-all">
                <label className="bg-surface text-primary font-bold text-sm uppercase tracking-wider px-3 py-2 border-r border-border flex items-center h-full">View</label>
                <select
                  value={displaySize}
                  onChange={(e) =>
                    setDisplaySize(e.target.value as "small" | "medium" | "big")
                  }
                  className="px-4 py-2 h-full border-none text-text-primary focus:outline-none focus:ring-0 bg-surface hover:bg-hover hover:text-hover-content cursor-pointer font-heading transition-colors"
                >
                  <option value="small" className="bg-surface text-text-primary">Small</option>
                  <option value="medium" className="bg-surface text-text-primary">Medium</option>
                  <option value="big" className="bg-surface text-text-primary">Big</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        {dateError && <p className="text-error-text text-lg mb-4">{dateError}</p>}
        {error && <p className="text-error-text text-lg mb-4">{error}</p>}
        {userLoading.global ? (
          <div className="mb-8 p-6 bg-surface rounded-lg shadow-md border border-border">
            <p className="text-primary text-lg">Loading Users... </p>
          </div>
        ) : users.length > 0 ? (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <UserTableOfContents users={users} />
            <div className="flex-1 w-full">
              {users.map((user) => (
                <div key={user}>
                  {userLoading[user] ? (
                    <div className="mb-8 p-6 bg-surface rounded-lg shadow-md border border-border">
                      <h2 className="text-2xl text-primary mb-4">{user} 🌸</h2>
                      <p className="text-primary text-lg">
                        Loading Listings...
                      </p>
                    </div>
                  ) : userListings[user]?.ReturnedItemCountActual > 0 ? (
                    renderUserGallery(
                      user,
                      userListings[user],
                      statusFilter,
                      userPages[user],
                      clientPageSize
                    )
                  ) : (
                    <div className="mb-8 p-6 bg-surface rounded-lg shadow-md border border-border">
                      <h2 className="text-2xl text-primary mb-4">{user} 🌸</h2>
                      <p className="text-text-secondary text-lg">
                        No listings for {user}.
                      </p>
                    </div>
                  )}
                  {userListings[user]?.ReturnedItemCountActual > 0 && (
                    <div className="flex gap-4 mt-2 mb-6 justify-center">
                      <button
                        onClick={() => {
                          setUserPages((prev) => ({
                            ...prev,
                            [user]: prev[user] - 1,
                          }));
                        }}
                        disabled={userPages[user] === 1}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <span className="text-primary text-lg flex items-center">
                        Page {userPages[user]} of {userTotalPages[user] || 1}
                      </span>
                      <button
                        onClick={() => {
                          setUserPages((prev) => ({
                            ...prev,
                            [user]: prev[user] + 1,
                          }));
                        }}
                        disabled={userPages[user] >= (userTotalPages[user] || 1)}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:bg-border disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-8 p-6 bg-surface rounded-lg shadow-md border border-border">
            <p className="text-text-secondary text-lg">No listings available. </p>
          </div>
        )}
      </div>
    </>
  );
}