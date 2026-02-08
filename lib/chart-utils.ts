/**
 * Chart Utilities
 * Logic for processing and combining eBay API data for Chart.js
 */

export interface SellingStatus {
    CurrentPrice: { Value: number; CurrencyID: string };
    ListingStatus: string;
}

export interface ListingDetails {
    StartTime: string;
    EndTime: string;
    ViewItemURL: string;
}

export interface Item {
    ItemID: string;
    Title: string;
    Quantity: number;
    SellingStatus: SellingStatus;
    ListingDetails: ListingDetails;
}

export interface ItemArray {
    Items: Item[];
}

export interface Listings {
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

export interface PayoutsResponse {
    href: string;
    next: string;
    prev: string;
    limit: number;
    offset: number;
    payouts: Payout[];
    total: number;
}

export interface UserPayouts {
    user: string;
    payouts: PayoutsResponse;
}

export interface Payout {
    payoutId: string;
    payoutStatus: string;
    payoutStatusDescription: string;
    amount: { value: string; currency: string };
    payoutDate: string;
    lastAttemptedPayoutDate: string;
    transactionCount: number;
    payoutInstrument: {
        instrumentType: string;
        nickname: string;
        accountLastFourDigits: string;
    };
}

// Process listing data for cumulative line chart
export const processListingData = (items: Item[], startDate: Date, endDate: Date) => {
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
        // Snap to start of day for grid alignment
        const dateOnly = payout.payoutDate.split("T")[0];
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
