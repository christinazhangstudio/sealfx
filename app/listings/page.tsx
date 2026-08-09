"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import LoginCtaBanner from "@/components/LoginCtaBanner";
import {
  fetchAllListings,
  ReauthRequiredError,
  MAX_DAYS_PER_CHUNK,
  formatApiDate,
  type Item,
  type Listings,
} from "@/lib/ebay-data";
import UserTableOfContents from "@/components/UserTableOfContents";
import { useUsers } from "@/components/UsersContext";
import PageHeader from "@/components/PageHeader";
import PersonIcon from "@/components/PersonIcon";


const renderUserTable = (
  user: string,
  listings: Listings,
  statusFilter: string,
  pageIdx: number,
  clientPageSize: number
) => {
  // Ensure Items is an array to prevent "not iterable" error
  const items = Array.isArray(listings?.ItemArray?.Items)
    ? listings.ItemArray.Items
    : [];

  const filteredItems =
    statusFilter === "ALL"
      ? items
      : items.filter(
        (item) => item.SellingStatus.ListingStatus === statusFilter
      );

  // Apply client-side pagination with clientPageSize
  const startIdx = (pageIdx - 1) * clientPageSize;
  const paginatedItems = filteredItems.slice(
    startIdx,
    startIdx + clientPageSize
  );

  return (
    <div
      key={user}
      className="seller-card"
    >
      <h2 className="seller-card-title flex items-center gap-2">
        <span>{user}</span>
        <PersonIcon />
      </h2>
      <p className="text-base sm:text-xl text-primary mb-4">
        Total Items: {filteredItems.length} 📦
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-text-primary">
          <thead>
            <tr className="text-primary border-b border-border">
              <th className="p-2 hidden sm:table-cell">ID</th>
              <th className="p-2 text-left">Title</th>
              <th className="p-2 hidden sm:table-cell">Status</th>
              <th className="p-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length > 0 ? (
              paginatedItems.map((listing) => (
                <tr key={listing.ItemID} className="border-t border-border">
                  <td className="p-2 hidden sm:table-cell">{listing.ItemID}</td>
                  <td className="p-2 text-left align-top">
                    <span className="block">{listing.Title}</span>
                    {/* Folded in on small screens, where they'd otherwise
                        squeeze the title into an unreadable column. */}
                    <span className="sm:hidden block mt-1 text-xs text-text-secondary">
                      {listing.SellingStatus.ListingStatus} · {listing.ItemID}
                    </span>
                  </td>
                  <td className="p-2 hidden sm:table-cell">{listing.SellingStatus.ListingStatus}</td>
                  <td className="p-2 align-top whitespace-nowrap">
                    {new Date(
                      listing.ListingDetails.StartTime
                    ).toLocaleDateString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-2 text-text-secondary text-lg">
                  No listings match the selected status.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function ListingsPage() {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Cancels the in-flight crawl on unmount and whenever a new one starts.
  const fetchAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => fetchAbortRef.current?.abort(), []);

  const { users, loadingUsers } = useUsers();
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
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [resetTriggered, setResetTriggered] = useState<boolean>(false);

  // Define separate page sizes
  const apiPageSize = 200; // For API requests
  const clientPageSize = 10; // For client-side pagination

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
    if (startFrom > startTo) {
      setDateError("Start date cannot be after end date");
      return;
    }
    setDateError(null);
    setError(null);

    // Each Apply supersedes the one before it. Without this, two clicks race and
    // whichever crawl finishes last wins — so the table could end up showing the
    // previous range while the date pickers show the new one.
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    users.forEach((user) => {
      setUserPages((prev) => ({ ...prev, [user]: 1 }));
      fetchListingsForUser(user, controller.signal);
    });
  }, [startFrom, startTo, users]);

  const resetDateRange = () => {
    const newStartFrom = new Date(
      new Date().setDate(new Date().getDate() - 120)
    );
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

  // Effect to handle initial data fetch and reset
  useEffect(() => {
    if (users.length > 0 && !loadingUsers && (isInitialLoad || resetTriggered)) {
      handleApply();
      setIsInitialLoad(false); // Prevent re-fetching on subsequent user changes
      setResetTriggered(false); // Reset the trigger
    }
  }, [users, isInitialLoad, resetTriggered, handleApply]);

  if (!mounted) {
    return null;
  }

  return (
    <>
          <div className="page-content-shell bg-background">
        <PageHeader title="Listings" />
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
                className="px-4 py-2 h-full border-none text-text-primary focus:outline-none focus:ring-0 bg-surface hover:bg-hover hover:text-hover-content cursor-pointer font-mono transition-colors"
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
                className="px-4 py-2 h-full border-none text-text-primary focus:outline-none focus:ring-0 bg-surface hover:bg-hover hover:text-hover-content cursor-pointer font-mono transition-colors"
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
                Apply
              </button>
              <button
                onClick={resetDateRange}
                className="px-6 py-2 bg-btn-reset text-white rounded-lg hover:bg-btn-reset-hover transition-all shadow-sm font-bold active:scale-95"
              >
                Reset
              </button>
            </div>

            <div className="flex items-center rounded-lg shadow-sm border border-border overflow-hidden focus-within:ring-2 focus-within:ring-primary transition-all">
              <label className="bg-surface text-primary font-bold text-sm uppercase tracking-wider px-3 py-2 border-r border-border flex items-center h-full">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 h-full border-none text-text-primary focus:outline-none focus:ring-0 bg-surface hover:bg-hover hover:text-hover-content cursor-pointer font-mono transition-colors"
              >
                <option value="ALL" className="bg-surface text-text-primary">ALL</option>
                <option value="Active" className="bg-surface text-text-primary">Active</option>
                <option value="Completed" className="bg-surface text-text-primary">Completed</option>
                <option value="Ended" className="bg-surface text-text-primary">Ended</option>
              </select>
            </div>
          </div>
        </div>
        {dateError && <p className="text-error-text text-lg mb-4">{dateError}</p>}
        {error && <p className="text-error-text text-lg mb-4">{error}</p>}
        {userLoading.global ? (
          <div className="seller-card">
            <p className="text-primary text-lg">Loading Users... </p>
          </div>
        ) : users.length > 0 ? (
          <div className="space-y-6">
            <UserTableOfContents users={users} />
            <div className="w-full min-w-0 space-y-8">
              {users.map((user) => (
                <div key={user} id={`user-section-${user}`}>
                  {userLoading[user] ? (
                    <div className="seller-card">
                      <h2 className="seller-card-title flex items-center gap-2">
                        <span>{user}</span>
                        <PersonIcon />
                      </h2>
                      <p className="text-primary text-lg">
                        Loading Listings...
                      </p>
                    </div>
                  ) : userListings[user]?.ReturnedItemCountActual > 0 ? (
                    renderUserTable(
                      user,
                      userListings[user],
                      statusFilter,
                      userPages[user],
                      clientPageSize
                    )
                  ) : (
                    <div className="seller-card">
                      <h2 className="seller-card-title flex items-center gap-2">
                        <span>{user}</span>
                        <PersonIcon />
                      </h2>
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
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          <div className="seller-card">
            <p className="text-text-secondary text-lg">No users available. </p>
          </div>
        )}
      </div>
    </>
  );
}
