"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import LoginCtaBanner from "@/components/LoginCtaBanner";
import {
  fetchAllListings,
  fetchAllPayouts,
  ReauthRequiredError,
  MAX_DAYS_PER_CHUNK,
  formatApiDate,
} from "@/lib/ebay-data";
import UserTableOfContents from "@/components/UserTableOfContents";
import { Inconsolata } from "next/font/google";
import { useUsers } from "@/components/UsersContext";
import { formatCurrency } from "@/lib/format-utils";
import { Line } from "react-chartjs-2";
import PageHeader from "@/components/PageHeader";
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
import {
  processListingData,
  processPayoutData,
  combineChartData,
  Item,
  Payout,
  Listings,
  UserPayouts
} from "@/lib/chart-utils";
import { useTheme } from "next-themes";

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
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-chart-1').trim() || "#EC4899";
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



// Types moved to lib/chart-utils.ts

const renderUserChart = (user: string, chartData: any) => {
  const isServer = typeof window === "undefined";
  const style = !isServer ? getComputedStyle(document.documentElement) : null;
  const textColor = style?.getPropertyValue("--color-chart-axis-text").trim() || "#333333";
  const gridColor = style?.getPropertyValue("--color-chart-axis-grid").trim() || "#e0e0e040";

  return (
    <div className="seller-card">
      <h2 className="seller-card-title">{user} 🌸</h2>
      <div className="relative h-[350px] sm:h-[450px] md:h-[500px]">
        <Line
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                type: "time",
                offset: false,
                time: {
                  unit: "day",
                  displayFormats: { day: "MMM D" },
                },
                title: {
                  display: true,
                  text: "Time",
                  color: textColor,
                  font: { weight: "bold" }
                },
                ticks: {
                  color: textColor,
                },
                grid: {
                  color: gridColor,
                }
              },
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: "Total Value",
                  color: textColor,
                  font: { weight: "bold" }
                },
                ticks: {
                  color: textColor,
                },
                grid: {
                  color: gridColor,
                }
              },
            },
            plugins: {
              tooltip: {
                mode: "nearest",
                axis: "x",
                intersect: false,
                callbacks: {
                  label: (context) => {
                    if (!context.raw) return "";
                    const datasetIndex = context.datasetIndex;
                    const rawData = context.raw as { x: string; y: number; detail: any };
                    const totalValue = rawData.y ?? 0;
                    const dateString = rawData.x;

                    if (!dateString) return "";

                    const date = new Date(dateString).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    });

                    if (datasetIndex === 0) {
                      const listing = rawData.detail || {};
                      const price = listing.price ?? 0;
                      return [
                        `Date: ${date}`,
                        `Total Listing Value: $${formatCurrency(totalValue)}`,
                        `${listing.title || "Unknown"} (Qty: ${listing.quantity || 0
                        }, Price: $${formatCurrency(price)})`,
                      ];
                    } else {
                      const payout = rawData.detail || {};
                      const amount = payout.amount ?? 0;
                      return [
                        `Date: ${date}`,
                        `Total Payout Value: $${formatCurrency(totalValue)}`,
                        `${payout.title || "Unknown"} (Amount: $${formatCurrency(amount)})`,
                      ];
                    }
                  },
                },
              },
              datalabels: {
                formatter: (value) => {
                  const yValue = (value && typeof value === "object") ? (value as any).y : value;
                  return typeof yValue === "number" ? `$${formatCurrency(yValue)}` : "$0.00";
                },
                color: (context) => {
                  if (typeof window === 'undefined') return "#000";
                  const style = getComputedStyle(document.documentElement);
                  return context.datasetIndex === 0
                    ? style.getPropertyValue('--color-chart-1').trim() || "#EC4899"
                    : style.getPropertyValue('--color-chart-2').trim() || "#3B82F6";
                },
                align: "top",
                offset: 4,
                font: { size: 10 }, // Smaller font for data labels on mobile
                padding: 4,
              },
              legend: {
                display: true,
                position: "top",
                labels: {
                  boxWidth: 12,
                  padding: 10,
                  color: textColor,
                  font: {
                    size: 11
                  }
                }
              },
            },
          }}
        />
      </div>
    </div>
  );
};

// Logic moved to lib/chart-utils.ts

export default function ChartsPage() {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Supersede any in-flight crawl when a new one starts, and stop it on unmount.
  const fetchAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => fetchAbortRef.current?.abort(), []);
  const { users, loadingUsers: usersLoading } = useUsers();
  const [userCharts, setUserCharts] = useState<{
    [user: string]: ChartData | null;
  }>({});
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
  const { theme } = useTheme();

  const apiPageSize = 200;

  const fetchListingsForUser = async (
    user: string,
    signal?: AbortSignal,
  ): Promise<Listings> => {
    const { items } = await fetchAllListings(user, startFrom, startTo, { signal });
    return {
      PaginationResult: {
        TotalNumberOfEntries: items.length,
        TotalNumberOfPages: 1,
      },
      HasMoreItems: false,
      ItemArray: { Items: items },
      ItemsPerPage: items.length,
      PageNumber: 1,
      ReturnedItemCountActual: items.length,
    };
  };

  const fetchPayoutsForUserAllPages = async (
    user: string,
    signal?: AbortSignal,
  ): Promise<UserPayouts> => {
    const payouts = await fetchAllPayouts(user, { signal });
    return { user, payouts };
  };

  const fetchDataForUser = async (user: string, signal?: AbortSignal) => {
    try {
      setDataLoading((prev) => ({ ...prev, [user]: true }));
      const [listings, payoutsResult] = await Promise.all([
        fetchListingsForUser(user, signal),
        fetchPayoutsForUserAllPages(user, signal),
      ]);
      if (signal?.aborted) return;
      const payouts = payoutsResult.payouts.payouts;

      const listingData = processListingData(
        listings.ItemArray.Items as Item[],
        startFrom,
        startTo
      );
      const payoutData = processPayoutData(
        payouts,
        startFrom,
        startTo
      );

      const style = getComputedStyle(document.documentElement);
      const colors = {
        chart1: style.getPropertyValue('--color-chart-1').trim() || "#EC4899",
        chart2: style.getPropertyValue('--color-chart-2').trim() || "#3B82F6",
      };

      const chartData = combineChartData(listingData, payoutData, colors);
      setUserCharts((prev) => ({ ...prev, [user]: chartData as any }));
    } catch (err) {
      // A new Apply or React's development remount can supersede this crawl.
      // Browser abort errors are expected control flow, not a user-facing API
      // failure (some runtimes report them as a TypeError instead of AbortError).
      if (signal?.aborted || (err as Error)?.name === "AbortError") return;

      if (err instanceof ReauthRequiredError) {
        setError(`${err.user}: ${err.message}`);
      } else {
        setError(
          err instanceof Error ? err.message : `Error fetching data for ${user}`
        );
      }
    } finally {
      // The replacement crawl owns this user's loading state after an abort.
      if (!signal?.aborted) {
        setDataLoading((prev) => ({ ...prev, [user]: false }));
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
      fetchDataForUser(user, controller.signal);
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
    if (users.length > 0 && !usersLoading && isInitialLoad) {
      handleApply();
      setIsInitialLoad(false);
    }
  }, [users, isInitialLoad, handleApply]);

  // A theme change only alters two CSS colour variables, so recolour the charts
  // we already have. This used to re-run the entire per-seller eBay crawl —
  // hundreds of API calls — every time someone toggled light/dark, and again on
  // first paint when next-themes resolved the stored theme.
  useEffect(() => {
    if (isInitialLoad) return;

    const style = getComputedStyle(document.documentElement);
    const chart1 = style.getPropertyValue("--color-chart-1").trim() || "#EC4899";
    const chart2 = style.getPropertyValue("--color-chart-2").trim() || "#3B82F6";

    setUserCharts((prev) => {
      const recoloured: typeof prev = {};
      let changed = false;

      for (const [user, chart] of Object.entries(prev)) {
        if (!chart?.datasets) {
          recoloured[user] = chart;
          continue;
        }
        changed = true;
        recoloured[user] = {
          ...chart,
          datasets: chart.datasets.map((dataset: any, i: number) => {
            const colour = i === 0 ? chart1 : chart2;
            return {
              ...dataset,
              borderColor: colour,
              backgroundColor: colour,
              pointBackgroundColor: colour,
              pointHoverBorderColor: colour,
            };
          }),
        } as typeof chart;
      }

      return changed ? recoloured : prev;
    });
  }, [theme, isInitialLoad]);

  if (!mounted) {
    return null;
  }

  return (
    <div>
      <div className="page-content-shell bg-background">
        <PageHeader title="Charts" />
        <div className="mb-8 flex flex-col lg:flex-row gap-4 items-center xl:items-center">
          <div className="flex flex-wrap justify-center xl:justify-start gap-4">
            <div className="flex items-center gap-2 bg-surface rounded-lg shadow-sm border border-border p-1">
              <label className="text-primary font-bold text-sm uppercase tracking-wider px-2 border-r border-border">Range:</label>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="p-2 rounded-lg border-none text-text-primary focus:outline-none focus:ring-0 bg-transparent cursor-pointer font-heading"
              >
                <option value="last-month" className="bg-surface text-text-primary">Last Month</option>
                <option value="last-3-months" className="bg-surface text-text-primary">Last 3 Months</option>
                <option value="last-12-months" className="bg-surface text-text-primary">Last 12 Months</option>
              </select>
            </div>
            <button
              onClick={handleApply}
              className="px-6 py-2 bg-btn-apply text-white rounded-lg hover:bg-btn-apply-hover transition-all shadow-sm font-bold active:scale-95"
            >
              Apply ✿
            </button>
          </div>
        </div>
        {dateError && <p className="text-error-text text-lg mb-4">{dateError}</p>}
        {error && <p className="text-error-text text-lg mb-4">{error}</p>}
        {usersLoading ? (
          <div className="seller-card">
            <p className="text-primary text-lg">Loading Users... </p>
          </div>
        ) : users.length > 0 ? (
          <div className="space-y-6">
            <UserTableOfContents users={users} />
            <div className="w-full min-w-0">
              {Object.keys(dataLoading).length > 0 && Object.values(dataLoading).some(v => v) ? (
                <div className="seller-card">
                  <p className="text-primary text-lg">Loading Charts...</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {users.map((user) => (
                    <div key={user} id={`user-section-${user}`}>
                      {dataLoading[user] ? (
                        <div className="seller-card">
                          <h2 className="seller-card-title">{user} 🌸</h2>
                          <p className="text-primary text-lg">Loading Data... </p>
                        </div>
                      ) : userCharts[user] &&
                        userCharts[user]?.labels?.length &&
                        userCharts[user]?.labels?.length > 0 &&
                        userCharts[user]?.datasets?.some(
                          (d: any) => d.data.length > 0
                        ) ? (
                        renderUserChart(user, userCharts[user])
                      ) : (
                        <div className="seller-card">
                          <h2 className="seller-card-title">{user} 🌸</h2>
                          <p className="text-text-secondary text-lg">
                            No data for {user}.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="seller-card">
            <p className="text-text-secondary text-lg">No users available. </p>
          </div>
        )}
      </div>
    </div>
  );
}
