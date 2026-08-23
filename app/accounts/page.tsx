"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { trackedFetch as fetch } from "@/lib/api-tracker";
import UserTableOfContents from "@/components/UserTableOfContents";
import { formatCurrency } from "@/lib/format-utils";
import { useUsers } from "@/components/UsersContext";
import PageHeader from "@/components/PageHeader";
import PageActionBar from "@/components/PageActionBar";
import PersonIcon from "@/components/PersonIcon";
import type { PayoutInstrument } from "@/lib/ebay-data";

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

interface TransactionAmount {
  value: number;
  currency: string;
}

interface TransactionSummary {
  creditCount: number;
  creditAmount: TransactionAmount;
  debitCount: number;
  debitAmount: TransactionAmount;
  onHoldCount: number;
  onHoldAmount: TransactionAmount;
  totalCount: number;
  totalAmount: TransactionAmount;
  processingCount: number;
  processingAmount: TransactionAmount;
}

interface UserTransactionSummary {
  user: string;
  summary: TransactionSummary;
}

function formatAmount(amount?: { value?: number }): string {
  return `$${formatCurrency(Number(amount?.value || 0))}`;
}

function renderErrorMessage(error: ErrorType): string {
  let message = `${error.ShortMessage || "Unknown error"}: ${error.LongMessage || "No details"}`;
  if (error.ErrorCode) message += ` (Code: ${error.ErrorCode})`;
  if (error.ErrorParameters?.length) {
    const params = error.ErrorParameters
      .map((parameter) => `${parameter.ParamID || "Parameter"}: ${parameter.Value || "N/A"}`)
      .join("; ");
    message += ` [${params}]`;
  }
  return message;
}

function formatMethodLabel(value?: string): string {
  if (!value) return "N/A";
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function payoutMethodKey(method: PayoutInstrument): string {
  return [
    method.instrumentType || "",
    method.nickname || "",
    method.accountLastFourDigits || "",
  ]
    .join("|")
    .toLowerCase();
}

interface BankBrand {
  name: string;
  asset: string;
  aliases: string[];
}

const BANK_BRANDS: BankBrand[] = [
  { name: "Chase", asset: "/banks/chase.svg", aliases: ["chase", "jpmorgan"] },
  {
    name: "Bank of America",
    asset: "/banks/bank-of-america.svg",
    aliases: ["bank of america", "bofa", "boa"],
  },
  { name: "Wells Fargo", asset: "/banks/wells-fargo.svg", aliases: ["wells fargo"] },
  { name: "Citi", asset: "/banks/citi.svg", aliases: ["citibank", "citi bank", "citi"] },
  { name: "Capital One", asset: "/banks/capital-one.svg", aliases: ["capital one"] },
  { name: "U.S. Bank", asset: "/banks/us-bank.svg", aliases: ["us bank", "us bancorp"] },
  { name: "PNC", asset: "/banks/pnc.svg", aliases: ["pnc"] },
  {
    name: "Truist",
    asset: "/banks/truist.svg",
    aliases: ["truist", "bbt", "suntrust"],
  },
  {
    name: "TD Bank",
    asset: "/banks/td-bank.svg",
    aliases: ["td bank", "toronto dominion"],
  },
  { name: "Ally Bank", asset: "/banks/ally.svg", aliases: ["ally bank", "ally"] },
];

function normalizeBankName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findBankBrand(method: PayoutInstrument): BankBrand | undefined {
  const description = normalizeBankName(
    `${method.nickname || ""} ${method.instrumentType || ""}`
  );
  const paddedDescription = ` ${description} `;
  return BANK_BRANDS.find((bank) =>
    bank.aliases.some((alias) =>
      paddedDescription.includes(` ${normalizeBankName(alias)} `)
    )
  );
}

function PayoutMethodCard({ method }: { method: PayoutInstrument }) {
  const bank = findBankBrand(method);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/45 p-3">
      {bank && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-white p-2">
          <Image
            src={bank.asset}
            alt={`${bank.name} logo`}
            width={32}
            height={32}
            className="size-full object-contain"
            unoptimized
          />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-semibold text-text-primary">
          {method.nickname || formatMethodLabel(method.instrumentType)}
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          {formatMethodLabel(method.instrumentType)}
          {method.accountLastFourDigits
            ? ` · Ending in ${method.accountLastFourDigits}`
            : ""}
        </p>
      </div>
    </div>
  );
}

function TransactionMetric({
  label,
  count,
  amount,
}: {
  label: string;
  count: number;
  amount: TransactionAmount;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/45 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <span className="text-lg font-semibold text-text-primary">{count}</span>
        <span className="text-sm text-text-secondary">{formatAmount(amount)}</span>
      </div>
    </div>
  );
}

export default function Accounts() {
  const [mounted, setMounted] = useState(false);
  const { users, loadingUsers } = useUsers();
  const [userAccounts, setUserAccounts] = useState<Record<string, Account>>({});
  const [userLoading, setUserLoading] = useState<Record<string, boolean>>({});
  const [userErrors, setUserErrors] = useState<Record<string, ErrorType[]>>({});
  const [transactionSummaries, setTransactionSummaries] = useState<Record<string, TransactionSummary>>({});
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [payoutMethods, setPayoutMethods] = useState<Record<string, PayoutInstrument[]>>({});
  const [payoutMethodsLoading, setPayoutMethodsLoading] = useState<Record<string, boolean>>({});
  const [payoutMethodErrors, setPayoutMethodErrors] = useState<Record<string, string>>({});

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (loadingUsers) return;

    if (users.length === 0) {
      setUserAccounts({});
      setUserErrors({});
      setUserLoading({});
      return;
    }

    let cancelled = false;
    setUserLoading(Object.fromEntries(users.map((user) => [user, true])));

    const loadAccounts = async () => {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      const accountsUri = process.env.NEXT_PUBLIC_ACCOUNT_URI;
      const nextAccounts: Record<string, Account> = {};
      const nextErrors: Record<string, ErrorType[]> = {};

      if (!apiBaseUrl || !accountsUri) {
        const message = "API base URL or Accounts URI env not defined";
        for (const user of users) {
          nextErrors[user] = [{ ShortMessage: "Account data unavailable", LongMessage: message }];
        }
      } else {
        await Promise.all(
          users.map(async (user) => {
            try {
              const params = new URLSearchParams({ pageSize: "1" });
              const response = await fetch(`${apiBaseUrl}/${accountsUri}/${user}?${params.toString()}`);
              if (!response.ok) {
                const details = await response.text().catch(() => "No error details available");
                throw new Error(`${response.status} - ${details}`);
              }

              const data = await response.json();
              const account = data.account as Account;
              nextAccounts[user] = account;
              if (account.Errors?.length) nextErrors[user] = account.Errors;
            } catch (error) {
              nextErrors[user] = [
                {
                  ErrorCode: "FETCH_ERROR",
                  ShortMessage: "Failed to fetch account summary",
                  LongMessage: error instanceof Error ? error.message : "Unexpected account error",
                },
              ];
            }
          })
        );
      }

      if (!cancelled) {
        setUserAccounts(nextAccounts);
        setUserErrors(nextErrors);
        setUserLoading({});
      }
    };

    loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [loadingUsers, users]);

  useEffect(() => {
    if (loadingUsers) return;

    if (users.length === 0) {
      setPayoutMethods({});
      setPayoutMethodErrors({});
      setPayoutMethodsLoading({});
      return;
    }

    let cancelled = false;
    setPayoutMethodsLoading(Object.fromEntries(users.map((user) => [user, true])));

    const loadPayoutMethods = async () => {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      const payoutsUri = process.env.NEXT_PUBLIC_PAYOUTS_URI;
      const nextMethods: Record<string, PayoutInstrument[]> = {};
      const nextErrors: Record<string, string> = {};

      if (!apiBaseUrl || !payoutsUri) {
        for (const user of users) {
          nextErrors[user] = "API base URL or Payouts URI env not defined";
        }
      } else {
        await Promise.all(
          users.map(async (user) => {
            try {
              const params = new URLSearchParams({ pageSize: "20", pageIdx: "0" });
              const response = await fetch(`${apiBaseUrl}/${payoutsUri}/${user}?${params.toString()}`);
              if (!response.ok) {
                const details = await response.text().catch(() => "No error details available");
                throw new Error(`${response.status} - ${details}`);
              }

              const data = await response.json();
              const payouts = Array.isArray(data?.payouts?.payouts) ? data.payouts.payouts : [];
              const seen = new Set<string>();
              const methods: PayoutInstrument[] = [];

              for (const payout of payouts) {
                const method = payout?.payoutInstrument as PayoutInstrument | undefined;
                if (!method || (!method.instrumentType && !method.nickname && !method.accountLastFourDigits)) {
                  continue;
                }

                const key = payoutMethodKey(method);
                if (seen.has(key)) continue;
                seen.add(key);
                methods.push(method);
              }

              nextMethods[user] = methods;
            } catch (error) {
              nextErrors[user] = error instanceof Error ? error.message : "Unexpected payout method error";
            }
          })
        );
      }

      if (!cancelled) {
        setPayoutMethods(nextMethods);
        setPayoutMethodErrors(nextErrors);
        setPayoutMethodsLoading({});
      }
    };

    loadPayoutMethods();
    return () => {
      cancelled = true;
    };
  }, [loadingUsers, users]);

  useEffect(() => {
    let cancelled = false;

    const loadTransactions = async () => {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      const transactionSummaryUri = process.env.NEXT_PUBLIC_TRANSACTION_SUMMARIES_URI;

      if (!apiBaseUrl || !transactionSummaryUri) {
        if (!cancelled) {
          setTransactionError("API base URL or Transaction summary URI env not defined");
          setTransactionsLoading(false);
        }
        return;
      }

      try {
        setTransactionsLoading(true);
        const response = await fetch(`${apiBaseUrl}/${transactionSummaryUri}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch transactions: ${response.status} ${response.statusText}`);
        }

        const payload = await response.json();
        const summaries = Array.isArray(payload) ? payload : payload.summaries || payload.data || [];
        if (!Array.isArray(summaries)) throw new Error("Transaction summary response is not an array");

        const summariesByUser: Record<string, TransactionSummary> = {};
        for (const entry of summaries as UserTransactionSummary[]) {
          if (entry?.user && entry.summary) summariesByUser[entry.user] = entry.summary;
        }

        if (!cancelled) {
          setTransactionSummaries(summariesByUser);
          setTransactionError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setTransactionError(error instanceof Error ? error.message : "An unexpected transaction error occurred");
        }
      } finally {
        if (!cancelled) setTransactionsLoading(false);
      }
    };

    loadTransactions();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayedUsers = useMemo(() => {
    const ordered = [...users];
    for (const user of Object.keys(transactionSummaries)) {
      if (!ordered.includes(user)) ordered.push(user);
    }
    return ordered;
  }, [transactionSummaries, users]);

  const totalAccountBalance = useMemo(
    () =>
      Object.values(userAccounts).reduce(
        (sum, account) => sum + Number(account.AccountSummaryUPPORT?.CurrentBalance?.value || 0),
        0
      ),
    [userAccounts]
  );

  const transactionTotals = useMemo(
    () =>
      Object.values(transactionSummaries).reduce(
        (totals, summary) => ({
          count: totals.count + Number(summary.totalCount || 0),
          processing: totals.processing + Number(summary.processingCount || 0),
        }),
        { count: 0, processing: 0 }
      ),
    [transactionSummaries]
  );

  if (!mounted) return null;

  return (
    <div className="page-content-shell bg-background">
      <PageHeader
        title="Accounts & Transactions"
        description="Review balances, payment details, and transaction activity for every seller."
      />

      {displayedUsers.length > 0 && (
        <PageActionBar ariaLabel="Account and transaction overview" comfortable>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border/50 bg-background/45 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Portfolio balance</p>
              <p className="mt-1 text-xl font-semibold text-primary">{formatAmount({ value: totalAccountBalance })}</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/45 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Transactions</p>
              <p className="mt-1 text-xl font-semibold text-text-primary">{transactionTotals.count}</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/45 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Processing</p>
              <p className="mt-1 text-xl font-semibold text-text-primary">{transactionTotals.processing}</p>
            </div>
          </div>
          <UserTableOfContents users={displayedUsers} />
        </PageActionBar>
      )}

      {loadingUsers && displayedUsers.length === 0 ? (
        <p className="text-lg text-primary animate-pulse">Loading sellers...</p>
      ) : displayedUsers.length > 0 ? (
        <div className="space-y-8">
          {displayedUsers.map((user) => {
            const accountSummary = userAccounts[user]?.AccountSummaryUPPORT;
            const accountErrors = userErrors[user] || [];
            const transactionSummary = transactionSummaries[user];

            return (
              <article key={user} id={`user-section-${user}`} className="seller-card scroll-mt-24">
                <h2 className="seller-card-title flex items-center gap-2">
                  <span>{user}</span>
                  <PersonIcon />
                </h2>

                <div className="mt-5 grid gap-5 xl:grid-cols-3">
                  <section className="min-w-0 rounded-2xl border border-border/60 bg-surface/60 p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/50 pb-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Account</p>
                        <h3 className="mt-1 text-lg font-semibold text-text-primary">Balance & billing</h3>
                      </div>
                      {accountSummary && (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            accountSummary.PastDue
                              ? "bg-destructive/10 text-destructive"
                              : "bg-success-bg text-success-text"
                          }`}
                        >
                          {accountSummary.PastDue ? "Past due" : "Current"}
                        </span>
                      )}
                    </div>

                    {userLoading[user] ? (
                      <p className="py-8 text-sm text-text-secondary animate-pulse">Loading account summary...</p>
                    ) : accountErrors.length > 0 ? (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-error-text">
                        {accountErrors.map((accountError, index) => (
                          <p key={`${accountError.ErrorCode || "account"}-${index}`}>{renderErrorMessage(accountError)}</p>
                        ))}
                      </div>
                    ) : accountSummary ? (
                      <>
                        <div className="mb-5">
                          <p className="text-sm text-text-secondary">Current balance</p>
                          <p className="mt-1 text-3xl font-semibold text-primary">
                            {formatAmount(accountSummary.CurrentBalance)}
                          </p>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
                          <div>
                            <dt className="text-text-muted">Account state</dt>
                            <dd className="mt-1 font-semibold text-text-primary">{accountSummary.AccountState || "N/A"}</dd>
                          </div>
                          <div>
                            <dt className="text-text-muted">Invoice balance</dt>
                            <dd className="mt-1 font-semibold text-text-primary">{formatAmount(accountSummary.InvoiceBalance)}</dd>
                          </div>
                          <div>
                            <dt className="text-text-muted">Last payment</dt>
                            <dd className="mt-1 font-semibold text-text-primary">{formatAmount(accountSummary.LastAmountPaid)}</dd>
                            <dd className="text-xs text-text-secondary">
                              {accountSummary.LastPaymentDate
                                ? new Date(accountSummary.LastPaymentDate).toLocaleDateString()
                                : "Date unavailable"}
                            </dd>
                          </div>
                        </dl>
                      </>
                    ) : (
                      <p className="py-8 text-sm text-text-secondary">No account summary available.</p>
                    )}
                  </section>

                  <section className="min-w-0 rounded-2xl border border-border/60 bg-surface/60 p-4 sm:p-5">
                    <div className="mb-4 border-b border-border/50 pb-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Methods</p>
                      <h3 className="mt-1 text-lg font-semibold text-text-primary">Payment & payouts</h3>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-text-primary">Payment method</p>
                      {userLoading[user] ? (
                        <p className="mt-2 text-sm text-text-secondary animate-pulse">Loading payment method...</p>
                      ) : accountErrors.length > 0 ? (
                        <p className="mt-2 text-sm text-text-secondary">Payment method unavailable.</p>
                      ) : accountSummary ? (
                        <div className="mt-2 rounded-xl border border-border/50 bg-background/45 p-3">
                          <p className="font-semibold text-text-primary">
                            {formatMethodLabel(accountSummary.PaymentMethod)}
                          </p>
                          {accountSummary.CreditCardInfo && (
                            <p className="mt-1 text-sm text-text-secondary">
                              Credit card {accountSummary.CreditCardInfo}
                              {accountSummary.CreditCardExpiration
                                ? ` · Expires ${accountSummary.CreditCardExpiration}`
                                : ""}
                            </p>
                          )}
                          {accountSummary.BankAccountInfo && (
                            <p className="mt-1 text-sm text-text-secondary">
                              Bank account {accountSummary.BankAccountInfo}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-text-secondary">No payment method available.</p>
                      )}
                    </div>

                    <div className="mt-5 border-t border-border/50 pt-4">
                      <p className="text-sm font-semibold text-text-primary">Payout methods</p>
                      {payoutMethodsLoading[user] ? (
                        <p className="mt-2 text-sm text-text-secondary animate-pulse">Loading payout methods...</p>
                      ) : payoutMethodErrors[user] ? (
                        <p className="mt-2 text-sm text-text-secondary">Payout methods unavailable.</p>
                      ) : payoutMethods[user]?.length ? (
                        <>
                          <div className="mt-2 space-y-2">
                            {payoutMethods[user].map((method) => (
                              <PayoutMethodCard key={payoutMethodKey(method)} method={method} />
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-text-muted">Based on recent eBay payout activity.</p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-text-secondary">No payout method found in recent activity.</p>
                      )}
                    </div>
                  </section>

                  <section className="min-w-0 rounded-2xl border border-border/60 bg-surface/60 p-4 sm:p-5">
                    <div className="mb-4 border-b border-border/50 pb-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Transactions</p>
                      <h3 className="mt-1 text-lg font-semibold text-text-primary">Activity summary</h3>
                    </div>

                    {transactionsLoading ? (
                      <p className="py-8 text-sm text-text-secondary animate-pulse">Loading transaction summary...</p>
                    ) : transactionError ? (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-error-text">
                        {transactionError}
                      </div>
                    ) : transactionSummary ? (
                      <>
                        <div className="mb-5 flex items-end justify-between gap-4">
                          <div>
                            <p className="text-sm text-text-secondary">Total activity</p>
                            <p className="mt-1 text-3xl font-semibold text-primary">{transactionSummary.totalCount}</p>
                          </div>
                          <p className="pb-1 text-base font-semibold text-text-primary">
                            {formatAmount(transactionSummary.totalAmount)}
                          </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <TransactionMetric label="Credits" count={transactionSummary.creditCount} amount={transactionSummary.creditAmount} />
                          <TransactionMetric label="Debits" count={transactionSummary.debitCount} amount={transactionSummary.debitAmount} />
                          <TransactionMetric label="On hold" count={transactionSummary.onHoldCount} amount={transactionSummary.onHoldAmount} />
                          <TransactionMetric label="Processing" count={transactionSummary.processingCount} amount={transactionSummary.processingAmount} />
                        </div>
                      </>
                    ) : (
                      <p className="py-8 text-sm text-text-secondary">No transaction summary available.</p>
                    )}
                  </section>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="seller-card">
          <p className="text-lg text-text-secondary">No sellers available.</p>
        </div>
      )}
    </div>
  );
}
