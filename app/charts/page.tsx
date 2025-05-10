"use client";

import { useState } from "react";
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
  Timestamp: string;
  Ack: string;
  ItemArray: ItemArray;
}

interface ListingsResponse {
  user: string;
  listings: Listings;
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

export default function ListingsValuePage() {
  const [range, setRange] = useState("last-month"); // Default to Last Month
  const [listings, setListings] = useState<ListingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate API date range based on selection
  const today = new Date("2025-05-09"); // Fixed for consistency
  const endDate = new Date(today);
  let startDate = new Date(today);

  if (range === "last-month") {
    startDate.setDate(today.getDate() - 30);
  } else if (range === "last-3-months") {
    startDate.setDate(today.getDate() - 90);
  } else if (range === "last-12-months") {
    startDate.setDate(today.getDate() - 120); // API limit: 120 days
  }

  // Ensure startDate doesn't exceed 120 days
  const maxStartDate = new Date(today);
  maxStartDate.setDate(today.getDate() - 120);
  if (startDate < maxStartDate) {
    startDate = maxStartDate;
  }

  const fetchListings = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      user: "czhang19",
      pageSize: "200",
      pageIdx: "1",
      startFrom: startDate.toISOString().slice(0, 10), // YYYY-MM-DD
      startTo: endDate.toISOString().slice(0, 10),
    });

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const uri = process.env.NEXT_PUBLIC_LISTINGS_FOR_USER_URI;
    const apiUrl = `${apiBaseUrl}/${uri}?${params.toString()}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("Failed to fetch listings");
      const data: ListingsResponse = await response.json();
      setListings(data);
    } catch (err) {
      setError("Failed to fetch listings");
    } finally {
      setLoading(false);
    }
  };

  const chartData = listings
    ? processListingData(listings.listings.ItemArray.Items, startDate, endDate)
    : null;

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
            onClick={fetchListings}
            className="px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
          >
            Fetch Listings 🌸
          </button>
        </div>
        {error && <p className="text-rose-500 text-lg mb-4">{error}</p>}
        {loading && (
          <p className="text-pink-600 text-lg mb-4">Loading Listings... ♡</p>
        )}
        {listings && listings.listings.ItemArray.Items.length === 0 && (
          <p className="text-pink-600 text-lg mb-4">
            No listings found for this time period.
          </p>
        )}
        {chartData && chartData.labels.length > 0 && (
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
                    title: { display: true, text: "Cumulative Value (USD)" },
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
                          `Cumulative Value: $${totalValue.toFixed(2)}`,
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
        )}
      </div>
    </div>
  );
}