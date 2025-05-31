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
  payouts: Payout[] | null;
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
  const [users, setUsers] = useState<string[]>([]);
  const [userPayouts, setUserPayouts] = useState<{ [user: string]: UserPayouts }>({});
  const [userPages, setUserPages] = useState<{ [user: string]: number }>({});
  const [userTotalPages, setUserTotalPages] = useState<{ [user: string]: number }>({});
  const [userLoading, setUserLoading] = useState<{ [user: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);

  const apiPageSize = 200; // For API requests
  const clientPageSize = 4; // For client-side pagination

  const fetchUsers = async () => {
    try {
      setUserLoading((prev) => ({ ...prev, global: true }));
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      const usersUri = process.env.NEXT_PUBLIC_USERS_URI;

      if (!apiBaseUrl || !usersUri) {
        throw new Error("API base URL or Users URI env not defined");
      }

      const response = await fetch(`${apiBaseUrl}/${usersUri}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to fetch users");
      }
      const data = await response.json();
      const usersData: string[] = data.users || [];
      setUsers(usersData);

      const initialPages = usersData.reduce((acc, user) => {
        acc[user] = 1;
        return acc;
      }, {} as { [user: string]: number });

      const initialTotalPages = usersData.reduce((acc, user) => {
        acc[user] = 1;
        return acc;
      }, {} as { [user: string]: number });

      const initialLoading = usersData.reduce((acc, user) => {
        acc[user] = false;
        return acc;
      }, {} as { [user: string]: boolean });

      setUserPages(initialPages);
      setUserTotalPages(initialTotalPages);
      setUserLoading((prev) => ({
        ...prev,
        ...initialLoading,
        global: false,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching users");
      setUserLoading((prev) => ({ ...prev, global: false }));
    }
  };

  const fetchPayoutsForUser = async (user: string, pageIdx: number): Promise<UserPayouts> => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const payoutsUri = process.env.NEXT_PUBLIC_PAYOUTS_URI;

    if (!apiBaseUrl || !payoutsUri) {
      throw new Error("API base URL or Payouts URI env not defined");
    }

    const params = new URLSearchParams({
      pageSize: apiPageSize.toString(), // Use apiPageSize for API requests
      pageIdx: pageIdx.toString(),
    });

    const apiUrl = `${apiBaseUrl}/${payoutsUri}/${user}?${params.toString()}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.message || `HTTP error ${response.status}`);
    }
    const data: UserPayouts = await response.json();
    return data;
  };

  const fetchAllPayoutsForUser = async (user: string) => {
    try {
      setUserLoading((prev) => ({ ...prev, [user]: true }));
      let allPayouts: Payout[] = [];
      let pageIdx = 0;
      let hasMorePages = true;

      // Fetch pages with apiPageSize until no more data
      while (hasMorePages) {
        const pageData = await fetchPayoutsForUser(user, pageIdx);
        const payouts = Array.isArray(pageData.payouts.payouts) ? pageData.payouts.payouts : [];
        allPayouts = [...allPayouts, ...payouts];
        const total = pageData.payouts.total || 0;
        hasMorePages = pageData.payouts.next !== "" && payouts.length === apiPageSize;
        pageIdx++;

        // Update total pages based on clientPageSize
        setUserTotalPages((prev) => ({
          ...prev,
          [user]: Math.ceil(total / clientPageSize) || 1,
        }));

        // Store all payouts for client-side pagination
        const payoutsResponse: PayoutsResponse = {
          href: pageData.payouts.href || "",
          next: pageData.payouts.next || "",
          prev: pageData.payouts.prev || "",
          limit: apiPageSize,
          offset: 0,
          payouts: allPayouts,
          total,
        };

        setUserPayouts((prev) => ({
          ...prev,
          [user]: { user, payouts: payoutsResponse },
        }));
      }
    } catch (err) {
      // Set a default UserPayouts object to avoid undefined access
      setUserPayouts((prev) => ({
        ...prev,
        [user]: {
          user,
          payouts: {
            href: "",
            next: "",
            prev: "",
            limit: apiPageSize,
            offset: 0,
            payouts: [],
            total: 0,
          },
        },
      }));
      setError(
        err instanceof Error
          ? err.message
          : `Error fetching payouts for user ${user}`
      );
    } finally {
      setUserLoading((prev) => ({ ...prev, [user]: false }));
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      users.forEach((user) => {
        setUserPages((prev) => ({ ...prev, [user]: 1 }));
        fetchAllPayoutsForUser(user);
      });
    }
  }, [users]);

  const calculateTotalPayoutAmount = (): number => {
    const allPayouts = Object.values(userPayouts).flatMap((p) =>
      p.payouts && Array.isArray(p.payouts.payouts) ? p.payouts.payouts : []
    );
    return allPayouts.reduce(
      (sum, payout) => sum + Number(payout.amount.value),
      0
    );
  };

  const calculateUserPayoutTotal = (payouts: Payout[]): number => {
    return payouts.reduce(
      (sum, payout) => sum + Number(payout.amount.value),
      0
    );
  };

  // Hardcode currency to USD as per your code
  const currency: string = "USD";

  const renderUserPayouts = (user: string, userPayouts: UserPayouts | undefined, pageIdx: number) => {
    if (!userPayouts || !userPayouts.payouts) {
      return (
        <div
          key={user}
          className="bg-white p-6 rounded-2xl shadow-md border border-pink-100 mb-8"
        >
          <h2 className="text-3xl text-pink-600 mb-4">{user} 🌸</h2>
          <p className="text-gray-600 text-lg">
            No payouts available for {user}. ♡
          </p>
        </div>
      );
    }

    const payouts = Array.isArray(userPayouts.payouts.payouts) ? userPayouts.payouts.payouts : [];
    const total = userPayouts.payouts.total || 0;
    const startIdx = (pageIdx - 1) * clientPageSize; // Use clientPageSize for pagination
    const paginatedPayouts = payouts.slice(startIdx, startIdx + clientPageSize);

    return (
      <div
        key={user}
        className="bg-white p-6 rounded-2xl shadow-md border border-pink-100 mb-8"
      >
        <h2 className="text-3xl text-pink-600 mb-4">{user} 🌸</h2>
        {total > 0 && (
          <p className="text-xl text-pink-600 mb-4">
            Total for user: {calculateUserPayoutTotal(payouts).toFixed(2)} {currency} 💸
          </p>
        )}
        {total > 0 && paginatedPayouts.length > 0 ? (
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
                  {paginatedPayouts.map((payout) => (
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
                      <td className="py-2">
                        {payout.transactionCount}
                      </td>
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
                onClick={() => {
                  setUserPages((prev) => ({ ...prev, [user]: prev[user] - 1 }));
                }}
                disabled={pageIdx === 1}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-pink-300 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-lg text-pink-600">
                Showing {startIdx + 1} -{" "}
                {Math.min(startIdx + clientPageSize, total)} of {total} ✿
              </span>
              <button
                onClick={() => {
                  setUserPages((prev) => ({ ...prev, [user]: prev[user] + 1 }));
                }}
                disabled={pageIdx >= userTotalPages[user]}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-pink-300 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p className="text-gray-600 text-lg">
            No payouts available for {user}. ♡
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={inconsolata.className}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-purple-50 p-8">
        <h1 className="text-4xl text-pink-700 mb-8 drop-shadow-sm">Payouts</h1>
        {Object.keys(userPayouts).length > 0 && (
          <p className="text-2xl text-pink-600 mb-8">
            Total: {calculateTotalPayoutAmount().toFixed(2)} {currency} 💰
          </p>
        )}
        {userLoading.global ? (
          <p className="text-pink-600 text-lg">Loading users... ♡</p>
        ) : error ? (
          <p className="text-rose-500 text-lg">{error}</p>
        ) : users.length > 0 ? (
          <div className="space-y-6">
            {users.map((user) =>
              userLoading[user] ? (
                <div
                  key={user}
                  className="bg-white p-6 rounded-2xl shadow-md border border-pink-100 mb-8"
                >
                  <h2 className="text-3xl text-pink-600 mb-4">{user} 🌸</h2>
                  <p className="text-pink-600 text-lg">Loading payouts... ♡</p>
                </div>
              ) : (
                renderUserPayouts(user, userPayouts[user], userPages[user] || 1)
              )
            )}
          </div>
        ) : (
          <p className="text-gray-600 text-lg">No users available. ♡</p>
        )}
      </div>
    </div>
  );
}