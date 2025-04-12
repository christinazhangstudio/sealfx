// app/payouts/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Inconsolata } from "next/font/google";

const inconsolata = Inconsolata({
  weight: "500",
});

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
  value: string;
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

    fetch(apiUrl)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err: { message: string }) => {
            throw new Error(err.message);
          });
        }
        return res.json();
      })
      .then((data: UserPayouts[]) => {
        setUserPayouts(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        // console.log(err.message);
        setLoading(false);
      });
  }, []);

  const handlePagination = (url: string) => {
    if (url) {
      fetch(url)
        .then((res) => {
          if (!res.ok) {
            return res.json().then((err: { message: string }) => {
              throw new Error(err.message);
            });
          }
          return res.json();
        })
        .then((data: UserPayouts[]) => {
          setUserPayouts(data);
          setLoading(false);
        })
        .catch((err: Error) => {
          setError(err.message);
          // console.log(err.message);
          setLoading(false);
        });
    }
  };

  const calculateTotalPayoutAmount = (): number => {
    const allPayouts = userPayouts.flatMap((p) =>
      p.payouts && Array.isArray(p.payouts.payouts) ? p.payouts.payouts : []
    );
    return allPayouts.reduce((sum, payout) => 
      sum + Number(payout.amount.value), 0);
  };

  const totalPayoutAmount: number = calculateTotalPayoutAmount();

  const calculateUserPayoutTotal = (payouts: Payout[]): number => {
    return payouts.reduce((sum, payout) => 
      sum + Number(payout.amount.value), 0);
  };

  // assume all payouts use the same currency (take first available or default to 'USD')
  const currency: string =
    userPayouts.length > 0 && userPayouts[0].payouts.payouts.length > 0
      ? userPayouts[0].payouts.payouts[0].amount.currency
      : "USD";

  return (
    <div className={inconsolata.className}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-purple-50 p-8">
        <h1 className="text-4xl text-pink-700 mb-8 drop-shadow-sm">
          Payouts
        </h1>
        {userPayouts.length > 0 && (
          <p className="text-2xl text-pink-600 mb-8">
            Total: {totalPayoutAmount} {currency} 💰
          </p>
        )}
        {loading ? (
          <p className="text-pink-600 text-lg">Loading payouts... ♡</p>
        ) : error ? (
          <p className="text-rose-500 text-lg">{error}</p>
        ) : userPayouts.length > 0 ? (
          <div className="space-y-6">
            {userPayouts.map((p, index) => (
              <div
                key={index}
                className="bg-white p-6 rounded-2xl shadow-md border border-pink-100 hover:shadow-lg transition-all duration-300 hover:scale-102"
              >
                <h2 className="text-3xl text-pink-600 mb-4">
                  {p.user} 🌸
                </h2>
                {p.payouts && p.payouts.payouts.length > 0 && (
                  <p className="text-xl text-pink-600 mb-4">
                    Total for user: {"$ "}{calculateUserPayoutTotal(p.payouts.payouts).toFixed(2)}{" "}💸
                  </p>
                )}
                {p.payouts && p.payouts.payouts.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xl text-blue-600 border-collapse">
                        <thead>
                          <tr className="border-b border-pink-100">
                            <th className="py-2 text-left w-1/5 min-w-[120px]">
                              <span className="text-pink-500 mr-2">✦</span>
                              Date
                            </th>
                            <th className="py-2 text-left w-1/5 min-w-[120px]">
                              <span className="text-pink-500 mr-2">✦</span>
                              Status
                            </th>
                            <th className="py-2 text-left w-1/5 min-w-[140px]">
                              <span className="text-pink-500 mr-2">✦</span>
                              Amount
                            </th>
                            <th className="py-2 text-left w-1/5 min-w-[160px]">
                              <span className="text-pink-500 mr-2">✦</span>
                              Transactions
                            </th>
                            <th className="py-2 text-left w-1/5 min-w-[140px]">
                              <span className="text-pink-500 mr-2">✦</span>
                              Payment Method
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.payouts.payouts.map((payout) => (
                            <tr
                              key={payout.payoutId}
                              className="border-b border-pink-100"
                            >
                              <td className="py-2 whitespace-nowrap">
                                {new Date(payout.payoutDate).toLocaleDateString()}
                              </td>
                              <td className="py-2">
                                {payout.payoutStatus}
                                <br />
                                <small className="text-pink-500 text-base truncate block">
                                  {payout.payoutStatusDescription}
                                </small>
                              </td>
                              <td className="py-2">
                                {payout.amount.value} {payout.amount.currency}
                              </td>
                              <td className="py-2">{payout.transactionCount}</td>
                              <td className="py-2 truncate">
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
                      <span className="text-lg text-pink-600">
                        Showing {p.payouts.offset + 1} -{" "}
                        {Math.min(
                          p.payouts.offset + p.payouts.limit,
                          p.payouts.total
                        )}{" "}
                        of {p.payouts.total} ✿
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
                ) : (
                  <p className="text-pink-600 text-lg">No payouts available. ♡</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-pink-600 text-lg">No payouts available. ♡</p>
        )}
      </div>
    </div>
  );
}