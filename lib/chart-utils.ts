import {
    startOfDay,
    addDays,
} from "@/lib/date-range";
import type { Item, Payout, PayoutsResponse, UserPayouts, Listings } from "@/lib/ebay-data";

export type { Item, Payout, PayoutsResponse, UserPayouts, Listings };

/**
 * The range pickers hand us Date objects carrying the current clock time, but
 * listings and payouts are fetched by whole day. Comparing a timestamp against
 * them dropped anything earlier in the day than "now" at the start of the range
 * and anything later at the end — quietly under-reporting at both ends.
 */
const dayWindow = (startDate: Date, endDate: Date) => ({
    from: startOfDay(startDate),
    to: addDays(startOfDay(endDate), 1), // exclusive upper bound
});

/**
 * Chart Utilities
 * Logic for processing and combining eBay API data for Chart.js
 */

// Process listing data for cumulative line chart
export const processListingData = (items: Item[], startDate: Date, endDate: Date) => {
    const { from, to } = dayWindow(startDate, endDate);
    const filteredItems = items.filter((item) => {
        const startTime = new Date(item.ListingDetails.StartTime);
        return startTime >= from && startTime < to;
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
        // Snap to start of day for grid alignment
        const dateOnly = item.ListingDetails.StartTime.split("T")[0];
        labels.push(dateOnly);
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
export const processPayoutData = (
    payouts: Payout[],
    startDate: Date,
    endDate: Date
) => {
    const { from, to } = dayWindow(startDate, endDate);
    const filteredPayouts = payouts.filter((payout) => {
        if (!payout.payoutDate) return false;
        const payoutTime = new Date(payout.payoutDate);
        return payoutTime >= from && payoutTime < to;
    });

    // payoutDate is guaranteed present here: the filter above drops any without one.
    const sortedPayouts = filteredPayouts.sort(
        (a, b) =>
            new Date(a.payoutDate!).getTime() - new Date(b.payoutDate!).getTime()
    );

    let cumulativeValue = 0;
    const labels: string[] = [];
    const data: number[] = [];
    const payoutDetails: { title: string; amount: number }[] = [];

    sortedPayouts.forEach((payout) => {
        const value = parseFloat(payout.amount.value);
        cumulativeValue += value;
        // Snap to start of day for grid alignment
        const dateOnly = payout.payoutDate!.split("T")[0];
        labels.push(dateOnly);
        data.push(cumulativeValue);
        payoutDetails.push({
            title: payout.payoutId,
            amount: value,
        });
    });

    return { labels, data, payoutDetails };
};

// Combine listing and payout data
export const combineChartData = (
    listingData: { labels: string[]; data: number[]; listingDetails: any[] },
    payoutData: { labels: string[]; data: number[]; payoutDetails: any[] },
    colors: { chart1: string; chart2: string }
) => {
    // We use independent data points {x, y, detail} to allow direct diagonal lines between events
    // This avoids horizontal "stair-steps" and ensures dots align with Y-axis grid lines

    const allLabels = Array.from(
        new Set([...listingData.labels, ...payoutData.labels])
    ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    return {
        labels: allLabels,
        datasets: [
            {
                label: "Total Listing Value",
                data: listingData.labels.map((label, index) => ({
                    x: label,
                    y: listingData.data[index],
                    detail: listingData.listingDetails[index],
                })),
                borderColor: colors.chart1,
                backgroundColor: colors.chart1,
                pointBackgroundColor: colors.chart1,
                pointBorderColor: "#fff",
                pointHoverBackgroundColor: "#fff",
                pointHoverBorderColor: colors.chart1,
                pointRadius: 6,
                pointHoverRadius: 8,
                fill: false,
                tension: 0, // Perfectly straight segments
            },
            {
                label: "Total Payout Value",
                data: payoutData.labels.map((label, index) => ({
                    x: label,
                    y: payoutData.data[index],
                    detail: payoutData.payoutDetails[index],
                })),
                borderColor: colors.chart2,
                backgroundColor: colors.chart2,
                pointBackgroundColor: colors.chart2,
                pointBorderColor: "#fff",
                pointHoverBackgroundColor: "#fff",
                pointHoverBorderColor: colors.chart2,
                pointRadius: 6,
                pointHoverRadius: 8,
                fill: false,
                tension: 0, // Perfectly straight segments
            },
        ],
    };
};
