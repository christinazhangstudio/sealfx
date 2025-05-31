"use client"; // Next.js 13+ App Router client component

import { useState, useEffect, useCallback } from "react";
import { Inconsolata } from "next/font/google";

const inconsolata = Inconsolata({
  weight: "500",
});

interface PackageDetails {
  Weight: { Value: number; Unit: string };
  Dimensions: { Height: number; Length: number; Width: number; Unit: string };
}

interface ListingDetails {
  StartTime: string;
  EndTime: string;
  ViewItemURL: string;
}

interface PictureDetails {
  GalleryURL: string;
  PhotoDisplay: string;
  PictureURLs: string[];
}

interface SellingStatus {
  BidCount: number;
  BidIncrement: { Value: number; CurrencyID: string };
  ConvertedCurrentPrice: { Value: number; CurrencyID: string };
  CurrentPrice: { Value: number; CurrencyID: string };
  MinimumToBid: { Value: number; CurrencyID: string };
  QuantitySold: number;
  SecondChanceEligible: boolean;
  ListingStatus: string;
}

interface PrimaryCategory {
  CategoryID: string;
  CategoryName: string;
}

interface Item {
  ItemID: string;
  Title: string;
  SKU: string;
  Quantity: number;
  ConditionID: string;
  ConditionDisplayName: string;
  ListingDetails: ListingDetails;
  PackageDetails: PackageDetails;
  PictureDetails: PictureDetails;
  SellingStatus: SellingStatus;
  PrimaryCategory: PrimaryCategory;
}

interface ItemArray {
  Items: Item[];
}

interface Listings {
  XMLName: { Space: string; Local: string };
  Timestamp: string;
  Ack: string;
  Version: string;
  Build: string;
  PaginationResult: {
    TotalNumberOfPages: number;
    TotalNumberOfEntries: number;
  };
  HasMoreItems: boolean;
  ItemArray: ItemArray;
  ItemsPerPage: number;
  PageNumber: number;
  ReturnedItemCountActual: number;
}

interface ListingsResponse {
  user: string;
  listings: Listings;
}

// Component
export default function ListingsPage() {
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
    "small"
  );

  // initial page load  
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  // needed to make sure that handleApply is deferred after
  // setVariables in "Reset" have actually been set.
  const [resetTriggered, setResetTriggered] = useState<boolean>(false);

  // Define separate page sizes
  const apiPageSize = 200; // For API requests
  const clientPageSize = 10; // For client-side pagination
  const maxDaysPerChunk = 120;

  const formatDate = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  const getDateChunks = (
    from: Date,
    to: Date
  ): { start: Date; end: Date }[] => {
    const chunks: { start: Date; end: Date }[] = [];
    let currentStart = new Date(from);
    const finalEnd = new Date(to);

    while (currentStart <= finalEnd) {
      const chunkEnd = new Date(
        currentStart.getTime() + maxDaysPerChunk * 24 * 60 * 60 * 1000 - 1
      );
      chunks.push({
        start: new Date(currentStart),
        end: chunkEnd > finalEnd ? finalEnd : chunkEnd,
      });
      currentStart = new Date(chunkEnd.getTime() + 1);
    }
    return chunks;
  };

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
      if (!response.ok) throw new Error("Failed to fetch users");
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

  const fetchListingsForChunk = async (
    user: string,
    pageIdx: number,
    from: Date,
    to: Date
  ): Promise<Listings> => {
    const params = new URLSearchParams({
      pageSize: apiPageSize.toString(),
      pageIdx: pageIdx.toString(),
      startTo: formatDate(to),
      startFrom: formatDate(from),
    });

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const uri = process.env.NEXT_PUBLIC_LISTINGS_URI;
    const apiUrl = `${apiBaseUrl}/${uri}/${user}?${params.toString()}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status} for user ${user}`);
      }
      const data = await response.json();
      return data.listings as Listings;
    } catch (err) {
      throw new Error(
        `Failed to fetch listings for user ${user}: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  };

  const fetchAllPagesForChunk = async (
    user: string,
    from: Date,
    to: Date
  ): Promise<Listings> => {
    let allItems: Item[] = [];
    let pageIdx = 1;
    let hasMoreItems = true;
    let totalEntries = 0;

    const defaultListings: Listings = {
      XMLName: { Space: "", Local: "" },
      Timestamp: "",
      Ack: "",
      Version: "",
      Build: "",
      PaginationResult: {
        TotalNumberOfPages: 0,
        TotalNumberOfEntries: 0,
      },
      HasMoreItems: false,
      ItemArray: { Items: [] },
      ItemsPerPage: apiPageSize,
      PageNumber: 1,
      ReturnedItemCountActual: 0,
    };

    while (hasMoreItems) {
      const listings = await fetchListingsForChunk(user, pageIdx, from, to);
      allItems = [
        ...allItems,
        ...(Array.isArray(listings.ItemArray.Items)
          ? listings.ItemArray.Items
          : []),
      ];
      hasMoreItems = listings.HasMoreItems;
      totalEntries = listings.PaginationResult.TotalNumberOfEntries;
      pageIdx++;
    }

    return {
      ...defaultListings,
      ItemArray: { Items: allItems },
      ReturnedItemCountActual: allItems.length,
      PaginationResult: {
        TotalNumberOfPages: Math.ceil(totalEntries / clientPageSize),
        TotalNumberOfEntries: totalEntries,
      },
    };
  };

  const fetchListingsForUser = async (user: string) => {
    try {
      setUserLoading((prev) => ({ ...prev, [user]: true }));
      const chunks = getDateChunks(startFrom, startTo);
      const chunkListings: Listings[] = [];

      for (const { start, end } of chunks) {
        const listings = await fetchAllPagesForChunk(user, start, end);
        if (listings.ReturnedItemCountActual > 0) {
          chunkListings.push(listings);
        }
      }

      const mergedItems = chunkListings.flatMap((listing) =>
        Array.isArray(listing.ItemArray.Items) ? listing.ItemArray.Items : []
      );
      const totalEntries = chunkListings.reduce(
        (sum, listing) => sum + listing.PaginationResult.TotalNumberOfEntries,
        0
      );

      const defaultListings: Listings = {
        XMLName: { Space: "", Local: "" },
        Timestamp: "",
        Ack: "",
        Version: "",
        Build: "",
        PaginationResult: {
          TotalNumberOfPages: 0,
          TotalNumberOfEntries: 0,
        },
        HasMoreItems: false,
        ItemArray: { Items: [] },
        ItemsPerPage: apiPageSize,
        PageNumber: 1,
        ReturnedItemCountActual: 0,
      };

      const mergedListings: Listings = {
        ...(chunkListings[0] || defaultListings),
        ItemArray: {
          Items: mergedItems,
        },
        ReturnedItemCountActual: mergedItems.length,
        PaginationResult: {
          TotalNumberOfEntries: totalEntries,
          TotalNumberOfPages: Math.ceil(totalEntries / clientPageSize),
        },
      };

      setUserListings((prev) => ({
        ...prev,
        [user]: mergedListings,
      }));

      setUserTotalPages((prev) => ({
        ...prev,
        [user]: Math.ceil(totalEntries / clientPageSize) || 1,
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Error fetching listings for user ${user}`
      );
    } finally {
      setUserLoading((prev) => ({ ...prev, [user]: false }));
    }
  };

  const handleApply = useCallback(() => {
    if (startFrom > startTo) {
      setDateError("Start date cannot be after end date");
      return;
    }
    setDateError(null);
    setError(null);
    users.forEach((user) => {
      setUserPages((prev) => ({ ...prev, [user]: 1 }));
      fetchListingsForUser(user);
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

  const sizeStyles = {
    small: {
      grid: "grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10",
      imageHeight: "h-[120px]",
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
        className="bg-white p-6 rounded-2xl shadow-md border border-pink-100 mb-8"
      >
        <h2 className="text-2xl text-blue-600 mb-4">{user}</h2>
        <p className="text-xl text-pink-600 mb-8">
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
                      <img
                        src={imageUrl}
                        alt={`Image for ${item.Title}`}
                        className={`w-full ${sizeStyles[displaySize].imageHeight} max-w-full object-contain rounded-lg transition-transform`}
                        onError={(e) => {
                          e.currentTarget.src =
                            sizeStyles[displaySize].placeholder;
                        }}
                      />
                      <div className="text-transform: uppercase absolute bottom-0 left-0 right-0 bg-gradient-to-br from-blue-50 via-pink-50 to-purple-100 text-pink-500 text-center py-2 rounded-b-lg transition-transform">
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
          <p className="text-gray-600 text-lg">
            No items available for {user}. ♡
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={inconsolata.className}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-purple-50 p-8">
        <div className="flex justify-between items-center mb-8 flex-col sm:flex-row gap-4">
          <h1 className="text-4xl text-pink-700 drop-shadow-sm">
            Listings Gallery
          </h1>
        </div>
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-center flex-wrap">
          <div>
            <label className="text-pink-600 text-lg mr-2">From:</label>
            <input
              type="date"
              value={formatDate(startFrom)}
              onChange={(e) => {
                const newDate = new Date(e.target.value);
                if (!isNaN(newDate.getTime())) {
                  setStartFrom(newDate);
                }
              }}
              className="p-2 rounded-lg border border-pink-200 text-blue-600 focus:outline-none focus:ring-2 focus:ring-pink-400"
              max={formatDate(new Date())}
            />
          </div>
          <div>
            <label className="text-pink-600 text-lg mr-2">To:</label>
            <input
              type="date"
              value={formatDate(startTo)}
              onChange={(e) => {
                const newDate = new Date(e.target.value);
                if (!isNaN(newDate.getTime())) {
                  setStartTo(newDate);
                }
              }}
              className="p-2 rounded-lg border border-pink-200 text-blue-600 focus:outline-none focus:ring-2 focus:ring-pink-400"
              max={formatDate(new Date())}
            />
          </div>
          <button
            onClick={handleApply}
            className="px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
          >
            Apply 🌸
          </button>
          <button
            onClick={resetDateRange}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reset ✿
          </button>
          <div className="flex flex-col gap-2 bg-white rounded-lg shadow-md p-1">
            <div>
              <label className="text-pink-600 text-md mr-2">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 rounded-lg border border-pink-200 text-blue-600 focus:outline-none focus:ring-2 focus:ring-pink-400 w-full sm:w-auto"
              >
                <option value="ALL">ALL</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Ended">Ended</option>
              </select>
            </div>
            <div>
              <label className="text-pink-600 text-md mr-2">Size:</label>
              <select
                value={displaySize}
                onChange={(e) =>
                  setDisplaySize(e.target.value as "small" | "medium" | "big")
                }
                className="p-2 rounded-lg border border-pink-200 text-blue-600 focus:outline-none focus:ring-2 focus:ring-pink-400 w-full sm:w-auto"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="big">Big</option>
              </select>
            </div>
          </div>
        </div>
        {dateError && <p className="text-rose-500 text-lg mb-4">{dateError}</p>}
        {error && <p className="text-rose-500 text-lg mb-4">{error}</p>}
        {userLoading.global ? (
          <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
            <p className="text-pink-600 text-lg">Loading Users... ♡</p>
          </div>
        ) : users.length > 0 ? (
          <div>
            {users.map((user) => (
              <div key={user}>
                {userLoading[user] ? (
                  <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
                    <h2 className="text-2xl text-blue-600 mb-4">{user}</h2>
                    <p className="text-pink-600 text-lg">
                      Loading Listings... ♡
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
                  <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
                    <h2 className="text-2xl text-blue-600 mb-4">{user}</h2>
                    <p className="text-gray-600 text-lg">
                      No listings for {user}. ♡
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
                      className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-pink-600 text-lg flex items-center">
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
                      className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-lg">No listings available. ♡</p>
        )}
      </div>
    </div>
  );
}