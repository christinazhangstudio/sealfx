"use client"; // Next.JS 13+ defaults to server components in the app router.

import { useEffect, useState } from "react";
import { trackedFetch as fetch } from "@/lib/api-tracker";
import UserTableOfContents from "@/components/UserTableOfContents";
import { formatCurrency } from "@/lib/format-utils";

interface UserSummary {
  user: string;
  summary: TransactionSummary;
}

interface TransactionSummary {
  creditCount: number;
  creditAmount: Amount;
  debitCount: number;
  debitAmount: Amount;
  onHoldCount: number;
  onHoldAmount: Amount;
  totalCount: number;
  totalAmount: Amount;
  processingCount: number;
  processingAmount: Amount;
}

interface Amount {
  value: number;
  currency: string;
}

export default function TransactionPage() {
  const [summaries, setSummaries] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummaries = async () => {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      const transactionSummaryUri = process.env.NEXT_PUBLIC_TRANSACTION_SUMMARIES_URI;

      if (!apiBaseUrl || !transactionSummaryUri) {
        const missing = !apiBaseUrl ? "API base URL" : "Transaction summary URI";
        setError(`${missing} env not defined`);
        setLoading(false);
        return;
      }

      const apiUrl = `${apiBaseUrl}/${transactionSummaryUri}`;
      console.log(`Fetching transaction summaries from: ${apiUrl}`);

      try {
        setLoading(true);
        const res = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          // Ensure credentials are sent if cross-origin
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch transactions: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        console.log("Transaction data received:", data);

        // Handle case where API might wrap data in an object
        const finalData = Array.isArray(data) ? data : (data.summaries || data.data || []);

        if (!Array.isArray(finalData)) {
          console.warn("API response is not an array:", data);
          setSummaries([]);
        } else {
          setSummaries(finalData);
        }

        setError(null);
      } catch (err: any) {
        console.error("Transaction fetch error:", err);
        setError(err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchSummaries();
  }, []);

  return (
    <div>
      <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
        <h1 className="text-2xl sm:text-3xl lg:text-5xl text-primary mb-6 lg:mb-10 text-center lg:text-left drop-shadow-sm font-heading break-words">
          Transaction Summaries
        </h1>
        {loading ? (
          <p className="text-primary text-lg">Loading summaries... </p>
        ) : error ? (
          <p className="text-error-text text-lg">{error}</p>
        ) : summaries && summaries.length > 0 ? (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <UserTableOfContents users={summaries.map(s => s.user)} />
            <div className="flex-1 w-full space-y-5">
              {summaries.map((s, index) => (
                <div
                  key={index}
                  id={`user-section-${s.user}`}
                  className="bg-surface p-6 rounded-2xl shadow-md border border-border"
                >
                  <h2 className="text-3xl text-primary mb-4">{s.user} 🌸</h2>
                  <table className="w-full text-2xl text-text-primary border-collapse">
                    <tbody>
                      <tr className="border-b border-border">
                        <td className="py-2 w-80">
                          <span className="text-secondary mr-2">✦</span>
                          Credits
                        </td>
                        <td className="py-2 text-left">
                          {s.summary.creditCount} (${formatCurrency(s.summary.creditAmount.value)})
                        </td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-2 w-80">
                          <span className="text-secondary mr-2">✦</span>
                          Debits
                        </td>
                        <td className="py-2 text-left">
                          {s.summary.debitCount} (${formatCurrency(s.summary.debitAmount.value)})
                        </td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-2 w-80">
                          <span className="text-secondary mr-2">✦</span>
                          On Hold
                        </td>
                        <td className="py-2 text-left">
                          {s.summary.onHoldCount} (${formatCurrency(s.summary.onHoldAmount.value)})
                        </td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-2 w-80">
                          <span className="text-secondary mr-2">✦</span>
                          Total
                        </td>
                        <td className="py-2 text-left">
                          {s.summary.totalCount} (${formatCurrency(s.summary.totalAmount.value)})
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 w-80">
                          <span className="text-secondary mr-2">✦</span>
                          Processing
                        </td>
                        <td className="py-2 text-left">
                          {s.summary.processingCount} (${formatCurrency(s.summary.processingAmount.value)})
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-8 p-6 bg-surface rounded-lg shadow-md">
            <p className="text-text-secondary text-lg">No summaries available. </p>
          </div>
        )}
      </div>
    </div>
  );
}
