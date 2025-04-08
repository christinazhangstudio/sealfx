// app/payouts/page.tsx
"use client";

import { useState, useEffect } from "react";

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
  amount: Amount;
  payoutDate: string;
  lastAttemptedPayoutDate: string;
  transactionCount: number;
  payoutInstrument: PayoutInstrument;
}

interface Amount {
  value: number;
  currency: string;
}

interface PayoutInstrument {
  instrumentType: string;
  nickname: string;
  accountLastFourDigits: string;
}

export default function Payouts() {
  const [userPayouts, setUserPayouts] = useState<UserPayouts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const payoutsUri = process.env.NEXT_PUBLIC_PAYOUTS_URI;

    if (!apiBaseUrl) {
      setError("API base URL env not defined");
      setLoading(false);
      return;
    }

    if (!payoutsUri) {
      setError("Payouts URI env not defined");
      setLoading(false);
      return;
    }

    const apiUrl = `${apiBaseUrl}/${payoutsUri}`;
    fetchPayouts(apiUrl);
  }, []);

  const fetchPayouts = async (url: string) => {
    try {
      setLoading(true);
      const res = await fetch(url);
      const data = await res.json();
      setUserPayouts(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      console.log(err.message);
      setLoading(false);
    }
  };

  const handlePagination = (url: string) => {
    if (url) {
      fetchPayouts(url);
    }
  };

  if (loading)
    return <div className="text-center text-pink-700 text-lg">Loading...</div>;
  if (error)
    return (
      <div className="text-center text-pink-800 text-lg">Error: {error}</div>
    );

  return (
    <div className="bg-pink-50 min-h-screen py-8">
      <h1 className="text-3xl font-bold text-pink-800 mb-6 drop-shadow-sm">
        User Payouts
      </h1>

      {userPayouts.map((p, index) => (
        <div
          key={index}
          className="mb-6 bg-white rounded-lg shadow-md p-6 border border-blue-100"
        >
          <h2 className="text-xl font-semibold text-pink-700 mb-4">
            User: {p.user}
          </h2>

          {p.payouts && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-blue-50 text-pink-700">
                      <th className="p-3 text-left font-semibold">Payout ID</th>
                      <th className="p-3 text-left font-semibold">Status</th>
                      <th className="p-3 text-left font-semibold">Amount</th>
                      <th className="p-3 text-left font-semibold">Date</th>
                      <th className="p-3 text-left font-semibold">
                        Transactions
                      </th>
                      <th className="p-3 text-left font-semibold">
                        Payment Method
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.payouts.payouts.map((payout) => (
                      <tr
                        key={payout.payoutId}
                        className="border-b border-blue-100 hover:bg-pink-100 transition-colors"
                      >
                        <td className="p-3 text-pink-900">{payout.payoutId}</td>
                        <td className="p-3 text-pink-900">
                          {payout.payoutStatus}
                          <br />
                          <small className="text-pink-600">
                            {payout.payoutStatusDescription}
                          </small>
                        </td>
                        <td className="p-3 text-pink-900">
                          {payout.amount.value} {payout.amount.currency}
                        </td>
                        <td className="p-3 text-pink-900">
                          {new Date(payout.payoutDate).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-pink-900">
                          {payout.transactionCount}
                        </td>
                        <td className="p-3 text-pink-900">
                          {payout.payoutInstrument.nickname} (
                          {payout.payoutInstrument.accountLastFourDigits})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <button
                  onClick={() => handlePagination(p.payouts.prev)}
                  disabled={!p.payouts.prev}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-pink-300 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-pink-700">
                  Showing {p.payouts.offset + 1} -{" "}
                  {Math.min(p.payouts.offset + p.payouts.limit, p.payouts.total)}{" "}
                  of {p.payouts.total}
                </span>
                <button
                  onClick={() => handlePagination(p.payouts.next)}
                  disabled={!p.payouts.next}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-pink-300 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}