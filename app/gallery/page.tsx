"use client"; // Next.js 13+ App Router client component

// app/listings/page.tsx
import { useState, useEffect } from "react";
import { Inconsolata } from "next/font/google";

const inconsolata = Inconsolata({
  weight: "500",
});

// Interfaces remain unchanged
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
  const [listings, setListings] = useState<ListingsResponse[]>([]);
  const [startFrom, setStartFrom] = useState<Date>(
    new Date(new Date().setDate(new Date().getDate() - 120))
  );
  const [startTo, setStartTo] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState<"small" | "medium" | "big">(
    "small"
  );
  const pageSize = 10;
  const maxDaysPerChunk = 120;

  // Format dates for API (YYYY-MM-DD)
  const formatDate = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  // Validate date range
  const validateDateRange = (from: Date, to: Date): boolean => {
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      setDateError("Invalid date selected. ♡");
      return false;
    }
    if (to < from) {
      setDateError("End date must be after start date. ♡");
      return false;
    }
    setDateError(null);
    return true;
  };

  // Split date range into 120-day chunks
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

  // Fetch all listings for a single chunk (all pages)
  const fetchAllPagesForChunk = async (
    from: Date,
    to: Date
  ): Promise<ListingsResponse[]> => {
    let allData: ListingsResponse[] = [];
    let pageIdx = 0;
    let hasMore = true;

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const uri = process.env.NEXT_PUBLIC_LISTINGS_URI;
    if (!apiBaseUrl) {
      throw new Error("API base URL env not defined");
    }

    if (!uri) {
      throw new Error("URI env not defined");
    }

    const apiUrl = `${apiBaseUrl}/${uri}`;

    while (hasMore) {
      const url = `${apiUrl}?pageSize=${pageSize}&pageIdx=${pageIdx}&startFrom=${formatDate(
        from
      )}&startTo=${formatDate(to)}`;

      const res = await fetch(url);

      if (!res.ok) {
        let errData;
        try {
          errData = await res.json();
        } catch (jsonErr) {
          errData = { message: `HTTP error ${res.status}` };
        }
        throw new Error(errData.message || `HTTP error ${res.status}`);
      }

      let data: ListingsResponse[];
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error("Invalid JSON response");
      }

      if (!Array.isArray(data)) {
        console.warn("Received non-array response:", data);
        break;
      }

      const validData = data.filter(
        (item): item is ListingsResponse =>
          item != null &&
          typeof item === "object" &&
          "user" in item &&
          "listings" in item &&
          item.listings != null &&
          typeof item.listings.ReturnedItemCountActual === "number" &&
          item.listings.ItemArray != null
      );

      allData = [...allData, ...validData];
      hasMore =
        validData.length > 0 &&
        validData.some((item) => item.listings.HasMoreItems);
      pageIdx += 1;
    }

    return allData;
  };

  // Fetch all listings for the entire date range
  const fetchAllListings = async (from: Date, to: Date) => {
    if (!validateDateRange(from, to)) return;

    setLoading(true);
    setError(null);
    setListings([]);

    try {
      const chunks = getDateChunks(from, to);
      let allListings: ListingsResponse[] = [];

      for (const { start, end } of chunks) {
        const chunkData = await fetchAllPagesForChunk(start, end);
        allListings = [...allListings, ...chunkData];
      }

      setListings(allListings);
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(`Error fetching listings: ${err.message || "Unknown error"}. ♡`);
    } finally {
      setLoading(false);
    }
  };

  // Handle date range and filter submission
  const handleApply = () => {
    fetchAllListings(startFrom, startTo);
  };

  // Reset to default range
  const resetDateRange = () => {
    const defaultStart = new Date(
      new Date().setDate(new Date().getDate() - 120)
    );
    const defaultEnd = new Date();
    setStartFrom(defaultStart);
    setStartTo(defaultEnd);
    setStatusFilter("ALL");
    setDateError(null);
    fetchAllListings(defaultStart, defaultEnd);
  };

  // Initial fetch
  useEffect(() => {
    fetchAllListings(startFrom, startTo);
  }, []);

  // Define grid and image styles based on display size
  const sizeStyles = {
    small: {
      grid: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
      imageHeight: "h-[150px]",
      captionSize: "text-sm",
      placeholder: "https://via.placeholder.com/150?text=No+Image",
    },
    medium: {
      grid: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
      imageHeight: "h-[300px]",
      captionSize: "text-s",
      placeholder: "https://via.placeholder.com/300?text=No+Image",
    },
    big: {
      grid: "grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      imageHeight: "h-[450px]",
      captionSize: "text-lg",
      placeholder: "https://via.placeholder.com/450?text=No+Image",
    },
  };

  // Render gallery for a single user
  const renderUserGallery = (user: string, items: Item[]) => {
    // Apply status filter to user's items
    const filteredItems = items.filter(
      (item) =>
        statusFilter === "ALL" ||
        item.SellingStatus.ListingStatus === statusFilter
    );

    return (
      <div
        key={user}
        className="bg-white p-6 rounded-2xl shadow-md border border-pink-100 mb-8"
      >
        <h2 className="text-3xl text-pink-600 mb-4">User: {user} 🌸</h2>
        <p className="text-2xl text-pink-600 mb-8">
          Total Items: {filteredItems.length} 📦
        </p>
        {filteredItems.length > 0 ? (
          <div className={`grid ${sizeStyles[displaySize].grid} gap-6`}>
            {filteredItems.map((item) => {
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
                        className={`w-full ${sizeStyles[displaySize].imageHeight} object-cover rounded-lg transition-transform`}
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
          <p className="text-pink-600 text-lg">
            No items available for {user}. ♡
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={inconsolata.className}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-purple-50 p-8">
        <h1 className="text-4xl text-pink-700 mb-8 drop-shadow-sm">
          Listings Gallery
        </h1>
        {/* Date Range, Status Filter, and Size Selector Inputs */}
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
          <div>
            <label className="text-pink-600 text-lg mr-2">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 rounded-lg border border-pink-200 text-blue-600 focus:outline-none focus:ring-2 focus:ring-pink-400"
            >
              <option value="ALL">ALL</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="Ended">Ended</option>
            </select>
          </div>
          <div>
            <label className="text-pink-600 text-lg mr-2">Size:</label>
            <select
              value={displaySize}
              onChange={(e) =>
                setDisplaySize(e.target.value as "small" | "medium" | "big")
              }
              className="p-2 rounded-lg border border-pink-200 text-blue-600 focus:outline-none focus:ring-2 focus:ring-pink-400"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="big">Big</option>
            </select>
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
        </div>
        {dateError && <p className="text-rose-500 text-lg mb-4">{dateError}</p>}
        <p className="text-xl text-pink-600 mb-4">
          Showing data from {formatDate(startFrom)} to {formatDate(startTo)} 📅
          {statusFilter !== "ALL" && ` (Filtered by ${statusFilter} status)`}
        </p>
        {loading ? (
          <p className="text-pink-600 text-lg">Loading Listings... ♡</p>
        ) : error ? (
          <p className="text-rose-500 text-lg">{error}</p>
        ) : listings.length > 0 ? (
          <div>
            {listings
              .reduce((acc: { user: string; items: Item[] }[], listing) => {
                const existing = acc.find((group) => group.user === listing.user);
                const items = listing.listings?.ItemArray?.Items || [];
                if (existing) {
                  existing.items.push(...items);
                } else {
                  acc.push({ user: listing.user, items });
                }
                return acc;
              }, [])
              .map(({ user, items }) => renderUserGallery(user, items))}
          </div>
        ) : (
          <p className="text-pink-600 text-lg">No listings available. ♡</p>
        )}
      </div>
    </div>
  );
}