"use client";

import { useState, useEffect } from "react";
import { Inconsolata } from "next/font/google";

const inconsolata = Inconsolata({
  weight: "500",
  subsets: ["latin"],
});

interface Account {
  AccountEntries?: AccountEntriesType;
  AccountID: string;
  AccountSummary?: AccountSummaryType;
  Currency: string;
  EntriesPerPage?: number;
  FeeNettingStatus?: string;
  HasMoreEntries?: boolean;
  PageNumber?: number;
  PaginationResult?: PaginationResultType;
  Ack: string;
  Build: string;
  CorrelationID?: string;
  Errors?: ErrorType[];
  HardExpirationWarning?: string;
  Timestamp: string;
  Version: string;
}

interface AmountType {
  value: number;
  currencyID: string;
}

interface DiscountType {
  Amount: AmountType;
  DiscountType?: string;
}

interface DiscountDetailType {
  Discount?: DiscountType[];
}

interface AccountEntryType {
  AccountDetailsEntryType?: string;
  Balance: AmountType;
  ConversionRate?: AmountType;
  Date?: string;
  Description?: string;
  DiscountDetail?: DiscountDetailType;
  GrossDetailAmount?: AmountType;
  ItemID?: string;
  Memo?: string;
  NetDetailAmount?: AmountType;
  Netted?: boolean;
  OrderID?: string;
  OrderLineItemID?: string;
  ReceivedTopRatedDiscount?: boolean;
  RefNumber?: string;
  Title?: string;
  TransactionID?: string;
  VATPercent?: number;
}

interface AccountEntriesType {
  AccountEntry?: AccountEntryType[];
}

interface AdditionalAccountType {
  AccountCode?: string;
  Balance: AmountType;
  Currency?: string;
}

interface NettedTransactionSummaryType {
  TotalNettedChargeAmount?: AmountType;
  TotalNettedCreditAmount?: AmountType;
}

interface AccountSummaryType {
  AccountState?: string;
  AdditionalAccount?: AdditionalAccountType[];
  AmountPastDue?: AmountType;
  BankAccountInfo?: string;
  BankModifyDate?: string;
  BillingCycleDate?: number;
  CreditCardExpiration?: string;
  CreditCardInfo?: string;
  CreditCardModifyDate?: string;
  CurrentBalance?: AmountType;
  InvoiceBalance?: AmountType;
  InvoiceCredit?: AmountType;
  InvoiceDate?: string;
  InvoiceNewFee?: AmountType;
  InvoicePayment?: AmountType;
  LastAmountPaid?: AmountType;
  LastPaymentDate?: string;
  NettedTransactionSummary?: NettedTransactionSummaryType;
  PastDue?: boolean;
  PaymentMethod?: string;
}

interface PaginationResultType {
  TotalNumberOfEntries?: number;
  TotalNumberOfPages?: number;
}

interface ErrorParameterType {
  Value?: string;
  ParamID?: string;
}

interface ErrorType {
  ErrorClassification?: string;
  ErrorCode?: string;
  ErrorParameters?: ErrorParameterType[];
  LongMessage?: string;
  SeverityCode?: string;
  ShortMessage?: string;
}

export default function Accounts() {
  const [users, setUsers] = useState<string[]>([]);
  const [userAccounts, setUserAccounts] = useState<{ [user: string]: Account }>({});
  const [userPages, setUserPages] = useState<{ [user: string]: number }>({});
  const [userTotalPages, setUserTotalPages] = useState<{ [user: string]: number }>({});
  const [userLoading, setUserLoading] = useState<{ [user: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [userErrors, setUserErrors] = useState<{ [user: string]: ErrorType[] }>({});

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
        throw new Error(`Failed to fetch users: ${response.status}`);
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

      const initialErrors = usersData.reduce((acc, user) => {
        acc[user] = [];
        return acc;
      }, {} as { [user: string]: ErrorType[] });

      setUserPages(initialPages);
      setUserTotalPages(initialTotalPages);
      setUserLoading((prev) => ({
        ...prev,
        ...initialLoading,
        global: false,
      }));
      setUserErrors(initialErrors);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching users");
      setUserLoading((prev) => ({ ...prev, global: false }));
    }
  };

  const fetchAccountsForUser = async (user: string, pageIdx: number): Promise<Account> => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const accountsUri = process.env.NEXT_PUBLIC_ACCOUNT_URI;

    if (!apiBaseUrl || !accountsUri) {
      throw new Error("API base URL or Accounts URI env not defined");
    }

    const params = new URLSearchParams({
      pageSize: apiPageSize.toString(),
      pageIdx: pageIdx.toString(),
    });

    const apiUrl = `${apiBaseUrl}/${accountsUri}/${user}?${params.toString()}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorText = await response.text().catch(() => "No error details available");
      throw new Error(`Failed to fetch accounts for ${user}: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    console.log("[debug] got account", data.account)
    return data.account as Account;
  };

  const fetchAllAccountsForUser = async (user: string) => {
    try {
      setUserLoading((prev) => ({ ...prev, [user]: true }));
      let allAccountEntries: AccountEntryType[] = [];
      let pageIdx = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        const pageData = await fetchAccountsForUser(user, pageIdx);
        const accountEntries = pageData.AccountEntries?.AccountEntry || [];
        allAccountEntries = [...allAccountEntries, ...accountEntries];
        const total = pageData.PaginationResult?.TotalNumberOfEntries || 0;
        hasMorePages = (pageData.HasMoreEntries ?? false) && accountEntries.length === apiPageSize;
        pageIdx++;

        // Store errors from the response
        if (pageData.Errors?.length) {
          setUserErrors((prev) => ({
            ...prev,
            [user]: pageData.Errors || [],
          }));
        }

        setUserTotalPages((prev) => ({
          ...prev,
          [user]: Math.ceil(total / clientPageSize) || 1,
        }));

        const accountsResponse: Account = {
          ...pageData,
          AccountEntries: {
            AccountEntry: allAccountEntries,
          },
        };

        setUserAccounts((prev) => ({
          ...prev,
          [user]: accountsResponse,
        }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Error fetching accounts for user ${user}`;
      setUserErrors((prev) => ({
        ...prev,
        [user]: [
          ...(prev[user] || []),
          {
            ErrorClassification: "SystemError",
            ErrorCode: "FETCH_ERROR",
            ErrorParameters: [],
            LongMessage: errorMessage,
            ShortMessage: "Failed to fetch accounts",
            SeverityCode: "Error",
          },
        ],
      }));
      setUserAccounts((prev) => ({
        ...prev,
        [user]: {
            AccountEntries: { AccountEntry: [] },
            AccountID: "",
            AccountSummary: {
              AccountState: "",
              AdditionalAccount: [],
              AmountPastDue: { value: 0, currencyID: "" },
              BankAccountInfo: "",
              BankModifyDate: "",
              BillingCycleDate: 0,
              CreditCardExpiration: "",
              CreditCardInfo: "",
              CreditCardModifyDate: "",
              CurrentBalance: { value: 0, currencyID: "" },
              InvoiceBalance: { value: 0, currencyID: "" },
              InvoiceCredit: { value: 0, currencyID: "" },
              InvoiceDate: "",
              InvoiceNewFee: { value: 0, currencyID: "" },
              InvoicePayment: { value: 0, currencyID: "" },
              LastAmountPaid: { value: 0, currencyID: "" },
              LastPaymentDate: "",
              NettedTransactionSummary: {
                TotalNettedChargeAmount: { value: 0, currencyID: "" },
                TotalNettedCreditAmount: { value: 0, currencyID: "" },
              },
              PastDue: false,
              PaymentMethod: "",
            },
            Currency: "",
            EntriesPerPage: 0,
            FeeNettingStatus: "",
            HasMoreEntries: false,
            PageNumber: 0,
            PaginationResult: { TotalNumberOfEntries: 0, TotalNumberOfPages: 0 },
            Ack: "",
            Build: "",
            CorrelationID: "",
            Errors: [],
            HardExpirationWarning: "",
            Timestamp: "",
            Version: "",
          }
      }));
      setError(errorMessage);
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
        fetchAllAccountsForUser(user);
      });
    }
  }, [users]);

  const calculateTotalAccountBalance = (): number => {
    const allEntries = Object.values(userAccounts).flatMap((a) =>
      a.AccountEntries?.AccountEntry || []
    );
    return allEntries.reduce(
      (sum, entry) => sum + Number(entry.Balance?.value || 0),
      0
    );
  };

  const calculateUserAccountBalance = (entries: AccountEntryType[] | undefined): number => {
    if (!entries) return 0;
    return entries.reduce(
      (sum, entry) => sum + Number(entry.Balance?.value || 0),
      0
    );
  };

  const renderErrorMessage = (error: ErrorType): string => {
    let message = `${error.ShortMessage || "Unknown error"}: ${error.LongMessage || "No details"} (Code: ${error.ErrorCode || "N/A"}, Severity: ${error.SeverityCode || "N/A"}, Classification: ${error.ErrorClassification || "N/A"})`;
    if (error.ErrorParameters?.length) {
      const params = error.ErrorParameters.map(
        (param) => `ParamID: ${param.ParamID || "N/A"}, Value: ${param.Value || "N/A"}`
      ).join("; ");
      message += ` [Parameters: ${params}]`;
    }
    return message;
  };

  const renderUserAccounts = (user: string, userAccounts: Account | undefined, pageIdx: number) => {
    const errors = userErrors[user] || [];

    if (!userAccounts || !userAccounts || errors.length > 0) {
      return (
        <div
          key={user}
          className="bg-white p-6 rounded-2xl shadow-md border border-pink-100 mb-8"
        >
          <h2 className="text-3xl text-pink-600 mb-4">{user} 🌸</h2>
          {errors.length > 0 && (
            <p className="text-red-500 text-lg mb-4">
              {errors.map((error, index) => (
                <span key={index}>
                  {renderErrorMessage(error)}
                  <br />
                </span>
              ))}
            </p>
          )}
          {errors.length === 0 && (
            <p className="text-gray-600 text-lg">
              No account entries for {user}. ♡
            </p>
          )}
        </div>
      );
    }

    const entries = userAccounts.AccountEntries?.AccountEntry || [];
    const startIdx = (pageIdx - 1) * clientPageSize;
    const paginatedEntries = entries.slice(startIdx, startIdx + clientPageSize);

    return (
      <div
        key={user}
        className="bg-white p-6 rounded-2xl shadow-md border border-pink-100 mb-8"
      >
        {(
          <p className="text-xl text-pink-600 mb-4">
            Total Balance: {calculateUserAccountBalance(entries).toFixed(2)} {userAccounts.Currency || "N/A"} 💸
          </p>
        )}
        {paginatedEntries.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xl text-blue-600 border-collapse">
                <thead>
                  <tr className="border-b border-pink-100">
                    <th className="py-2 text-left w-1/5 min-w-[120px]">
                      <span className="text-pink-500 mr-2">✦</span>
                      Date
                    </th>
                    <th className="py-2 text-left w-1/5 min-w-[140px]">
                      <span className="text-pink-500 mr-2">✦</span>
                      Description
                    </th>
                    <th className="py-2 text-left w-1/5 min-w-[120px]">
                      <span className="text-pink-500 mr-2">✦</span>
                      Balance
                    </th>
                    <th className="py-2 text-left w-1/5 min-w-[140px]">
                      <span className="text-pink-500 mr-2">✦</span>
                      Item ID
                    </th>
                    <th className="py-2 text-left w-1/5 min-w-[140px]">
                      <span className="text-pink-500 mr-2">✦</span>
                      Transaction ID
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEntries.map((entry) => (
                    <tr
                      key={entry.TransactionID || `entry-${Math.random()}`} // Fallback key
                      className="border-b border-pink-100"
                    >
                      <td className="py-2 whitespace-nowrap">
                        {entry.Date ? new Date(entry.Date).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="py-2 truncate">
                        {entry.Description || "N/A"}
                      </td>
                      <td className="py-2">
                        {entry.Balance?.value ?? "N/A"} {entry.Balance?.currencyID || ""}
                      </td>
                      <td className="py-2 truncate">
                        {entry.ItemID || "N/A"}
                      </td>
                      <td className="py-2 truncate">
                        {entry.TransactionID || "N/A"}
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
                {/* {Math.min(startIdx + clientPageSize, total)} of {total} ✿ */}
              </span>
              <button
                onClick={() => {
                  setUserPages((prev) => ({ ...prev, [user]: prev[user] + 1 }));
                }}
                disabled={pageIdx >= (userTotalPages[user] || 1)}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-pink-300 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p className="text-gray-600 text-lg">
            No account entries available for {user}. ♡
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={inconsolata.className}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-purple-50 p-8">
        <h1 className="text-4xl text-pink-700 mb-8 drop-shadow-sm">Accounts</h1>
        {!error && Object.keys(userAccounts).length > 0 && (
          <p className="text-2xl text-pink-600 mb-8">
            Total Balance: {calculateTotalAccountBalance().toFixed(2)} 💰
          </p>
        )}
        {userLoading.global ? (
          <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
            <p className="text-pink-600 text-lg">Loading Users... ♡</p>
          </div>
        ) : users.length > 0 ? (
          <div className="space-y-6">
            {users.map((user) =>
              userLoading[user] ? (
                <div
                  key={user}
                  className="bg-white p-6 rounded-2xl shadow-md border border-pink-100 mb-8"
                >
                  <h2 className="text-3xl text-pink-600 mb-4">{user} 🌸</h2>
                  <p className="text-pink-600 text-lg">Loading accounts... ♡</p>
                </div>
              ) : (
                renderUserAccounts(user, userAccounts[user], userPages[user] || 1)
              )
            )}
          </div>
        ) : (
          <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
            <p className="text-gray-600 text-lg">No users available. ♡</p>
          </div>
        )}
      </div>
    </div>
  );
}