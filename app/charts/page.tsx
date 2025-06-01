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
import Payouts from "../payouts/page";

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
        (chart.config.data.datasets[0] as any).crosshairX = elements.length
          ? elements[0].element.x
          : null;
        chart.draw();
      } else if (event.type === "mouseout") {
        (chart.config.data.datasets[0] as any).crosshairX = null;
        chart.draw();
      }
    },
    afterDraw(chart) {
      const { ctx, chartArea } = chart;
      const x = (chart.config.data.datasets[0] as any).crosshairX;
      if (x) {
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
  StartTime: string;
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

interface UserPayouts {
  user: string;
  payouts: PayoutsResponse;
}

interface PayoutsResponse {
  href: string;
  next: string;
  prev: string;
  limit: number;
  offset: number;
  payouts: Payout[];
  total: number;
}

interface Payout {
  payoutId: string;
  payoutStatus: string;
  payoutStatusDescription: string;
  amount: PayoutAmount;
  payoutDate: string;
  lastAttemptedPayoutDate: string;
  transactionCount: number;
  payoutInstrument: PayoutInstrument;
}

interface PayoutAmount {
  value: string;
  currency: string;
}

interface PayoutInstrument {
  instrumentType: string;
  nickname: string;
  accountLastFourDigits: string;
}

const renderUserChart = (user: string, chartData: any) => {
  return (
    <div className="chart-container bg-white p-6 rounded-lg shadow-md container-inline-size">
      <h2 className="text-xl text-blue-600 mb-4">{user}</h2>
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
              title: { display: true, text: "Time" },
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
                  const datasetIndex = context.datasetIndex;
                  const index = context.dataIndex;
                  const totalValue = context.parsed.y ?? 0;
                  const date = new Date(
                    chartData.labels[index]
                  ).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  });
                  if (datasetIndex === 0) {
                    const listing = chartData.listingDetails[index] || {};
                    const price = listing.price ?? 0;
                    return [
                      `Date: ${date}`,
                      `Total Listing Value: $${totalValue.toFixed(2)}`,
                      `${listing.title || "Unknown"} (Qty: ${
                        listing.quantity || 0
                      }, Price: $${price.toFixed(2)})`,
                    ];
                  } else {
                    const payout = chartData.payoutDetails[index] || {};
                    const amount = payout.amount ?? 0;
                    return [
                      `Date: ${date}`,
                      `Total Payout Value: $${totalValue.toFixed(2)}`,
                      `${payout.title || "Unknown"} (Amount: $${amount.toFixed(
                        2
                      )})`,
                    ];
                  }
                },
              },
            },
            datalabels: {
              formatter: (value) =>
                typeof value === "number" ? `$${value.toFixed(2)}` : "$0.00",
              color: (context) =>
                context.datasetIndex === 0 ? "#EC4899" : "#3B82F6",
              align: "top",
              offset: 4,
              font: { size: 12 },
              padding: 4,
            },
            legend: {
              display: true,
              position: "top",
            },
          },
        }}
      />
    </div>
  );
};

// Process listing data for cumulative line chart
const processListingData = (items: Item[], startDate: Date, endDate: Date) => {
  const filteredItems = items.filter((item) => {
    const startTime = new Date(item.ListingDetails.StartTime);
    return startTime >= startDate && startTime <= endDate;
  });

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

  return { labels, data, listingDetails };
};

// Process payout data for cumulative line chart
const processPayoutData = (
  payouts: Payout[],
  startDate: Date,
  endDate: Date
) => {
  const filteredPayouts = payouts.filter((payout) => {
    const payoutTime = new Date(payout.payoutDate);
    return payoutTime >= startDate && payoutTime <= endDate;
  });

  const sortedPayouts = filteredPayouts.sort(
    (a, b) =>
      new Date(a.payoutDate).getTime() - new Date(b.payoutDate).getTime()
  );

  let cumulativeValue = 0;
  const labels: string[] = [];
  const data: number[] = [];
  const payoutDetails: { title: string; amount: number }[] = [];

  sortedPayouts.forEach((payout) => {
    const value = parseFloat(payout.amount.value);
    cumulativeValue += value;
    labels.push(payout.payoutDate);
    data.push(cumulativeValue);
    payoutDetails.push({
      title: payout.payoutId,
      amount: value,
    });
  });

  return { labels, data, payoutDetails };
};

// Combine listing and payout data
const combineChartData = (
  listingData: { labels: string[]; data: number[]; listingDetails: any[] },
  payoutData: { labels: string[]; data: number[]; payoutDetails: any[] }
) => {
  const allLabels = Array.from(
    new Set([...listingData.labels, ...payoutData.labels])
  ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  let lastListingValue = 0;
  const listingInterpolated = allLabels.map((label) => {
    const index = listingData.labels.indexOf(label);
    if (index !== -1) {
      lastListingValue = listingData.data[index];
      return {
        value: lastListingValue,
        detail: listingData.listingDetails[index],
      };
    }
    return {
      value: null,
      detail: { title: "No Listing", quantity: 0, price: 0 },
    };
  });

  let lastPayoutValue = 0;
  const payoutInterpolated = allLabels.map((label) => {
    const index = payoutData.labels.indexOf(label);
    if (index !== -1) {
      lastPayoutValue = payoutData.data[index];
      return {
        value: lastPayoutValue,
        detail: payoutData.payoutDetails[index],
      };
    }
    return { value: null, detail: { title: "No Payout", amount: 0 } };
  });

  return {
    labels: allLabels,
    datasets: [
      {
        label: "Cumulative Listing Value (USD)",
        data: listingInterpolated.map((item) => item.value),
        borderColor: "#EC4899",
        pointBackgroundColor: "#EC4899",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "#EC4899",
        pointRadius: 6,
        pointHoverRadius: 8,
        fill: false,
        crosshairX: null,
      },
      {
        label: "Cumulative Payout Value (USD)",
        data: payoutInterpolated.map((item) => item.value),
        borderColor: "#3B82F6",
        pointBackgroundColor: "#3B82F6",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "#3B82F6",
        pointRadius: 6,
        pointHoverRadius: 8,
        fill: false,
      },
    ],
    listingDetails: listingInterpolated.map((item) => item.detail),
    payoutDetails: payoutInterpolated.map((item) => item.detail),
  };
};

export default function ChartsPage() {
  const [users, setUsers] = useState<string[]>([]);
  const [userCharts, setUserCharts] = useState<{
    [user: string]: ChartData | null;
  }>({});
  const [usersLoading, setUsersLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState<{ [user: string]: boolean }>(
    {}
  );
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [range, setRange] = useState("last-month");
  const [startFrom, setStartFrom] = useState<Date>(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 30);
    return start;
  });
  const [startTo, setStartTo] = useState<Date>(new Date());

  const apiPageSize = 200;
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
      setUsersLoading(true)
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
      setUsersLoading(false)
      setDataLoading((prev) => {
        const newState = {
          ...prev,
          ...usersData.reduce(
            (acc: { [key: string]: boolean }, user) => {
              acc[user] = true;
              return acc;
            },
            {}
          ),
        };
        return newState;
      });
      setUserCharts((prev) => {
        const newState = {
          ...prev,
          ...usersData.reduce(
            (acc: { [key: string]: ChartData | null }, user) => {
              acc[user] = null;
              return acc;
            },
            {}
          ),
        };
        return newState;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch user charts");
      setUsersLoading(false)
      setDataLoading((prev) => {
        return { ...prev, global: false };
      });
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
        throw new Error(`Failed to fetch listings for ${user}: ${response.status}`);
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

  const fetchPayoutsForUser = async (
    user: string,
    pageIdx: number
  ): Promise<UserPayouts> => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const payoutsUri = process.env.NEXT_PUBLIC_PAYOUTS_URI;

    if (!apiBaseUrl || !payoutsUri) {
      throw new Error("API base URL or Payouts URI env not defined");
    }

    const params = new URLSearchParams({
      pageSize: apiPageSize.toString(),
      pageIdx: pageIdx.toString(),
    });

    const apiUrl = `${apiBaseUrl}/${payoutsUri}/${user}?${params.toString()}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch payouts for ${user}: ${response.status}`);
    }
    const data: UserPayouts = await response.json();
    return data;
  };

  const fetchAllPayoutsForUser = async (user: string): Promise<Payout[]> => {
    try {
      let allPayouts: Payout[] = [];
      let pageIdx = 0;
      let hasMorePages = true;

      while (hasMorePages) {
        const pageData = await fetchPayoutsForUser(user, pageIdx);
        const payouts = Array.isArray(pageData.payouts.payouts)
          ? pageData.payouts.payouts
          : [];
        allPayouts = [...allPayouts, ...payouts];
        hasMorePages = pageData.payouts.next !== "" && payouts.length > 0;
        pageIdx++;
      }

      return allPayouts;

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Error fetching payouts for user ${user}`
      );
      return [];
    }
  };

  const fetchAllPagesForListingChunk = async (
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
      PaginationResult: { TotalNumberOfPages: 0, TotalNumberOfEntries: 0 },
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

  const fetchListingsForUser = async (user: string): Promise<Listings> => {
    try {
      const chunks = getDateChunks(startFrom, startTo);
      const chunkListings: Listings[] = [];

      for (const { start, end } of chunks) {
        const listings = await fetchAllPagesForListingChunk(user, start, end);
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
        PaginationResult: { TotalNumberOfPages: 0, TotalNumberOfEntries: 0 },
        HasMoreItems: false,
        ItemArray: { Items: [] },
        ItemsPerPage: apiPageSize,
        PageNumber: 1,
        ReturnedItemCountActual: 0,
      };

      const mergedListings: Listings = {
        ...(chunkListings[0] || defaultListings),
        ItemArray: { Items: mergedItems },
        ReturnedItemCountActual: mergedItems.length,
      };

      return mergedListings;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Error fetching listings for user ${user}`
      );
      return {
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
    }
  };

  const fetchDataForUser = async (user: string) => {
    try {
      setDataLoading((prev) => ({ ...prev, [user]: true }));
      const [listings, payouts] = await Promise.all([
        fetchListingsForUser(user),
        fetchAllPayoutsForUser(user),
      ]);

      const listingData = processListingData(
        listings.ItemArray.Items,
        startFrom,
        startTo
      );
      const payoutData = processPayoutData(
        payouts,
        startFrom,
        startTo
      );

      const chartData = combineChartData(listingData, payoutData);
      setUserCharts((prev) => ({ ...prev, [user]: chartData }));
      setDataLoading((prev) => ({ ...prev, [user]: false }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Error fetching data for ${user}`
      );
      setDataLoading((prev) => ({ ...prev, [user]: false }));
    }
  };

  const handleApply = useCallback(() => {
    if (startFrom > startTo) {
      setDateError("Start date cannot be after end date");
      return;
    }
    setDateError(null);
    setError(null);
    setDataLoading((prev) => {
      const newState = {
        ...prev,
        ...users.reduce(
          (acc: { [key: string]: boolean }, user) => {
            acc[user] = true;
            return acc;
          },
          {}
        ),
      };
      console.log("New dataLoading state:", newState);
      return newState;
    });
    users.forEach((user) => {
      fetchDataForUser(user);
    });
  }, [startFrom, startTo, users]);

  useEffect(() => {
    const today = new Date();
    const newStartTo = new Date(today);
    let newStartFrom = new Date(today);

    if (range === "last-month") {
      newStartFrom.setDate(today.getDate() - 30);
    } else if (range === "last-3-months") {
      newStartFrom.setDate(today.getDate() - 90);
    } else if (range === "last-12-months") {
      newStartFrom.setDate(today.getDate() - 365);
    }

    setStartFrom(newStartFrom);
    setStartTo(newStartTo);
  }, [range]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (users.length > 0 && isInitialLoad) {
      handleApply();
      setIsInitialLoad(false);
    }
  }, [users, isInitialLoad, handleApply]);

  useEffect(() => {
    console.log("dataLoading changed:", dataLoading, userCharts);
  }, [dataLoading]);

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
          Listings and Payouts Value Tracker
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
        {error && <p className="text-rose-500 text-lg mb-4 hidden">{error}</p>}
        {usersLoading ? (
          <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
            <p className="text-pink-600 text-lg">Loading Users... ♡</p>
          </div>
        ) : users.length > 0 ? (
          dataLoading ? (
          <div>
            {users.map((user) => (
              <div key={user}>
                {dataLoading[user] ? (
                  <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
                    <h2 className="text-2xl text-blue-600 mb-4">{user}</h2>
                    <p className="text-pink-600 text-lg">Loading Data... ♡</p>
                  </div>
                ) : userCharts[user] &&
                  userCharts[user]?.labels?.length &&
                  userCharts[user]?.labels?.length > 0 &&
                  userCharts[user]?.datasets?.some(
                    (d: any) => d.data.length > 0
                  ) ? (
                  renderUserChart(user, userCharts[user])
                ) : (
                  <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
                    <h2 className="text-2xl text-blue-600 mb-4">{user}</h2>
                    <p className="text-gray-600 text-lg">
                      No data for {user}. ♡
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : 
          <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
            <p className="text-gray-600 text-lg">No data available. ♡</p>
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