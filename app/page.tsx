"use client"; // Next.JS 13+ defaults to server components in the app router.

import { useEffect, useState } from "react";
import { Rubik } from 'next/font/google'

const rubik = Rubik({
  weight: '500',
})
 

interface APIError {
  message: string;
}

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

export default function Home() {
  const [summaries, setSummaries] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setError("API URL env not defined");
      setLoading(false);
      return;
    }
  
    fetch(apiUrl)
      .then((res) => {
        if (!res.ok) {
          // handle non-200 responses
          return res.json().then((err: APIError) => {
            throw new Error(err.message);
          });
        }
        return res.json();
      })
      .then((data: UserSummary[]) => {
        setSummaries(data);
        setLoading(false);
      })
      .catch((err: Error) => { // explicitly type err as Error
        setError(err.message);
        console.log(err.message)
        setLoading(false);
      });
  }, []);

  return (
    <div className = {rubik.className}>
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-purple-50 p-8">
      <h1 className="text-4xl text-pink-700 mb-8 drop-shadow-sm">
        Transaction Summaries ✿
      </h1>
      {loading ? (
        <p className="text-pink-600 text-lg">Loading summaries... ♡</p>
      ) : error ? (
        <p className="text-rose-500 text-lg">{error}</p>
      ) : summaries.length > 0 ? (
        <div className="space-y-6">
          {summaries.map((s, index) => (
            <div
            key={index}
            className="bg-white p-6 rounded-2xl shadow-md border border-pink-100 hover:shadow-lg transition-all duration-300 hover:scale-102"
          >
            <h2 className="text-2xl text-purple-700 mb-4">
              {s.user} 🌸
            </h2>
            <table className="w-full text-xl text-blue-600 border-collapse">
              <tbody>
                <tr className="border-b border-pink-100">
                  <td className="py-2 flex items-center">
                    <span className="text-pink-500 mr-2">✦</span>
                    Credits
                  </td>
                  <td className="py-2">
                    {s.summary.creditCount} ({s.summary.creditAmount.value}{' '}
                    {s.summary.creditAmount.currency})
                  </td>
                </tr>
                <tr className="border-b border-pink-100">
                  <td className="py-2 flex items-center">
                    <span className="text-pink-500 mr-2">✦</span>
                    Debits
                  </td>
                  <td className="py-2">
                    {s.summary.debitCount} ({s.summary.debitAmount.value}{' '}
                    {s.summary.debitAmount.currency})
                  </td>
                </tr>
                <tr className="border-b border-pink-100">
                  <td className="py-2 flex items-center">
                    <span className="text-pink-500 mr-2">✦</span>
                    On Hold
                  </td>
                  <td className="py-2">
                    {s.summary.onHoldCount} ({s.summary.onHoldAmount.value}{' '}
                    {s.summary.onHoldAmount.currency})
                  </td>
                </tr>
                <tr className="border-b border-pink-100">
                  <td className="py-2 flex items-center">
                    <span className="text-pink-500 mr-2">✦</span>
                    Total
                  </td>
                  <td className="py-2">
                    {s.summary.totalCount} ({s.summary.totalAmount.value}{' '}
                    {s.summary.totalAmount.currency})
                  </td>
                </tr>
                <tr>
                  <td className="py-2 flex items-center">
                    <span className="text-pink-500 mr-2">✦</span>
                    Processing
                  </td>
                  <td className="py-2">
                    {s.summary.processingCount} ({s.summary.processingAmount.value}{' '}
                    {s.summary.processingAmount.currency})
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          ))}
        </div>
      ) : (
        <p className="text-pink-600 text-lg">No summaries available. ♡</p>
      )}
    </div>
    </div>
  );
}