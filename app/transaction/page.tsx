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
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const transactionSummaryUri =
      process.env.NEXT_PUBLIC_TRANSACTION_SUMMARIES_URI;
    if (!apiBaseUrl) {
      setError("API base URL env not defined");
      setLoading(false);
      return;
    }

    if (!transactionSummaryUri) {
      setError("transaction summary URI env not defined");
      setLoading(false);
      return;
    }

    const apiUrl = `${apiBaseUrl}/${transactionSummaryUri}`;

    fetch(apiUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch transactions: ${res.status}`);
        }
        return res.json();
      })
      .then((data: UserSummary[]) => {
        setSummaries(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        // explicitly type err as Error
        setError(err.message);
        // console.log(err.message)
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="min-h-screen bg-background p-8">
        <h1 className="text-4xl text-primary mb-8 drop-shadow-sm font-heading">
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
