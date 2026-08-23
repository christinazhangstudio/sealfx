"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import PageActionBar, { RefreshAction } from "@/components/PageActionBar";
import { trackedFetch as fetch } from "@/lib/api-tracker";
import { useDefaultEbayListings } from "@/lib/useEbayListings";
import PersonIcon from "@/components/PersonIcon";
import { listingImageCandidates, rewriteEbayImageUrl, fetchListingItem } from "@/lib/ebay-data";
import { formatFetchedAt, isWithinLocalDays, parseLocalDate } from "@/lib/date-range";
import { getCachedListingItem, rememberListingItem } from "@/lib/listings-interval-cache";

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

interface UspsTrackingEvent {
  eventType?: string;
  eventTimestamp?: string;
  eventCity?: string;
  eventState?: string;
  eventZIP?: string;
  eventCode?: string;
}

interface UspsTracking {
  trackingNumber?: string;
  status?: string;
  statusCategory?: string;
  statusSummary?: string;
  mailClass?: string;
  services?: string[];
  originCity?: string;
  originState?: string;
  originZIP?: string;
  destinationCity?: string;
  destinationState?: string;
  destinationZIP?: string;
  expectedDeliveryDate?: string;
  trackingEvents?: UspsTrackingEvent[];
}

interface ShippingFulfillment {
  fulfillmentId?: string;
  shipmentTrackingNumber?: string;
  shippingCarrierCode?: string;
  shippedDate?: string;
  uspsTracking?: UspsTracking;
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
  "bg-sky-50/90 dark:bg-sky-950/25",
  "bg-violet-50/90 dark:bg-violet-950/25",
  "bg-amber-50/90 dark:bg-amber-950/25",
  "bg-emerald-50/90 dark:bg-emerald-950/25",
  "bg-rose-50/90 dark:bg-rose-950/25",
  "bg-teal-50/90 dark:bg-teal-950/25",
] as const;

const USER_AVATAR_TONES = [
  "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300",
] as const;

type StepId = "paid" | "processing" | "shipped";

const STEP_LABELS: Record<StepId, string> = {
  paid: "Paid",
  processing: "Partially fulfilled",
  shipped: "Shipped",
};

const STEPS: { id: StepId; label: string }[] = [
  { id: "paid", label: STEP_LABELS.paid },
  { id: "processing", label: STEP_LABELS.processing },
  { id: "shipped", label: STEP_LABELS.shipped },
];

const STEP_STYLES: Record<StepId, { bar: string; badge: string }> = {
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
  badgeStep: StepId;
  statusLabel: string;
  attentionReasons: readonly string[];
};

function formatMoney(amount?: { value: string; currency: string }) {
  if (!amount) return null;
  return `${amount.currency} ${amount.value}`;
}

function formatDate(value?: string) {
  if (!value) return null;
  // eBay date-only values ("2026-06-30") parse as UTC midnight; new Date()
  // would render them a day early west of UTC. parseLocalDate keeps the day.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseLocalDate(value.slice(0, 10))
    : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString();
}

function formatDateTime(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function stripUspsMarkup(value?: string) {
  if (!value) return "";
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&reg;/gi, "®")
    .replace(/&#174;/g, "®")
    .trim();
}

function eventLocation(event: UspsTrackingEvent) {
  return [event.eventCity, event.eventState, event.eventZIP]
    .filter(Boolean)
    .join(", ");
}

function isUspsCarrier(code?: string) {
  const c = (code || "").trim().toUpperCase();
  return c === "USPS" || c.startsWith("USPS") || c.includes("US POSTAL");
}

function itemStatus(step: StepId, item: LineItem) {
  if (step !== "processing") {
    return { badgeStep: step, label: STEP_LABELS[step] };
  }

  const fulfillmentStatus = item.lineItemFulfillmentStatus?.trim().toUpperCase();
  if (fulfillmentStatus === "FULFILLED") {
    return { badgeStep: "shipped" as const, label: "Fulfilled" };
  }
  if (fulfillmentStatus === "NOT_STARTED") {
    return { badgeStep: "paid" as const, label: "Awaiting fulfillment" };
  }
  return { badgeStep: "processing" as const, label: STEP_LABELS.processing };
}

function getAttentionReasons(
  order: Order,
  liveUspsByNumber: Record<string, UspsTracking>,
) {
  const reasons: string[] = [];
  if (
    order.orderPaymentStatus === "PAID" &&
    order.orderFulfillmentStatus !== "FULFILLED" &&
    order.orderFulfillmentStatus !== "IN_PROGRESS"
  ) {
    reasons.push("Paid and awaiting shipment");
  }
  if (order.orderFulfillmentStatus === "IN_PROGRESS") {
    reasons.push("Order is partially fulfilled");
  }

  let hasTrackingNumber = false;
  let hasCarrierIssue = false;
  let expectedDeliveryPassed = false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  for (const fulfillment of order.shippingFulfillments || []) {
    const trackingNumber = fulfillment.shipmentTrackingNumber?.trim();
    if (trackingNumber) hasTrackingNumber = true;
    const usps =
      (trackingNumber ? liveUspsByNumber[trackingNumber] : undefined) ||
      fulfillment.uspsTracking;
    if (!usps) continue;

    const statusText = [
      usps.statusCategory,
      usps.status,
      usps.statusSummary,
    ].join(" ");
    const delivered = /\bdelivered\b/i.test(statusText);
    if (
      /\b(exception|delayed|delay|alert|undeliverable|delivery failed|return to sender)\b|later than expected/i.test(
        statusText,
      )
    ) {
      hasCarrierIssue = true;
    }

    if (!delivered && usps.expectedDeliveryDate) {
      const expectedDelivery = new Date(usps.expectedDeliveryDate);
      if (
        !Number.isNaN(expectedDelivery.getTime()) &&
        expectedDelivery < startOfToday
      ) {
        expectedDeliveryPassed = true;
      }
    }
  }

  if (order.orderFulfillmentStatus === "FULFILLED" && !hasTrackingNumber) {
    reasons.push("Shipped without tracking");
  }
  if (hasCarrierIssue) reasons.push("Carrier reported a delivery issue");
  if (expectedDeliveryPassed) reasons.push("Expected delivery date has passed");
  return reasons;
}

function StepIcon({ step, filled }: { step: StepId; filled: boolean }) {
  const path =
    step === "shipped"
      ? "M12 4l8 5v6c0 4.4-3.2 7.9-8 9-4.8-1.1-8-4.6-8-9V9l8-5z"
      : step === "processing"
        ? "M12 6a6 6 0 110 12 6 6 0 010-12zm0 3.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"
        : "M12 2a10 10 0 110 20 10 10 0 010-20zm0 3a7 7 0 100 14A7 7 0 0012 5zm-1.8 4h3.6v1.6h-2v3.2h2V15.4h-3.6v-1.6h2V10.6h-2V9z";
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

function StatusBadge({
  step,
  label,
  paymentStatus,
}: {
  step: StepId;
  label: string;
  paymentStatus: string;
}) {
  if (paymentStatus === "FULLY_REFUNDED") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        Refunded
      </span>
    );
  }

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STEP_STYLES[step].badge}`}>
      {label}
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
  const [listingUsers, setListingUsers] = useState<string[]>([]);
  const [usingSandboxOrders, setUsingSandboxOrders] = useState(false);
  const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState<StepId | "all">("all");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showRefunded, setShowRefunded] = useState(false);
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [orderWindowDays, setOrderWindowDays] = useState<30 | 90>(30);
  const abortRef = useRef<AbortController | null>(null);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  const [extraImages, setExtraImages] = useState<Record<string, string[]>>({});
  const extraTriedRef = useRef<Set<string>>(new Set());
  const [uspsByNumber, setUspsByNumber] = useState<Record<string, UspsTracking>>({});
  const [uspsPending, setUspsPending] = useState<Set<string>>(new Set());
  const [uspsFailed, setUspsFailed] = useState<Set<string>>(new Set());
  const uspsTriedRef = useRef<Set<string>>(new Set());

  // Same users + same rolling local 120-day window as Inventory → one SWR cache entry.
  const { listingsByUser, errorsByUser, fetchedAt, isLoading: listingsLoading, isValidating, refresh } = useDefaultEbayListings(
    listingUsers,
  );
  const lastRefreshed = fetchedAt ? new Date(fetchedAt) : null;

  const loadTracking = useCallback(async (signal: AbortSignal) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const usersUri = process.env.NEXT_PUBLIC_USERS_URI;

      const [res, usersRes] = await Promise.all([
        fetch(`${apiUrl}/tracking`, {
          credentials: "include",
          signal,
        }),
        usersUri
          ? fetch(`${apiUrl}/${usersUri}?`, { signal })
          : Promise.resolve(null),
      ]);
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
      if (signal.aborted) return;
      setUsingSandboxOrders(!hasAnyOrders);
      uspsTriedRef.current = new Set();
      setUspsByNumber({});
      setUspsPending(new Set());
      setUspsFailed(new Set());
      setUserGroups(groups.filter((g) => g.orders.length > 0));
      setError("");

      let users: string[] = [];
      if (usersRes?.ok) {
        const usersData = await usersRes.json();
        users = usersData.users || [];
      }
      if (users.length === 0) {
        users = [...new Set(groups.map((g) => g.user))];
      }
      if (!signal.aborted) setListingUsers(users);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setOrdersRefreshing(true);
    Promise.all([refresh(), loadTracking(controller.signal)]).finally(() => {
      if (!controller.signal.aborted) setOrdersRefreshing(false);
    });
  }, [refresh, loadTracking]);

  const listingImages: Record<string, string[]> = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (usingSandboxOrders) {
      for (const [id, url] of Object.entries(SANDBOX_LISTING_IMAGES)) {
        map[id] = [rewriteEbayImageUrl(url), url];
      }
    }
    Object.values(listingsByUser).forEach((items: unknown) => {
      if (!Array.isArray(items)) return;
      items.forEach((item: unknown) => {
        if (!item || typeof item !== "object") return;
        const typedItem = item as { ItemID?: string, PictureDetails?: unknown };
        if (!typedItem.ItemID) return;
        const candidates = listingImageCandidates(typedItem.PictureDetails as any);
        if (candidates.length > 0) map[typedItem.ItemID] = candidates;
      });
    });
    for (const [id, urls] of Object.entries(extraImages)) {
      if (!map[id] && urls.length > 0) map[id] = urls;
    }
    return map;
  }, [usingSandboxOrders, listingsByUser, extraImages]);

  useEffect(() => {
    // Only ids on the current board (30 or 90). Expanding to 90 fetches the
    // extra misses; extraTriedRef skips anything already looked up.
    if (usingSandboxOrders || listingsLoading || listingUsers.length === 0) return;
    const missing: { user: string; id: string }[] = [];
    const cachedHits: Record<string, string[]> = {};
    for (const group of userGroups) {
      for (const order of group.orders) {
        if (!isWithinLocalDays(order.creationDate, orderWindowDays)) continue;
        for (const line of order.lineItems ?? []) {
          const id = line.legacyItemId;
          if (!id) continue;
          const key = `${group.user}:${id}`;
          if (listingImages[id]?.length || extraImages[id] || extraTriedRef.current.has(key)) continue;
          const cached = getCachedListingItem(group.user, id);
          if (cached) {
            extraTriedRef.current.add(key);
            const urls = listingImageCandidates(cached.PictureDetails);
            if (urls.length > 0) cachedHits[id] = urls;
            continue;
          }
          extraTriedRef.current.add(key);
          missing.push({ user: group.user, id });
        }
      }
    }
    if (Object.keys(cachedHits).length > 0) {
      setExtraImages((prev) => ({ ...prev, ...cachedHits }));
    }
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const found: Record<string, string[]> = {};
      await Promise.all(
        missing.map(async ({ user, id }) => {
          try {
            const item = await fetchListingItem(user, id);
            if (!item) return;
            rememberListingItem(user, item);
            const urls = listingImageCandidates(item.PictureDetails);
            if (urls.length > 0) found[id] = urls;
          } catch (err) {
            console.error(`GetItem failed for ${user} ${id}:`, err);
          }
        }),
      );
      if (!cancelled && Object.keys(found).length > 0) {
        setExtraImages((prev) => ({ ...prev, ...found }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderWindowDays, userGroups, listingsByUser, listingsLoading, usingSandboxOrders, listingUsers, extraImages, listingImages]);

  useEffect(() => {
    if (usingSandboxOrders) return;
    type Job = { number: string; mailingDate?: string; destinationZIPCode?: string };
    const missing: Job[] = [];
    for (const group of userGroups) {
      for (const order of group.orders) {
        if (!isWithinLocalDays(order.creationDate, orderWindowDays)) continue;
        const destZIP =
          order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.postalCode;
        for (const f of order.shippingFulfillments ?? []) {
          if (!isUspsCarrier(f.shippingCarrierCode)) continue;
          const number = f.shipmentTrackingNumber?.trim();
          if (!number || uspsByNumber[number] || f.uspsTracking) continue;
          if (uspsTriedRef.current.has(number)) continue;
          uspsTriedRef.current.add(number);
          missing.push({
            number,
            mailingDate: f.shippedDate,
            destinationZIPCode: destZIP,
          });
        }
      }
    }
    if (missing.length === 0) return;

    setUspsPending((prev) => {
      const next = new Set(prev);
      for (const job of missing) next.add(job.number);
      return next;
    });

    let cancelled = false;
    (async () => {
      const found: Record<string, UspsTracking> = {};
      const failed: string[] = [];
      await Promise.all(
        missing.map(async ({ number, mailingDate, destinationZIPCode }) => {
          try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
            const params = new URLSearchParams();
            if (mailingDate) params.set("mailingDate", mailingDate);
            if (destinationZIPCode) params.set("destinationZIPCode", destinationZIPCode);
            const qs = params.toString();
            const res = await fetch(
              `${apiUrl}/tracking/${encodeURIComponent(number)}${qs ? `?${qs}` : ""}`,
              { credentials: "include" },
            );
            if (!res.ok) throw new Error(`USPS ${res.status}`);
            found[number] = (await res.json()) as UspsTracking;
          } catch (err) {
            console.error(`USPS lookup failed for ${number}:`, err);
            failed.push(number);
          }
        }),
      );
      if (cancelled) {
        for (const job of missing) uspsTriedRef.current.delete(job.number);
      } else {
        if (Object.keys(found).length > 0) {
          setUspsByNumber((prev) => ({ ...prev, ...found }));
        }
        if (failed.length > 0) {
          setUspsFailed((prev) => {
            const next = new Set(prev);
            for (const n of failed) next.add(n);
            return next;
          });
        }
      }
      setUspsPending((prev) => {
        const next = new Set(prev);
        for (const job of missing) next.delete(job.number);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [orderWindowDays, userGroups, usingSandboxOrders, uspsByNumber]);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    loadTracking(controller.signal);
    return () => controller.abort();
  }, [loadTracking]);

  const getProgressState = (order: Order): StepId | null => {
    const isPaid =
      order.orderPaymentStatus === "PAID" ||
      order.orderPaymentStatus === "FULLY_REFUNDED";
    const isShipped = order.orderFulfillmentStatus === "FULFILLED";
    const isProcessing = order.orderFulfillmentStatus === "IN_PROGRESS";

    if (isShipped) return "shipped";
    if (isProcessing) return "processing";
    if (isPaid) return "paid";
    return null;
  };

  const boardCards = useMemo(() => {
    const cards: BoardCard[] = [];
    for (const group of userGroups) {
      if (hiddenUsers.has(group.user)) continue;
      for (const order of group.orders) {
        if (!isWithinLocalDays(order.creationDate, orderWindowDays)) continue;
        if (!showRefunded && order.orderPaymentStatus === "FULLY_REFUNDED") continue;
        const step = getProgressState(order);
        if (!step) continue;
        const attentionReasons = getAttentionReasons(order, uspsByNumber);
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
          const status = itemStatus(step, item);
          cards.push({
            key: `${order.orderId}-${item.lineItemId}`,
            user: group.user,
            order,
            item,
            step,
            badgeStep: status.badgeStep,
            statusLabel: status.label,
            attentionReasons,
          });
        }
      }
    }
    return cards;
  }, [userGroups, showRefunded, orderWindowDays, hiddenUsers, uspsByNumber]);

  const attentionCount = boardCards.filter(
    (card) => card.attentionReasons.length > 0,
  ).length;
  const stageCards =
    activeStep === "all" ? boardCards : boardCards.filter((card) => card.step === activeStep);
  const visibleCards = needsAttentionOnly
    ? stageCards.filter((card) => card.attentionReasons.length > 0)
    : stageCards;

  const userStats = useMemo(() => {
    const stats: Record<
      string,
      { orders: number; shipped: number; processing: number; total: string | null }
    > = {};
    for (const group of userGroups) {
      if (hiddenUsers.has(group.user)) continue;
      const orders = group.orders.filter((o) => {
        if (!isWithinLocalDays(o.creationDate, orderWindowDays)) return false;
        if (!showRefunded && o.orderPaymentStatus === "FULLY_REFUNDED") return false;
        if (!getProgressState(o)) return false;
        return true;
      });
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
  }, [userGroups, showRefunded, orderWindowDays, hiddenUsers]);

  const uniqueUsersArray = useMemo(
    () => Array.from(new Set(userGroups.map((g) => g.user))),
    [userGroups],
  );
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
    <div className="page-content-shell bg-background">
      <PageHeader
        title="Tracking"
        description={
          needsAttentionOnly
            ? `Showing items that need attention from the last ${orderWindowDays} days.`
            : `Showing the last ${orderWindowDays} days.`
        }
      />

      {Object.keys(errorsByUser).length > 0 && (
        <div className="mb-4 space-y-2">
          {Object.entries(errorsByUser).map(([user, message]) => (
            <p key={user} className="font-medium text-red-500">
              {user}: Request failed: {String(message)}
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
          <PageActionBar ariaLabel="Tracking controls">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="grid w-full grid-cols-2 rounded-xl border border-border/60 bg-background/60 p-1 sm:flex sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setOrderWindowDays(30)}
                    aria-pressed={orderWindowDays === 30}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                      orderWindowDays === 30
                        ? "bg-surface text-text-primary shadow-sm"
                        : "text-text-secondary hover:bg-hover/70 hover:text-text-primary"
                    }`}
                  >
                    Last 30 days
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderWindowDays(90)}
                    aria-pressed={orderWindowDays === 90}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                      orderWindowDays === 90
                        ? "bg-surface text-text-primary shadow-sm"
                        : "text-text-secondary hover:bg-hover/70 hover:text-text-primary"
                    }`}
                  >
                    Last 90 days
                  </button>
                </div>
                <button
                  type="button"
                  aria-pressed={needsAttentionOnly}
                  onClick={() => setNeedsAttentionOnly((current) => !current)}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors sm:w-auto ${
                    needsAttentionOnly
                      ? "border-amber-400/60 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                      : "border-border/60 bg-background/60 text-text-secondary hover:bg-hover/70 hover:text-text-primary"
                  }`}
                >
                  Needs attention
                  <span className="rounded-full bg-current/10 px-1.5 py-0.5 text-xs">
                    {attentionCount}
                  </span>
                </button>
                <div className="flex select-none items-center justify-between gap-2.5 text-sm text-text-secondary sm:justify-start">
                  <span>Show refunded</span>
                  <button
                    type="button"
                    role="switch"
                    aria-label="Show refunded"
                    aria-checked={showRefunded}
                    onClick={() => setShowRefunded((refunded) => !refunded)}
                    className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                      showRefunded ? "bg-emerald-400 dark:bg-emerald-500" : "bg-border/50"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        showRefunded ? "left-4.5" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <RefreshAction
                updated={lastRefreshed ? formatFetchedAt(lastRefreshed) : null}
                refreshing={isValidating || ordersRefreshing}
                onRefresh={handleRefresh}
              />
            </div>

            {listingUsers.length > 0 && (
              <div className="px-1 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Sellers</span>
                  {listingUsers.map((user) => {
                    const visible = !hiddenUsers.has(user);
                    return (
                      <label
                        key={user}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          visible
                            ? "border-primary/25 bg-primary/10 text-primary"
                            : "border-border/60 bg-background/60 text-text-muted"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => {
                            setHiddenUsers((previous) => {
                              const next = new Set(previous);
                              if (next.has(user)) next.delete(user);
                              else next.add(user);
                              return next;
                            });
                          }}
                          className="h-3.5 w-3.5 cursor-pointer accent-primary"
                        />
                        {user}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </PageActionBar>
          <div className="mb-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <div className="grid grid-cols-1 gap-px bg-border/70 sm:grid-cols-3">
              {STEPS.map((step) => {
                const count = boardCards.filter((c) => c.step === step.id).length;
                const active = activeStep === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStep(active ? "all" : step.id)}
                    aria-pressed={active}
                    className={`flex min-w-0 items-center gap-2 px-3 py-3 text-left transition-colors sm:gap-3 sm:px-4 sm:py-3.5 ${
                      active ? "bg-surface-light/70" : "bg-surface hover:bg-hover/60"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 sm:h-9 sm:w-9 ${
                        active
                          ? `border-transparent text-white ${STEP_STYLES[step.id].bar}`
                          : "border-border/60 text-text-secondary"
                      }`}
                    >
                      <StepIcon step={step.id} filled={active} />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-sm font-semibold leading-tight ${
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
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {userGroups.filter(g => !hiddenUsers.has(g.user)).map((group) => {
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
                      <dt>Partially fulfilled</dt>
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
              {needsAttentionOnly ? "Needs attention" : activeStep === "all" ? "All items" : STEPS.find((step) => step.id === activeStep)?.label}{" "}
              ({visibleCards.length})
            </h2>
            {(needsAttentionOnly || activeStep !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setNeedsAttentionOnly(false);
                  setActiveStep("all");
                }}
                className="text-xs font-medium text-hover underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {visibleCards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-10 text-center text-sm text-text-secondary">
              {needsAttentionOnly
                ? "No items need attention."
                : "No items in this stage."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 sm:gap-y-6 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleCards.map(({ key, user, order, item, badgeStep, statusLabel, attentionReasons }) => {
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
                const detailsExpanded = expandedCards.has(key);

                return (
                  <article
                    key={key}
                    className={`flex min-w-0 flex-col rounded-xl border border-border/50 ${USER_TONES[toneIdx]} p-3 shadow-sm sm:p-3.5`}
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

                    <div className="mt-3">
                      <StatusBadge
                        step={badgeStep}
                        label={statusLabel}
                        paymentStatus={order.orderPaymentStatus}
                      />
                    </div>

                    {needsAttentionOnly && (
                      <p className="mt-2 rounded-lg bg-amber-100/80 px-2.5 py-2 text-xs font-medium leading-relaxed text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                        {attentionReasons.join(" · ")}
                      </p>
                    )}

                    <button
                      type="button"
                      aria-expanded={detailsExpanded}
                      onClick={() => {
                        setExpandedCards((previous) => {
                          const next = new Set(previous);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        });
                      }}
                      className="mt-3 flex w-full items-center justify-between rounded-lg border border-border/50 bg-surface/50 px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-hover/60 hover:text-text-primary sm:hidden"
                    >
                      Order details
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className={`h-4 w-4 transition-transform ${detailsExpanded ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      >
                        <path d="m5 7.5 5 5 5-5" />
                      </svg>
                    </button>

                    {/* Details */}
                    <dl className={`${detailsExpanded ? "block" : "hidden"} mt-3 space-y-1.5 border-t border-border/40 pt-2.5 sm:block`}>
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
                      {(order.shippingFulfillments ?? []).map((f, i) => {
                        const number = f.shipmentTrackingNumber?.trim();
                        const usps =
                          (number && uspsByNumber[number]) || f.uspsTracking;
                        const uspsLoading =
                          !!number &&
                          isUspsCarrier(f.shippingCarrierCode) &&
                          !usps &&
                          !usingSandboxOrders &&
                          (uspsPending.has(number) || !uspsTriedRef.current.has(number));
                        const events = usps?.trackingEvents ?? [];
                        const uspsExpected = formatDate(usps?.expectedDeliveryDate);
                        const trackingHref =
                          number && isUspsCarrier(f.shippingCarrierCode)
                            ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(number)}`
                            : null;
                        return (
                          <div
                            key={f.fulfillmentId || number || i}
                            className="space-y-1.5"
                          >
                            {f.shippingCarrierCode && (
                              <DetailRow label="Carrier">
                                {f.shippingCarrierCode}
                              </DetailRow>
                            )}
                            {number && (
                              <DetailRow label="Tracking">
                                {trackingHref ? (
                                  <a
                                    href={trackingHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="break-all font-mono text-hover hover:underline"
                                  >
                                    {number}
                                  </a>
                                ) : (
                                  <span className="break-all font-mono">
                                    {number}
                                  </span>
                                )}
                              </DetailRow>
                            )}
                            {formatDate(f.shippedDate) && (
                              <DetailRow label="Shipped">
                                {formatDate(f.shippedDate)}
                              </DetailRow>
                            )}
                            {uspsLoading && (
                              <DetailRow label="USPS">
                                <span className="animate-pulse text-text-secondary">
                                  Loading…
                                </span>
                              </DetailRow>
                            )}
                            {!uspsLoading &&
                              number &&
                              isUspsCarrier(f.shippingCarrierCode) &&
                              uspsFailed.has(number) &&
                              !usps && (
                                <DetailRow label="USPS">
                                  <span className="text-text-secondary">
                                    Unavailable
                                  </span>
                                </DetailRow>
                              )}
                            {usps?.status && (
                              <DetailRow label="USPS">
                                {stripUspsMarkup(usps.status)}
                              </DetailRow>
                            )}
                            {stripUspsMarkup(usps?.mailClass) && (
                              <DetailRow label="Mail class">
                                {stripUspsMarkup(usps?.mailClass)}
                              </DetailRow>
                            )}
                            {uspsExpected && (
                              <DetailRow label="USPS delivery">
                                {uspsExpected}
                              </DetailRow>
                            )}
                            {usps?.statusSummary && (
                              <p className="text-[11px] leading-snug text-text-secondary">
                                {stripUspsMarkup(usps.statusSummary)}
                              </p>
                            )}
                            {events.length > 0 && (
                              <ol className="space-y-1 border-l border-border/50 pl-2.5">
                                {events.slice(0, 5).map((event, ei) => (
                                  <li
                                    key={`${event.eventTimestamp || ei}-${event.eventCode || event.eventType || ei}`}
                                    className="text-[11px] leading-snug"
                                  >
                                    <span className="font-medium text-text-primary">
                                      {stripUspsMarkup(event.eventType) || "Scan"}
                                    </span>
                                    {(formatDateTime(event.eventTimestamp) ||
                                      eventLocation(event)) && (
                                      <span className="block text-text-secondary">
                                        {[
                                          formatDateTime(event.eventTimestamp),
                                          eventLocation(event),
                                        ]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        );
                      })}
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
