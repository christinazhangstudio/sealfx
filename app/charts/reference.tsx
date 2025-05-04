"use client";

import { useState } from "react";
import { Inconsolata } from "next/font/google";
import { Line, Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const inconsolata = Inconsolata({ weight: "500", subsets: ["latin"] });

// TypeScript interfaces
interface Payout {
  id: string;
  amount: number;
  currency: string;
  date: string; // e.g., "2025-01-05"
  status: "PAID" | "SENT" | "FAILED";
  type: "CHARGE" | "FEE" | "DEPOSIT_FEE";
}

interface PayoutsResponse {
  month: string; // e.g., "2025-01"
  payouts: Payout[];
  totalAmount: number;
  totalCount: number;
}

// Mock API response
const mockPayouts: PayoutsResponse = {
  month: "2025-01",
  payouts: [
    { id: "p1", amount: 1000, currency: "USD", date: "2025-01-05", status: "PAID", type: "CHARGE" },
    { id: "p2", amount: 500, currency: "USD", date: "2025-01-05", status: "SENT", type: "FEE" },
    { id: "p3", amount: 750, currency: "USD", date: "2025-01-10", status: "PAID", type: "CHARGE" },
    { id: "p4", amount: 200, currency: "USD", date: "2025-01-15", status: "FAILED", type: "DEPOSIT_FEE" },
    { id: "p5", amount: 1200, currency: "USD", date: "2025-01-20", status: "PAID", type: "CHARGE" },
  ],
  totalAmount: 3650,
  totalCount: 5,
};

// Process data for charts
const processPayoutData = (payouts: Payout[]) => {
  // Line Chart: Daily totals
  const dailyTotals: { [date: string]: number } = {};
  payouts.forEach((p) => {
    dailyTotals[p.date] = (dailyTotals[p.date] || 0) + p.amount;
  });
  const lineData = {
    labels: Object.keys(dailyTotals).sort(),
    datasets: [
      {
        label: "Daily Payouts (USD)",
        data: Object.values(dailyTotals),
        borderColor: "#EC4899",
        backgroundColor: "rgba(236, 72, 153, 0.2)",
        fill: true,
      },
    ],
  };

  // Bar Chart: By status
  const statusTotals: { [status: string]: number } = {};
  payouts.forEach((p) => {
    statusTotals[p.status] = (statusTotals[p.status] || 0) + p.amount;
  });
  const barData = {
    labels: Object.keys(statusTotals),
    datasets: [
      {
        label: "Payouts by Status (USD)",
        data: Object.values(statusTotals),
        backgroundColor: ["#3B82F6", "#EC4899", "#EF4444"],
      },
    ],
  };

  // Pie Chart: By type
  const typeTotals: { [type: string]: number } = {};
  payouts.forEach((p) => {
    typeTotals[p.type] = (typeTotals[p.type] || 0) + p.amount;
  });
  const pieData = {
    labels: Object.keys(typeTotals),
    datasets: [
      {
        label: "Payouts by Type",
        data: Object.values(typeTotals),
        backgroundColor: ["#3B82F6", "#EC4899", "#8B5CF6"],
      },
    ],
  };

  return { lineData, barData, pieData };
};

export default function PayoutsPage() {
  const [month, setMonth] = useState("2025-01");
  const [payouts, setPayouts] = useState<PayoutsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPayouts = async () => {
    setLoading(true);
    setError(null);
    try {
      // Mock API call
      const data = await new Promise<PayoutsResponse>((resolve) =>
        setTimeout(() => resolve(mockPayouts), 500)
      );
      // Real API call (uncomment when ready):
      // const response = await fetch(`/api/payouts?month=${month}`);
      // if (!response.ok) throw new Error("Failed to fetch payouts");
      // const data: PayoutsResponse = await response.json();
      setPayouts(data);
    } catch (err) {
      setError("Failed to fetch payouts");
    } finally {
      setLoading(false);
    }
  };

  const chartData = payouts ? processPayoutData(payouts.payouts) : null;

  return (
    <div className={inconsolata.className}>
      <style jsx>{`
        .container-inline-size {
          container-type: inline-size;
        }
        @container (min-width: 800px) {
          .graphs-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          }
        }
        @supports not (container-type: inline-size) {
          @media (min-width: 1024px) {
            .graphs-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            }
          }
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-purple-50 p-8">
        <h1 className="text-4xl text-pink-700 mb-8 drop-shadow-sm">
          Payouts Dashboard
        </h1>
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-center justify-center sm:justify-start flex-wrap container-inline-size">
          <div>
            <label className="text-pink-600 text-lg mr-2">Month:</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="p-2 rounded-lg border border-pink-200 text-blue-600 focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>
          <button
            onClick={fetchPayouts}
            className="px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
          >
            Fetch Payouts 🌸
          </button>
        </div>
        {error && <p className="text-rose-500 text-lg mb-4">{error}</p>}
        {loading && (
          <p className="text-pink-600 text-lg mb-4">Loading Payouts... ♡</p>
        )}
        {chartData && (
          <div className="graphs-grid flex flex-col gap-6 container-inline-size">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl text-blue-600 mb-4">Daily Payouts</h2>
              <Line
                data={chartData.lineData}
                options={{
                  responsive: true,
                  scales: {
                    y: { beginAtZero: true, title: { display: true, text: "Amount (USD)" } },
                    x: { title: { display: true, text: "Date" } },
                  },
                }}
              />
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl text-blue-600 mb-4">Payouts by Status</h2>
              <Bar
                data={chartData.barData}
                options={{
                  responsive: true,
                  scales: {
                    y: { beginAtZero: true, title: { display: true, text: "Amount (USD)" } },
                    x: { title: { display: true, text: "Status" } },
                  },
                }}
              />
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl text-blue-600 mb-4">Payouts by Type</h2>
              <Pie
                data={chartData.pieData}
                options={{
                  responsive: true,
                  plugins: { legend: { position: "top" } },
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}