"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import LoginCtaBanner from "@/components/LoginCtaBanner";
import { trackedFetch as fetch } from "@/lib/api-tracker";
import UserTableOfContents from "@/components/UserTableOfContents";
import { formatCurrency } from "@/lib/format-utils";
import { useUsers } from "@/components/UsersContext";

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
  const { data: session } = useSession();
  const { users, loadingUsers } = useUsers();
  const [userPayouts, setUserPayouts] = useState<{ [user: string]: UserPayouts }>({});
  const [userPages, setUserPages] = useState<{ [user: string]: number }>({});
  const [userTotalPages, setUserTotalPages] = useState<{ [user: string]: number }>({});
  const [userLoading, setUserLoading] = useState<{ [user: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);

  const apiPageSize = 200; // For API requests
  const clientPageSize = 4; // For client-side pagination



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
      throw new Error(`Failed to fetch payouts for ${user}: ${response.status}`);
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
    if (users.length > 0 && !loadingUsers) {
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

  const renderUserPayouts = (user: string, userPayouts: UserPayouts | undefined, pageIdx: number) => {
    if (!userPayouts || !userPayouts.payouts) {
      return (
        <div
          key={user}
          className="bg-surface p-6 rounded-2xl shadow-md border border-border mb-8"
        >
          <h2 className="text-3xl text-primary mb-4">{user} 🌸</h2>
          <p className="text-text-secondary text-lg">
            No payouts available for {user}.
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
        id={`user-section-${user}`}
        className="bg-surface p-6 rounded-2xl shadow-md border border-border mb-8"
      >
        <h2 className="text-3xl text-primary mb-4">{user} 🌸</h2>
        {total > 0 && (
          <p className="text-xl text-primary mb-4">
            Total: ${formatCurrency(calculateUserPayoutTotal(payouts))} 💸
          </p>
        )}
        {total > 0 && paginatedPayouts.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xl text-text-primary border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left w-1/5 min-w-[120px]">
                      <span className="text-secondary mr-2">✦</span>
                      Date
                    </th>
                    <th className="py-2 text-left w-1/5 min-w-[200px]">
                      <span className="text-secondary mr-2">✦</span>
                      Status
                    </th>
                    <th className="py-2 text-left w-1/5 min-w-[140px]">
                      <span className="text-secondary mr-2">✦</span>
                      Amount
                    </th>
                    <th className="py-2 text-left w-1/5 min-w-[160px]">
                      <span className="text-secondary mr-2">✦</span>
                      Transactions
                    </th>
                    <th className="py-2 text-left w-1/5 min-w-[140px]">
                      <span className="text-secondary mr-2">✦</span>
                      Payment Method
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPayouts.map((payout) => (
                    <tr
                      key={payout.payoutId}
                      className="border-b border-border"
                    >
                      <td className="py-2 whitespace-nowrap">
                        {new Date(payout.payoutDate).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        {payout.payoutStatus}
                        <br />
                        <small className="text-secondary text-base truncate block">
                          {payout.payoutStatusDescription}
                        </small>
                      </td>
                      <td className="py-2">
                        ${formatCurrency(payout.amount.value)}
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
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-lg text-primary">
                Showing {startIdx + 1} -{" "}
                {Math.min(startIdx + clientPageSize, total)} of {total} ✿
              </span>
              <button
                onClick={() => {
                  setUserPages((prev) => ({ ...prev, [user]: prev[user] + 1 }));
                }}
                disabled={pageIdx >= userTotalPages[user]}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p className="text-text-secondary text-lg">
          </p>
        )}
      </div>
    );
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return null;
  }

  return (
    <>
      <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
        <h1 className="text-2xl sm:text-3xl lg:text-5xl text-primary mb-2 lg:mb-4 text-center lg:text-left drop-shadow-sm font-heading break-words">Payouts</h1>
        <p className="text-sm text-text-secondary mb-6 lg:mb-10 text-center lg:text-left italic">
          Note: Only payouts less than 5 years in the past can be retrieved.
        </p>
        {Object.keys(userPayouts).length > 0 && (
          <p className="text-2xl text-primary mb-8">
            Total: ${formatCurrency(calculateTotalPayoutAmount())} 💰
          </p>
        )}
        {error && <p className="text-error-text text-lg mb-4 hidden">{error}</p>}
        {userLoading.global ? (
          <div className="mb-8 p-6 bg-surface rounded-lg shadow-md border border-border">
            <p className="text-primary text-lg">Loading Users... </p>
          </div>
        ) : users.length > 0 ? (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <UserTableOfContents users={users} />
            <div className="flex-1 w-full min-w-0 space-y-6">
              {users.map((user) =>
                userLoading[user] ? (
                  <div
                    key={user}
                    className="bg-surface p-6 rounded-2xl shadow-md border border-border mb-8"
                  >
                    <h2 className="text-3xl text-primary mb-4">{user} 🌸</h2>
                    <p className="text-primary text-lg">Loading payouts... </p>
                  </div>
                ) : (
                  renderUserPayouts(user, userPayouts[user], userPages[user] || 1)
                )
              )}
            </div>
          </div>
        ) : (
          <div className="mb-8 p-6 bg-surface rounded-lg shadow-md border border-border">
            <p className="text-text-secondary text-lg">No users available. </p>
          </div>
        )}
      </div>
    </>
  );
}