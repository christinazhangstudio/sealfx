"use client";

import { useState, useEffect, useCallback } from "react";
import { Inconsolata } from "next/font/google";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartEvent,
  ChartData,
} from "chart.js";
import "chartjs-adapter-moment";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartDataLabels,
  {
    id: "customCrosshair",
    afterEvent(chart, args: { event: ChartEvent }) {
      const event = args.event;
      if (event.type === "mousemove" && event.native) {
        const elements = chart.getElementsAtEventForMode(
          event.native,
          "nearest",
          { intersect: false, axis: "x" },
          true
        );
        (chart.config.data.datasets[0] as any).crosshairX = elements.length ? elements[0].element.x : null;
        chart.draw();
      } else if (event.type === "mouseout") {
        (chart.config.data.datasets[0] as any).crosshairX = null;
        chart.draw();
      }
    },
    afterDraw(chart) {
      const { ctx, chartArea } = chart;
      const x = (chart.config.data.datasets[0] as any).crosshairX;
      if (true) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = "#EC4899";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.restore();
      }
    },
  }
);

const inconsolata = Inconsolata({ weight: "500", subsets: ["latin"] });

interface Amount {
  Value: number;
  CurrencyID: string;
}

interface SellingStatus {
  CurrentPrice: Amount;
  ListingStatus: string;
}

interface ListingDetails {
  StartTime: string; // e.g., "2024-12-24T17:12:12.000Z"
  EndTime: string;
  ViewItemURL: string;
}

interface Item {
  ItemID: string;
  Title: string;
  Quantity: number;
  SellingStatus: SellingStatus;
  ListingDetails: ListingDetails;
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

const renderUserChart = (
  chartData: any
) => {
  return (
    <div className="chart-container bg-white p-6 rounded-lg shadow-md container-inline-size">
      <h2 className="text-xl text-blue-600 mb-4">Cumulative Listing Value Over Time</h2>
      <Line
        data={chartData}
        options={{
          responsive: true,
          scales: {
            x: {
              type: "time",
              time: {
                unit: "day",
                displayFormats: { day: "MMM D" },
              },
              title: { display: true, text: "Start Time" },
            },
            y: {
              beginAtZero: true,
              title: { display: true, text: "Total Value (USD)" },
            },
          },
          plugins: {
            tooltip: {
              mode: "nearest",
              axis: "x",
              intersect: false,
              callbacks: {
                label: (context) => {
                  const index = context.dataIndex;
                  const listing = chartData.listingDetails[index];
                  const totalValue = context.parsed.y;
                  const date = new Date(chartData.labels[index]).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  });
                  return [
                    `Date: ${date}`,
                    `Total Value: $${totalValue.toFixed(2)}`,
                    `${listing.title} (Qty: ${listing.quantity}, Price: $${listing.price.toFixed(2)})`,
                  ];
                },
              },
            },
            datalabels: {
              formatter: (value) => `$${value.toFixed(2)}`,
              color: "#EC4899",
              align: "top",
              offset: 4,
              font: { size: 12 },
              padding: 4,
            },
          },
        }}
      />
    </div>
  )
}

// Process data for cumulative line chart (one point per listing)
const processListingData = (items: Item[], startDate: Date, endDate: Date) => {
  // Filter items within date range
  const filteredItems = items.filter((item) => {
    const startTime = new Date(item.ListingDetails.StartTime);
    return startTime >= startDate && startTime <= endDate;
  });

  // Sort by StartTime and prepare data
  const sortedItems = filteredItems.sort(
    (a, b) =>
      new Date(a.ListingDetails.StartTime).getTime() -
      new Date(b.ListingDetails.StartTime).getTime()
  );

  let cumulativeValue = 0;
  const labels: string[] = [];
  const data: number[] = [];
  const listingDetails: { title: string; quantity: number; price: number }[] = [];

  sortedItems.forEach((item) => {
    const value = item.SellingStatus.CurrentPrice.Value * item.Quantity;
    cumulativeValue += value;
    labels.push(item.ListingDetails.StartTime);
    data.push(cumulativeValue);
    listingDetails.push({
      title: item.Title,
      quantity: item.Quantity,
      price: item.SellingStatus.CurrentPrice.Value,
    });
  });

  return {
    labels,
    datasets: [
      {
        label: "Cumulative Listing Value (USD)",
        data,
        borderColor: "#EC4899",
        backgroundColor: "rgba(236, 72, 153, 0.2)",
        pointBackgroundColor: "#EC4899",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "#EC4899",
        fill: false,
        crosshairX: null,
      },
    ],
    listingDetails,
  };
};

export default function ChartsPage() {
    const [range, setRange] = useState("last-month");
    const [listings, setListings] = useState<ListingsResponse | null>(null);
    const [loading, setLoading] = useState(false);
  
    const today = new Date();
    const startTo = new Date(today);
    let startFrom = new Date(today);
  
    if (range === "last-month") {
      startFrom.setDate(today.getDate() - 30);
    } else if (range === "last-3-months") {
      startFrom.setDate(today.getDate() - 90);
    } else if (range === "last-12-months") {
      startFrom.setDate(today.getDate() - 356);
    }

  const [users, setUsers] = useState<string[]>([]);
    const [userListings, setUserListings] = useState<{
      [user: string]: Listings;
    }>({});
    const [userCharts, setUserCharts] = useState<{
        [user: string]: ChartData | null;
      }>({});
    const [userLoading, setUserLoading] = useState<{ [user: string]: boolean }>(
      {}
    );
    const [error, setError] = useState<string | null>(null);
    const [dateError, setDateError] = useState<string | null>(null);
    const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
    const [resetTriggered, setResetTriggered] = useState<boolean>(false);
  
    const apiPageSize = 200; // For API requests
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
  
        const initialLoading = usersData.reduce((acc, user) => {
          acc[user] = false;
          return acc;
        }, {} as { [user: string]: boolean });
  
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
        user,
        pageSize: apiPageSize.toString(),
        pageIdx: pageIdx.toString(),
        startTo: formatDate(to),
        startFrom: formatDate(from),
      });
  
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      const uri = process.env.NEXT_PUBLIC_LISTINGS_FOR_USER_URI;
      const apiUrl = `${apiBaseUrl}/${uri}?${params.toString()}`;
  
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
        pageIdx++;
      }
  
      return {
        ...defaultListings,
        ItemArray: { Items: allItems },
        ReturnedItemCountActual: allItems.length,
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
        };
  
        setUserListings((prev) => ({
          ...prev,
          [user]: mergedListings,
        }));

        const chartData = mergedListings
        ? processListingData(mergedListings.ItemArray.Items, startFrom, startTo)
        : null;
    
        setUserCharts((prev) => ({...prev, [user]: chartData}));
  
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
        fetchListingsForUser(user);
      });
    }, [startFrom, startTo, users]);
  
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

  return (
    <div className={inconsolata.className}>
      <style jsx>{`
        .container-inline-size {
          container-type: inline-size;
        }
        @container (min-width: 800px) {
          .chart-container {
            max-width: 896px;
            margin-left: auto;
            margin-right: auto;
          }
        }
        @supports not (container-type: inline-size) {
          @media (min-width: 1024px) {
            .chart-container {
              max-width: 896px;
              margin-left: auto;
              margin-right: auto;
            }
          }
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-purple-50 p-8">
        <h1 className="text-4xl text-pink-700 mb-8 drop-shadow-sm">
          Listings Value Tracker
        </h1>
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-center justify-center sm:justify-start flex-wrap">
          <div>
            <label className="text-pink-600 text-lg mr-2">Range:</label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="p-2 rounded-lg border border-pink-200 text-blue-600 focus:outline-none focus:ring-2 focus:ring-pink-400"
            >
              <option value="last-month">Last Month</option>
              <option value="last-3-months">Last 3 Months</option>
              <option value="last-12-months">Last 12 Months</option>
            </select>
          </div>
          <button
            onClick={handleApply}
            className="px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
          >
            Apply 🌸
          </button>
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
                  renderUserChart(
                    userCharts[user]
                  )
                ) : (
                  <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
                    <h2 className="text-2xl text-blue-600 mb-4">{user}</h2>
                    <p className="text-gray-600 text-lg">
                      No listings for {user}. ♡
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
            <p className="text-gray-600 text-lg">No users available. ♡</p>
          </div>
        )}
      </div>
    </div>
  );
}