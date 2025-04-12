"use client"; // Next.js 13+ App Router client component

// app/listings/page.tsx
import { useState, useEffect } from "react";
import { Inconsolata } from "next/font/google";

// Initialize Inconsolata font
const inconsolata = Inconsolata({ subsets: ["latin"] });

// Define TypeScript interfaces
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
  const [galleryIndices, setGalleryIndices] = useState<{
    [itemID: string]: number;
  }>({});
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
    console.log(
      "Date chunks:",
      chunks.map((c) => `${formatDate(c.start)} to ${formatDate(c.end)}`)
    );
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

    while (hasMore) {
      const url = `http://localhost:443/api/get-listings?pageSize=${pageSize}&pageIdx=${pageIdx}&startFrom=${formatDate(
        from
      )}&startTo=${formatDate(to)}`;
      console.log("Fetching:", url);

      const res = await fetch(url);
      console.log("Response status:", res.status, "OK:", res.ok);

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

      console.log("API Response:", data);

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

      console.log(
        `Chunk ${formatDate(from)} to ${formatDate(to)}, Page ${
          pageIdx - 1
        }: Fetched ${validData.length} items, HasMore: ${hasMore}`
      );
    }

    return allData;
  };

  // Fetch all listings for the entire date range
  const fetchAllListings = async (from: Date, to: Date) => {
    if (!validateDateRange(from, to)) return;

    setLoading(true);
    setError(null);
    setListings([]);
    setGalleryIndices({});

    try {
      const chunks = getDateChunks(from, to);
      let allListings: ListingsResponse[] = [];

      for (const { start, end } of chunks) {
        console.log(
          `Processing chunk: ${formatDate(start)} to ${formatDate(end)}`
        );
        const chunkData = await fetchAllPagesForChunk(start, end);
        allListings = [...allListings, ...chunkData];
      }

      setListings(allListings);
      console.log("Total responses fetched:", allListings.length);
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

  // Gallery navigation
  const handleGalleryNav = (
    itemID: string,
    direction: "next" | "prev",
    pictureCount: number
  ) => {
    setGalleryIndices((prev) => {
      const currentIndex = prev[itemID] || 0;
      let newIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
      if (newIndex < 0) newIndex = pictureCount - 1;
      if (newIndex >= pictureCount) newIndex = 0;
      return { ...prev, [itemID]: newIndex };
    });
  };

  // Flatten all items and apply status filter
  const allItems = listings
    .flatMap((listing) => listing.listings?.ItemArray?.Items || [])
    .filter(
      (item) =>
        statusFilter === "ALL" ||
        item.SellingStatus.ListingStatus === statusFilter
    );

  const uniqueUsers = [
    ...new Set(listings.map((listing) => listing.user)),
  ].join(", ");
  const totalItems = allItems.length;

  return (
    <div className={inconsolata.className}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-purple-50 p-8">
        <h1 className="text-4xl text-pink-700 mb-8 drop-shadow-sm">Listings</h1>
        {/* Date Range and Status Filter Inputs */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-center">
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
          <div className="bg-white p-6 rounded-2xl shadow-md border border-pink-100">
            <h2 className="text-3xl text-pink-600 mb-4">
              User{uniqueUsers.includes(",") ? "s" : ""}: {uniqueUsers} 🌸
            </h2>
            <p className="text-2xl text-pink-600 mb-8">
              Total Items: {totalItems} 📦
            </p>
            {allItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xl text-blue-600 border-collapse">
                  <thead>
                    <tr className="border-b border-pink-100">
                      <th className="py-2 text-left w-[100px] min-w-[220px]">
                        <span className="text-pink-500 mr-2">✦</span>
                        Thumbnail
                      </th>
                      <th className="py-2 text-left min-w-[200px]">
                        <span className="text-pink-500 mr-2">✦</span>
                        Title
                      </th>
                      <th className="py-2 text-left w-1/5 min-w-[200px] pl-[38px]">
                        <span className="text-pink-500 mr-2">✦</span>
                        Start Time
                      </th>
                      <th className="py-2 text-left w-1/5 min-w-[150px]">
                        <span className="text-pink-500 mr-2">✦</span>
                        End Time
                      </th>
                      <th className="py-2 text-left w-[100px] min-w-[100px]">
                        <span className="text-pink-500 mr-2">✦</span>
                        Price
                      </th>
                      <th className="py-2 text-left w-[80px] min-w-[80px]">
                        <span className="text-pink-500 mr-2">✦</span>
                        Qty
                      </th>
                      <th className="py-2 text-left w-[120px] min-w-[120px]">
                        <span className="text-pink-500 mr-2">✦</span>
                        Status
                      </th>
                      <th className="py-2 text-left w-1/4 min-w-[200px]">
                        <span className="text-pink-500 mr-2">✦</span>
                        Category
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allItems.map((item) => {
                      const currentImageIndex =
                        galleryIndices[item.ItemID] || 0;
                      const pictureURLs =
                        item.PictureDetails?.PictureURLs || [];
                      return (
                        <tr
                          key={item.ItemID}
                          className="border-b border-pink-100"
                        >
                          <td className="py-2">
                            {pictureURLs.length > 0 ? (
                              <div className="flex items-center gap-2 relative">
                                <button
                                  onClick={() =>
                                    handleGalleryNav(
                                      item.ItemID,
                                      "prev",
                                      pictureURLs.length
                                    )
                                  }
                                  disabled={pictureURLs.length <= 1}
                                  className={`p-1 rounded-full ${
                                    pictureURLs.length <= 1
                                      ? "bg-gray-200 cursor-not-allowed"
                                      : "bg-pink-200 hover:bg-pink-300"
                                  }`}
                                  aria-label="Previous image"
                                >
                                  ←
                                </button>
                                <div className="relative">
                                  <img
                                    src={pictureURLs[currentImageIndex]}
                                    alt={`Thumbnail for ${item.Title}`}
                                    className="w-[100px] h-[100px] object-contain"
                                    onError={(e) => {
                                      e.currentTarget.src =
                                        "https://via.placeholder.com/100?text=No+Image";
                                    }}
                                  />
                                  <a
                                    href={pictureURLs[currentImageIndex]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute top-0 right-0 bg-pink-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-pink-700"
                                    title="Open image in new tab"
                                    aria-label="Open image in new tab"
                                  >
                                    ↗
                                  </a>
                                </div>
                                <button
                                  onClick={() =>
                                    handleGalleryNav(
                                      item.ItemID,
                                      "next",
                                      pictureURLs.length
                                    )
                                  }
                                  disabled={pictureURLs.length <= 1}
                                  className={`p-1 rounded-full ${
                                    pictureURLs.length <= 1
                                      ? "bg-gray-200 cursor-not-allowed"
                                      : "bg-pink-200 hover:bg-pink-300"
                                  }`}
                                  aria-label="Next image"
                                >
                                  →
                                </button>
                              </div>
                            ) : (
                              <img
                                src="https://via.placeholder.com/100?text=No+Image"
                                alt="No image available"
                                className="w-[100px] h-[100px] object-contain"
                              />
                            )}
                          </td>
                          <td className="py-2 max-w-[280px] truncate">
                              <a
                                href={item.ListingDetails.ViewItemURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate"
                                title={item.Title}
                              >
                                {item.Title}
                              </a>
                          </td>
                          <td className="py-2 pl-[38px]">
                            {new Date(
                              item.ListingDetails.StartTime
                            ).toLocaleDateString()}
                          </td>
                          <td className="py-2">
                            {new Date(
                              item.ListingDetails.EndTime
                            ).toLocaleDateString()}
                          </td>
                          <td className="py-2">
                            ${item.SellingStatus.CurrentPrice.Value.toFixed(2)}
                          </td>
                          <td className="py-2">{item.Quantity}</td>
                          <td className="py-2">
                            {item.SellingStatus.ListingStatus}
                          </td>
                          <td className="py-2 truncate">
                            {item.PrimaryCategory.CategoryName}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-pink-600 text-lg">No items available. ♡</p>
            )}
          </div>
        ) : (
          <p className="text-pink-600 text-lg">No Listings available. ♡</p>
        )}
      </div>
    </div>
  );
}
