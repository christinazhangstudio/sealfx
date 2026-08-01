"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import LoginCtaBanner from "@/components/LoginCtaBanner";
import {
  fetchAllPayouts,
  ReauthRequiredError,
  type Payout,
  type PayoutsResponse,
  type UserPayouts,
} from "@/lib/ebay-data";
import UserTableOfContents from "@/components/UserTableOfContents";
import { formatCurrency } from "@/lib/format-utils";
import { useUsers } from "@/components/UsersContext";
import PageHeader from "@/components/PageHeader";






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



  const fetchAllPayoutsForUser = async (user: string, signal?: AbortSignal) => {
    try {
      setUserLoading((prev) => ({ ...prev, [user]: true }));

      const payouts = await fetchAllPayouts(user, { signal });
      if (signal?.aborted) return;

      setUserTotalPages((prev) => ({
        ...prev,
        [user]: Math.ceil(payouts.total / clientPageSize) || 1,
      }));
      setUserPayouts((prev) => ({ ...prev, [user]: { user, payouts } }));
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      if (err instanceof ReauthRequiredError) {
        setError(`${err.user}: ${err.message}`);
      }
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
          id={`user-section-${user}`}
          className="seller-card"
        >
          <h2 className="seller-card-title">{user} 🌸</h2>
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
        className="seller-card"
      >
        <h2 className="seller-card-title">{user} 🌸</h2>
        {total > 0 && (
          <p className="text-sm sm:text-xl text-primary mb-4">
            Total: ${formatCurrency(calculateUserPayoutTotal(payouts))} 💸
          </p>
        )}
        {total > 0 && paginatedPayouts.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm sm:text-xl text-text-primary border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left w-1/5 sm:min-w-[120px]">
                      <span className="text-secondary mr-2">✦</span>
                      Date
                    </th>
                    <th className="py-2 text-left w-1/5 sm:min-w-[200px] hidden sm:table-cell">
                      <span className="text-secondary mr-2">✦</span>
                      Status
                    </th>
                    <th className="py-2 text-left w-1/5 sm:min-w-[140px]">
                      <span className="text-secondary mr-2">✦</span>
                      Amount
                    </th>
                    <th className="py-2 text-left w-1/5 sm:min-w-[160px] hidden sm:table-cell">
                      <span className="text-secondary mr-2">✦</span>
                      Transactions
                    </th>
                    <th className="py-2 text-left w-1/5 sm:min-w-[140px] hidden sm:table-cell">
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
                        {payout.payoutDate ? new Date(payout.payoutDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2 hidden sm:table-cell">
                        {payout.payoutStatus}
                        <br />
                        <small className="text-secondary text-base truncate block">
                          {payout.payoutStatusDescription}
                        </small>
                      </td>
                      <td className="py-2 text-right sm:text-left whitespace-nowrap font-medium">
                        ${formatCurrency(payout.amount.value)}
                        {/* Status and count ride along under the amount on
                            phones, where their own columns don't fit. */}
                        <span className="sm:hidden block text-xs font-normal text-text-secondary">
                          {payout.payoutStatus} · {payout.transactionCount} txn
                        </span>
                      </td>
                      <td className="py-2 hidden sm:table-cell">
                        {payout.transactionCount}
                      </td>
                      <td className="py-2 truncate hidden sm:table-cell">
                        {payout.payoutInstrument?.nickname ?? "—"}
                        {payout.payoutInstrument?.accountLastFourDigits
                          ? ` (${payout.payoutInstrument.accountLastFourDigits})`
                          : ""}
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
      <div className="page-content-shell bg-background">
        <PageHeader
          title="Payouts"
          description={<span className="italic">Note: Only payouts less than 5 years in the past can be retrieved.</span>}
        />
        {Object.keys(userPayouts).length > 0 && (
          <p className="text-lg sm:text-2xl text-primary mb-8">
            Total: ${formatCurrency(calculateTotalPayoutAmount())} 💰
          </p>
        )}
        {error && <p className="text-error-text text-lg mb-4">{error}</p>}
        {userLoading.global ? (
          <div className="seller-card">
            <p className="text-primary text-lg">Loading Users... </p>
          </div>
        ) : users.length > 0 ? (
          <div className="space-y-6">
            <UserTableOfContents users={users} />
            <div className="w-full min-w-0 space-y-8">
              {users.map((user) =>
                userLoading[user] ? (
                  <div
                    key={user}
                    id={`user-section-${user}`}
                    className="seller-card"
                  >
                    <h2 className="seller-card-title">{user} 🌸</h2>
                    <p className="text-primary text-lg">Loading payouts... </p>
                  </div>
                ) : (
                  renderUserPayouts(user, userPayouts[user], userPages[user] || 1)
                )
              )}
            </div>
          </div>
        ) : (
          <div className="seller-card">
            <p className="text-text-secondary text-lg">No users available. </p>
          </div>
        )}
      </div>
    </>
  );
}
