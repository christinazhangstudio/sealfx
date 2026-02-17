"use client";

import { useState, useEffect } from "react";
import { trackedFetch as fetch } from "@/lib/api-tracker";
import UserTableOfContents from "@/components/UserTableOfContents";
import { formatCurrency } from "@/lib/format-utils";

interface AmountType {
  value: number;
  currencyID: string;
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
  AdditionalAccount?: AdditionalAccountType[] | null;
  AmountPastDue?: AmountType;
  BankAccountInfo?: string | null;
  BankModifyDate?: string | null;
  BillingCycleDate?: number;
  CreditCardExpiration?: string | null;
  CreditCardInfo?: string | null;
  CreditCardModifyDate?: string | null;
  CurrentBalance?: AmountType;
  InvoiceBalance?: AmountType;
  InvoiceCredit?: AmountType | null;
  InvoiceDate?: string | null;
  InvoiceNewFee?: AmountType | null;
  InvoicePayment?: AmountType | null;
  LastAmountPaid?: AmountType;
  LastPaymentDate?: string | null;
  NettedTransactionSummary?: NettedTransactionSummaryType | null;
  PastDue?: boolean;
  PaymentMethod?: string;
}

interface Account {
  AccountID: string;
  AccountSummaryUPPORT?: AccountSummaryType;
  Currency: string;
  Ack: string;
  Build: string;
  CorrelationID?: string | null;
  Errors?: ErrorType[] | null;
  HardExpirationWarning?: string;
  Timestamp: string;
  Version: string;
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
  const [userLoading, setUserLoading] = useState<{ [user: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [userErrors, setUserErrors] = useState<{ [user: string]: ErrorType[] }>({});

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

      const initialLoading = usersData.reduce((acc, user) => {
        acc[user] = false;
        return acc;
      }, {} as { [user: string]: boolean });

      const initialErrors = usersData.reduce((acc, user) => {
        acc[user] = [];
        return acc;
      }, {} as { [user: string]: ErrorType[] });

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

  const fetchAccountSummaryForUser = async (user: string): Promise<Account> => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const accountsUri = process.env.NEXT_PUBLIC_ACCOUNT_URI;

    if (!apiBaseUrl || !accountsUri) {
      throw new Error("API base URL or Accounts URI env not defined");
    }

    const params = new URLSearchParams({
      pageSize: "1",
    });

    const apiUrl = `${apiBaseUrl}/${accountsUri}/${user}?${params.toString()}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorText = await response.text().catch(() => "No error details available");
      throw new Error(`Failed to fetch account summary for ${user}: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    return data.account as Account;
  };

  const fetchAccountSummary = async (user: string) => {
    try {
      setUserLoading((prev) => ({ ...prev, [user]: true }));
      const accountData = await fetchAccountSummaryForUser(user);

      if (accountData.Errors?.length) {
        setUserErrors((prev) => ({
          ...prev,
          [user]: accountData.Errors || [],
        }));
      }

      setUserAccounts((prev) => ({
        ...prev,
        [user]: accountData,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Error fetching account summary for user ${user}`;
      setUserErrors((prev) => ({
        ...prev,
        [user]: [
          ...(prev[user] || []),
          {
            ErrorClassification: "SystemError",
            ErrorCode: "FETCH_ERROR",
            ErrorParameters: [],
            LongMessage: errorMessage,
            ShortMessage: "Failed to fetch account summary",
            SeverityCode: "Error",
          },
        ],
      }));
      setUserAccounts((prev) => ({
        ...prev,
        [user]: {
          AccountID: "",
          AccountSummaryUPPORT: {
            AccountState: "",
            AdditionalAccount: null,
            AmountPastDue: { value: 0, currencyID: "" },
            BankAccountInfo: null,
            BankModifyDate: null,
            BillingCycleDate: 0,
            CreditCardExpiration: null,
            CreditCardInfo: null,
            CreditCardModifyDate: null,
            CurrentBalance: { value: 0, currencyID: "" },
            InvoiceBalance: { value: 0, currencyID: "" },
            InvoiceCredit: null,
            InvoiceDate: null,
            InvoiceNewFee: null,
            InvoicePayment: null,
            LastAmountPaid: { value: 0, currencyID: "" },
            LastPaymentDate: null,
            NettedTransactionSummary: null,
            PastDue: false,
            PaymentMethod: "",
          },
          Currency: "",
          Ack: "",
          Build: "",
          CorrelationID: null,
          Errors: null,
          HardExpirationWarning: "",
          Timestamp: "",
          Version: "",
        },
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
        fetchAccountSummary(user);
      });
    }
  }, [users]);

  const calculateTotalAccountBalance = (): number => {
    return Object.values(userAccounts).reduce(
      (sum, account) => sum + Number(account.AccountSummaryUPPORT?.CurrentBalance?.value || 0),
      0
    );
  };

  const renderErrorMessage = (error: ErrorType): string => {
    let message = `${error.ShortMessage || "Unknown error"}: ${error.LongMessage || "No details"} (Code: ${error.ErrorCode || "N/A"}, Severity: ${error.ErrorClassification || "N/A"})`;
    if (error.ErrorParameters?.length) {
      const params = error.ErrorParameters.map(
        (param) => `ParamID: ${param.ParamID || "N/A"}, Value: ${param.Value || "N/A"}`
      ).join("; ");
      message += ` [Parameters: ${params}]`;
    }
    return message;
  };

  const renderUserAccountSummary = (user: string, account: Account | undefined) => {
    const errors = userErrors[user] || [];

    if (!account || !account.AccountSummaryUPPORT || errors.length > 0) {
      return (
        <div
          key={user}
          className="bg-surface p-6 rounded-2xl shadow-md border border-border mb-8"
        >
          <h2 className="text-3xl text-primary mb-4">{user} 🌸</h2>
          {errors.length > 0 && (
            <p className="text-error-text text-lg mb-4">
              {errors.map((error, index) => (
                <span key={index}>
                  {renderErrorMessage(error)}
                  <br />
                </span>
              ))}
            </p>
          )}
          {errors.length === 0 && (
            <p className="text-text-secondary text-lg">
              No account summary for {user}.
            </p>
          )}
        </div>
      );
    }

    const summary = account.AccountSummaryUPPORT;
    return (
      <div
        key={user}
        id={`user-section-${user}`}
        className="bg-surface p-6 rounded-2xl shadow-md border border-border mb-8"
      >
        <h2 className="text-3xl text-primary mb-4">{user} 🌸</h2>
        <p className="text-xl text-primary mb-4">
          Current Balance: ${summary.CurrentBalance && typeof summary.CurrentBalance.value === 'number' ? formatCurrency(summary.CurrentBalance.value) : "0.00"} 💸
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xl text-text-primary border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 text-left w-1/5 min-w-[140px]">
                  <span className="text-secondary mr-2">✦</span>
                  Account State
                </th>
                <th className="py-2 text-left w-1/5 min-w-[140px]">
                  <span className="text-secondary mr-2">✦</span>
                  Invoice Balance
                </th>
                <th className="py-2 text-left w-1/5 min-w-[140px]">
                  <span className="text-secondary mr-2">✦</span>
                  Last Payment
                </th>
                <th className="py-2 text-left w-1/5 min-w-[140px]">
                  <span className="text-secondary mr-2">✦</span>
                  Payment Method
                </th>
                <th className="py-2 text-left w-1/5 min-w-[140px]">
                  <span className="text-secondary mr-2">✦</span>
                  Past Due
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="py-2">{summary.AccountState || "N/A"}</td>
                <td className="py-2">
                  ${summary.InvoiceBalance && typeof summary.InvoiceBalance.value === 'number' ? formatCurrency(summary.InvoiceBalance.value) : "0.00"}
                </td>
                <td className="py-2">
                  ${summary.LastAmountPaid && typeof summary.LastAmountPaid.value === 'number' ? formatCurrency(summary.LastAmountPaid.value) : "0.00"} <br />
                  {summary.LastPaymentDate ? new Date(summary.LastPaymentDate).toLocaleDateString() : "N/A"}
                </td>
                <td className="py-2">{summary.PaymentMethod || "N/A"}</td>
                <td className="py-2">{summary.PastDue ? "Yes" : "No"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
        <h1 className="text-2xl sm:text-3xl lg:text-5xl text-primary mb-6 lg:mb-10 text-center lg:text-left drop-shadow-sm font-heading break-words">Account Summaries</h1>
        {!error && Object.keys(userAccounts).length > 0 && (
          <p className="text-2xl text-primary mb-8">
            Total Balance: ${formatCurrency(calculateTotalAccountBalance())} 💰
          </p>
        )}
        {userLoading.global ? (
          <p className="text-primary text-lg animate-pulse">Loading Users... </p>
        ) : users.length > 0 ? (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <UserTableOfContents users={users} />
            <div className="flex-1 w-full space-y-6">
              {users.map((user) =>
                userLoading[user] ? (
                  <p key={user} className="text-primary text-lg animate-pulse mb-8">
                    {user}: Loading account summary...
                  </p>
                ) : (
                  renderUserAccountSummary(user, userAccounts[user])
                )
              )}
            </div>
          </div>
        ) : (
          <div className="mb-8 p-6 bg-surface rounded-lg shadow-md">
            <p className="text-text-secondary text-lg">No users available. </p>
          </div>
        )}
      </div>
    </div>
  );
}