"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import { trackedFetch as fetch } from "@/lib/api-tracker";
import { useEbayListings } from "@/lib/useEbayListings";
import { listingImageCandidates, rewriteEbayImageUrl } from "@/lib/ebay-data";

import {
  SANDBOX_SELLERS,
  SANDBOX_ORDERS,
  SANDBOX_LISTING_IMAGES,
} from "./sandbox-data";

interface LineItem {
  lineItemId: string;
  legacyItemId: string;
  title: string;
  sku: string;
  quantity: number;
  lineItemFulfillmentStatus?: string;
  total?: {
    value: string;
    currency: string;
  };
}

interface ShippingFulfillment {
  fulfillmentId?: string;
  shipmentTrackingNumber?: string;
  shippingCarrierCode?: string;
  shippedDate?: string;
}

interface Order {
  orderId: string;
  legacyOrderId: string;
  creationDate: string;
  lastModifiedDate?: string;
  orderPaymentStatus: string;
  orderFulfillmentStatus: string;
  buyer?: { username?: string };
  pricingSummary?: {
    total?: { value: string; currency: string };
    deliveryCost?: { value: string; currency: string };
  };
  cancelStatus?: { cancelState?: string };
  salesRecordReference?: string;
  fulfillmentStartInstructions?: {
    minEstimatedDeliveryDate?: string;
    maxEstimatedDeliveryDate?: string;
    shippingStep?: {
      shippingCarrierCode?: string;
      shippingServiceCode?: string;
      shipTo?: {
        fullName?: string;
        city?: string;
        stateOrProvince?: string;
        postalCode?: string;
        countryCode?: string;
      };
    };
  }[];
  lineItems: LineItem[];
  shippingFulfillments?: ShippingFulfillment[];
}

interface UserOrders {
  user: string;
  orders: Order[];
}

const USER_TONES = [
  "bg-sky-50/90 dark:bg-sky-950/25 border-l-sky-400",
  "bg-violet-50/90 dark:bg-violet-950/25 border-l-violet-400",
  "bg-amber-50/90 dark:bg-amber-950/25 border-l-amber-400",
  "bg-emerald-50/90 dark:bg-emerald-950/25 border-l-emerald-400",
  "bg-rose-50/90 dark:bg-rose-950/25 border-l-rose-400",
  "bg-teal-50/90 dark:bg-teal-950/25 border-l-teal-400",
] as const;

const USER_AVATAR_TONES = [
  "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300",
] as const;

type StepId = "not_started" | "paid" | "processing" | "shipped";

const STEPS: { id: StepId; label: string }[] = [
  { id: "not_started", label: "Not started" },
  { id: "paid", label: "Paid" },
  { id: "processing", label: "Processing" },
  { id: "shipped", label: "Shipped" },
];

const STEP_STYLES: Record<StepId, { bar: string; badge: string }> = {
  not_started: {
    bar: "bg-gray-400/70 dark:bg-gray-500/60",
    badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  },
  paid: {
    bar: "bg-sky-400 dark:bg-sky-500",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  processing: {
    bar: "bg-amber-400 dark:bg-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  shipped: {
    bar: "bg-emerald-400 dark:bg-emerald-500",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
};

type BoardCard = {
  key: string;
  user: string;
  order: Order;
  item: LineItem;
  step: StepId;
};

function formatMoney(amount?: { value: string; currency: string }) {
  if (!amount) return null;
  return `${amount.currency} ${amount.value}`;
}

function formatDate(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString();
}

function StepIcon({ step, filled }: { step: number; filled: boolean }) {
  const path =
    step === 3
      ? "M12 4l8 5v6c0 4.4-3.2 7.9-8 9-4.8-1.1-8-4.6-8-9V9l8-5z"
      : step === 2
        ? "M12 6a6 6 0 110 12 6 6 0 010-12zm0 3.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"
        : step === 1
          ? "M12 2a10 10 0 110 20 10 10 0 010-20zm0 3a7 7 0 100 14A7 7 0 0012 5zm-1.8 4h3.6v1.6h-2v3.2h2V15.4h-3.6v-1.6h2V10.6h-2V9z"
          : "M12 2a10 10 0 110 20 10 10 0 010-20zm0 4.5A5.5 5.5 0 1012 17.5 5.5 5.5 0 0012 6.5z";
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3.5 w-3.5 ${filled ? "fill-current" : "fill-none stroke-current"} ${
        filled ? "" : "stroke-[1.8]"
      }`}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

function PaymentBadge({ status }: { status: string }) {
  if (status === "PAID") {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
        Paid
      </span>
    );
  }
  if (status === "FULLY_REFUNDED") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        Refunded
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      {status.replace(/_/g, " ")}
    </span>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <dt className="shrink-0 text-text-secondary">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-text-primary">
        {children}
      </dd>
    </div>
  );
}

export default function TrackingPage() {
  const [userGroups, setUserGroups] = useState<UserOrders[]>([]);
  const [usingSandboxOrders, setUsingSandboxOrders] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState<StepId | "all">("all");
  const [showRefunded, setShowRefunded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const uniqueUsersArray = Array.from(new Set(userGroups.map((g) => g.user)));
  const now = new Date();
  const past = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);
  const { listingsByUser, errorsByUser } = useEbayListings(uniqueUsersArray, past, now);

  const listingImages: Record<string, string[]> = {};
  if (usingSandboxOrders) {
    for (const [id, url] of Object.entries(SANDBOX_LISTING_IMAGES)) {
      listingImages[id] = [rewriteEbayImageUrl(url), url];
    }
  }
  Object.values(listingsByUser).forEach((items) => {
    items.forEach((item) => {
      if (!item.ItemID) return;
      const candidates = listingImageCandidates(item.PictureDetails);
      if (candidates.length > 0) listingImages[item.ItemID] = candidates;
    });
  });

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    async function fetchAllData() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

        const res = await fetch(`${apiUrl}/tracking`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch tracking data");

        const data = await res.json();
        let groups: UserOrders[] = [];

        if (Array.isArray(data)) {
          groups = data
            .filter(
              (g: { user?: string; orders?: unknown[] }) =>
                g.user && Array.isArray(g.orders)
            )
            .map((g: { user: string; orders: Order[] }) => ({
              user: g.user,
              orders: g.orders,
            }));
        }

        const hasAnyOrders = groups.some((g) => g.orders.length > 0);
        if (!hasAnyOrders) {
          groups = SANDBOX_SELLERS.map((seller) => ({
            user: seller,
            orders: (SANDBOX_ORDERS[seller] || []) as Order[],
          }));
        }
        setUsingSandboxOrders(!hasAnyOrders);
        groups = groups.filter((g) => g.orders.length > 0);
        if (controller.signal.aborted) return;
        setUserGroups(groups);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchAllData();
    return () => controller.abort();
  }, []);

  const getProgressState = (order: Order): StepId => {
    const isPaid =
      order.orderPaymentStatus === "PAID" ||
      order.orderPaymentStatus === "FULLY_REFUNDED";
    const isShipped = order.orderFulfillmentStatus === "FULFILLED";
    const isProcessing = order.orderFulfillmentStatus === "IN_PROGRESS";

    if (isShipped) return "shipped";
    if (isProcessing) return "processing";
    if (isPaid) return "paid";
    return "not_started";
  };

  const stepIndex = (step: StepId) => STEPS.findIndex((s) => s.id === step);

  const boardCards = useMemo(() => {
    const cards: BoardCard[] = [];
    for (const group of userGroups) {
      for (const order of group.orders) {
        if (!showRefunded && order.orderPaymentStatus === "FULLY_REFUNDED") continue;
        const step = getProgressState(order);
        const items =
          order.lineItems && order.lineItems.length > 0
            ? order.lineItems
            : [
                {
                  lineItemId: `${order.orderId}-empty`,
                  legacyItemId: "",
                  title: `Order #${order.orderId}`,
                  sku: "",
                  quantity: 0,
                } satisfies LineItem,
              ];
        for (const item of items) {
          cards.push({
            key: `${order.orderId}-${item.lineItemId}`,
            user: group.user,
            order,
            item,
            step,
          });
        }
      }
    }
    return cards;
  }, [userGroups, showRefunded]);

  const visibleCards =
    activeStep === "all" ? boardCards : boardCards.filter((c) => c.step === activeStep);

  const userStats = useMemo(() => {
    const stats: Record<
      string,
      { orders: number; shipped: number; processing: number; total: string | null }
    > = {};
    for (const group of userGroups) {
      const orders = showRefunded
        ? group.orders
        : group.orders.filter((o) => o.orderPaymentStatus !== "FULLY_REFUNDED");
      let orderTotal = 0;
      let hasTotal = false;
      for (const order of orders) {
        if (order.pricingSummary?.total?.value) {
          const parsed = parseFloat(order.pricingSummary.total.value);
          if (!Number.isNaN(parsed)) {
            orderTotal += parsed;
            hasTotal = true;
          }
        }
      }
      stats[group.user] = {
        orders: orders.length,
        shipped: orders.filter((o) => getProgressState(o) === "shipped").length,
        processing: orders.filter(
          (o) => getProgressState(o) === "processing"
        ).length,
        total: hasTotal ? orderTotal.toFixed(2) : null,
      };
    }
    return stats;
  }, [userGroups, showRefunded]);

  const userToneIndex = (user: string) => {
    const idx = uniqueUsersArray.indexOf(user);
    return (idx >= 0 ? idx : 0) % USER_TONES.length;
  };

  const cardImage = (item: LineItem) => {
    const candidates = listingImages[item.legacyItemId] || [];
    if (candidates.length === 0) return null;
    return (
      <img
        src={candidates[0]}
        alt=""
        data-i="0"
        referrerPolicy="no-referrer"
        className="max-h-full max-w-full object-contain"
        onError={(e) => {
          const img = e.currentTarget;
          const next = Number(img.dataset.i || "0") + 1;
          if (next < candidates.length) {
            img.dataset.i = String(next);
            img.src = candidates[next];
            return;
          }
          img.style.display = "none";
        }}
      />
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Tracking"
        description={
          <>
            Orders from the last 90 days. eBay&apos;s Get Orders API defaults to
            that window unless a wider date filter is requested.
          </>
        }
      />

      {Object.keys(errorsByUser).length > 0 && (
        <div className="mb-4 space-y-2">
          {Object.entries(errorsByUser).map(([user, message]) => (
            <p key={user} className="font-medium text-red-500">
              {user}: Request failed: {message}
            </p>
          ))}
        </div>
      )}

      {loading ? (
        <div className="seller-card">
          <p className="text-lg text-primary">Loading Orders...</p>
        </div>
      ) : error ? (
        <div className="py-10 text-center text-error-text">{error}</div>
      ) : userGroups.length === 0 ? (
        <div className="seller-card">
          <p className="text-lg text-text-secondary">No tracking data found.</p>
        </div>
      ) : (
        <>
          {/* Show-refunded toggle: off by default so refunded orders stay out of the pipeline. */}
          <div className="mb-4 flex items-center justify-end">
            <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-text-secondary">
              <span>Show refunded</span>
              <button
                type="button"
                role="switch"
                aria-checked={showRefunded}
                onClick={() => setShowRefunded((v) => !v)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  showRefunded ? "bg-emerald-400 dark:bg-emerald-500" : "bg-border/50"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    showRefunded ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </button>
            </label>
          </div>
          <div className="mb-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <div className="grid grid-cols-4 divide-x divide-border/70">
              {STEPS.map((step, idx) => {
                const count = boardCards.filter((c) => c.step === step.id).length;
                const active = activeStep === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStep(active ? "all" : step.id)}
                    aria-pressed={active}
                    className={`flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                      active ? "bg-surface-light/70" : "hover:bg-hover/60"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
                        active
                          ? `border-transparent text-white ${STEP_STYLES[step.id].bar}`
                          : "border-border/60 text-text-secondary"
                      }`}
                    >
                      <StepIcon step={idx} filled={active} />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block truncate text-sm font-semibold ${
                          active ? "text-primary" : "text-text-secondary"
                        }`}
                      >
                        {step.label}
                      </span>
                      <span className="block text-xs text-text-secondary">
                        {count} item{count === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sellers */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {userGroups.map((group) => {
              const stats = userStats[group.user];
              return (
                <div
                  key={group.user}
                  className={`rounded-xl border border-border/60 p-3.5 ${USER_TONES[userToneIndex(group.user)]}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold uppercase ${USER_AVATAR_TONES[userToneIndex(group.user)]}`}
                    >
                      {group.user.slice(0, 1)}
                    </span>
                    <p className="min-w-0 truncate text-sm font-semibold text-primary">
                      {group.user}
                    </p>
                  </div>
                  <dl className="mt-3 space-y-1 text-xs text-text-secondary">
                    <div className="flex justify-between">
                      <dt>Orders</dt>
                      <dd className="font-semibold text-text-primary">
                        {stats.orders}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>In progress</dt>
                      <dd className="font-semibold text-text-primary">
                        {stats.processing}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Shipped</dt>
                      <dd className="font-semibold text-text-primary">
                        {stats.shipped}
                      </dd>
                    </div>
                    {stats.total && (
                      <div className="flex justify-between border-t border-border/40 pt-1">
                        <dt>Total</dt>
                        <dd className="font-semibold text-text-primary">
                          {stats.total}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              );
            })}
          </div>

          {/* Orders */}
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
              {activeStep === "all" ? (
                <>All items ({visibleCards.length})</>
              ) : (
                <>
                  {STEPS.find((s) => s.id === activeStep)?.label} (
                  {visibleCards.length})
                </>
              )}
            </h2>
            {activeStep !== "all" && (
              <button
                type="button"
                onClick={() => setActiveStep("all")}
                className="text-xs font-medium text-hover underline-offset-2 hover:underline"
              >
                Show all
              </button>
            )}
          </div>

          {visibleCards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-10 text-center text-sm text-text-secondary">
              No items in this stage.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleCards.map(({ key, user, order, item }) => {
                const step = getProgressState(order);
                const stepIdx = stepIndex(step);
                const toneIdx = userToneIndex(user);
                const shipTo =
                  order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
                const estMin = formatDate(
                  order.fulfillmentStartInstructions?.[0]?.minEstimatedDeliveryDate
                );
                const estMax = formatDate(
                  order.fulfillmentStartInstructions?.[0]?.maxEstimatedDeliveryDate
                );
                const placed = formatDate(order.creationDate);
                const modified = formatDate(order.lastModifiedDate);
                const itemUrl = item.legacyItemId
                  ? `https://www.ebay.com/itm/${item.legacyItemId}`
                  : "#";

                return (
                  <article
                    key={key}
                    className={`flex min-w-0 flex-col rounded-xl border border-border/50 ${USER_TONES[toneIdx]} p-3.5 shadow-sm`}
                  >
                    {/* Item */}
                    <div className="flex gap-3">
                      <a
                        href={itemUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/40 bg-surface"
                        aria-label={`Open ${item.title} on eBay`}
                      >
                        {cardImage(item)}
                      </a>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                          {user}
                        </p>
                        <a
                          href={itemUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 block text-sm font-medium leading-snug text-primary hover:underline"
                        >
                          <span className="line-clamp-2">{item.title}</span>
                        </a>
                        <div className="mt-1 flex items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                          {item.total && (
                            <span className="font-semibold text-primary">
                              {formatMoney(item.total)}
                            </span>
                          )}
                          {item.quantity > 0 && <span>Qty {item.quantity}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Stage progress */}
                    <div className="mt-3">
                      <div className="flex items-center gap-1.5">
                        {STEPS.map((s, idx) => (
                          <span
                            key={s.id}
                            title={s.label}
                            className={`h-1.5 flex-1 rounded-full ${
                              idx <= stepIdx ? STEP_STYLES[step].bar : "bg-border/30"
                            }`}
                          />
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STEP_STYLES[step].badge}`}
                        >
                          {STEPS[stepIdx].label}
                        </span>
                        <PaymentBadge status={order.orderPaymentStatus} />
                      </div>
                    </div>

                    {/* Details */}
                    <dl className="mt-3 space-y-1.5 border-t border-border/40 pt-2.5">
                      <DetailRow label="Order">#{order.orderId}</DetailRow>
                      {placed && <DetailRow label="Placed">{placed}</DetailRow>}
                      {modified && (
                        <DetailRow label="Updated">{modified}</DetailRow>
                      )}
                      {order.buyer?.username && (
                        <DetailRow label="Buyer">
                          <span className="break-all">{order.buyer.username}</span>
                        </DetailRow>
                      )}
                      {order.salesRecordReference && (
                        <DetailRow label="Sales record">
                          {order.salesRecordReference}
                        </DetailRow>
                      )}
                      {formatMoney(order.pricingSummary?.total) && (
                        <DetailRow label="Order total">
                          {formatMoney(order.pricingSummary?.total)}
                        </DetailRow>
                      )}
                      {formatMoney(order.pricingSummary?.deliveryCost) && (
                        <DetailRow label="Shipping">
                          {formatMoney(order.pricingSummary?.deliveryCost)}
                        </DetailRow>
                      )}
                      {item.sku && (
                        <DetailRow label="SKU">
                          <span className="font-mono">{item.sku}</span>
                        </DetailRow>
                      )}
                      {item.legacyItemId && (
                        <DetailRow label="Item ID">
                          <span className="font-mono">{item.legacyItemId}</span>
                        </DetailRow>
                      )}
                      {item.lineItemFulfillmentStatus && (
                        <DetailRow label="Line item">
                          {item.lineItemFulfillmentStatus.replace(/_/g, " ")}
                        </DetailRow>
                      )}
                      {shipTo &&
                        [
                          shipTo.city,
                          shipTo.stateOrProvince,
                          shipTo.postalCode,
                        ]
                          .filter(Boolean)
                          .length > 0 && (
                          <DetailRow label="Ship to">
                            {[
                              shipTo.city,
                              shipTo.stateOrProvince,
                              shipTo.postalCode,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </DetailRow>
                        )}
                      {(estMin || estMax) && (
                        <DetailRow label="Est. delivery">
                          {estMin}
                          {estMax ? `–${estMax}` : ""}
                        </DetailRow>
                      )}
                      {(order.shippingFulfillments ?? []).map((f, i) => (
                        <div key={f.fulfillmentId || f.shipmentTrackingNumber || i}>
                          {f.shippingCarrierCode && (
                            <DetailRow label="Carrier">
                              {f.shippingCarrierCode}
                            </DetailRow>
                          )}
                          {f.shipmentTrackingNumber && (
                            <DetailRow label="Tracking">
                              <span className="break-all font-mono">
                                {f.shipmentTrackingNumber}
                              </span>
                            </DetailRow>
                          )}
                          {formatDate(f.shippedDate) && (
                            <DetailRow label="Shipped">
                              {formatDate(f.shippedDate)}
                            </DetailRow>
                          )}
                        </div>
                      ))}
                    </dl>

                    {/* Footer */}
                    <a
                      href={itemUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 self-end text-xs font-semibold text-hover"
                    >
                      Open on eBay
                      <span aria-hidden="true">→</span>
                    </a>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
