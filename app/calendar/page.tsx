
"use client";
import { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import PageHeader from "@/components/PageHeader";
import PageActionBar, { RefreshAction } from "@/components/PageActionBar";
import { fetchAllPayouts, Payout } from "@/lib/ebay-data";
import { useUsers } from "@/components/UsersContext";
import { formatCurrency } from "@/lib/format-utils";
import { SANDBOX_SELLERS, SANDBOX_ORDERS, SANDBOX_LISTING_IMAGES } from "../tracking/sandbox-data";
import PersonIcon from "@/components/PersonIcon";
import { useDefaultEbayListings } from "@/lib/useEbayListings";
import { listingImageCandidates, rewriteEbayImageUrl, fetchListingItem } from "@/lib/ebay-data";
import { formatFetchedAt } from "@/lib/date-range";
import { getCachedListingItem, rememberListingItem } from "@/lib/listings-interval-cache";
import { trackedFetch } from "@/lib/api-tracker";

interface UspsTracking {
  expectedDeliveryDate?: string;
}

interface ShippingFulfillment {
  fulfillmentId?: string;
  shipmentTrackingNumber?: string;
  shippingCarrierCode?: string;
  shippedDate?: string;
  uspsTracking?: UspsTracking;
}

interface LineItem {
  lineItemId: string;
  legacyItemId: string;
  title: string;
  sku: string;
  quantity: number;
  total?: { value: string; currency: string };
}

interface Order {
  orderId: string;
  legacyOrderId: string;
  creationDate: string;
  lastModifiedDate?: string;
  orderPaymentStatus: string;
  orderFulfillmentStatus: string;
  buyer?: {
    username?: string;
  };
  pricingSummary?: {
    total?: { value: string; currency: string };
    deliveryCost?: { value: string; currency: string };
  };
  fulfillmentStartInstructions?: {
    minEstimatedDeliveryDate?: string;
    maxEstimatedDeliveryDate?: string;
    shippingStep?: {
      shipTo?: {
        postalCode?: string;
      };
    };
  }[];
  shippingFulfillments?: ShippingFulfillment[];
  lineItems: LineItem[];
}

interface UserOrders {
  user: string;
  orders: Order[];
}
type OrderEventType = "Order Created" | "Shipped" | "Expected Delivery";
type TimelineFill = "done" | "remaining";

interface CalendarTrackingEvent {
  type: OrderEventType;
  order: Order;
  user: string;
  details?: string;
  disclaimer?: string;
}
interface OrderTimeline {
  id: string;
  order: Order;
  user: string;
  start: string;
  end: string;
  shipped?: string;
}


const ORDER_TIMELINE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#14b8a6",
  "#6366f1", "#d946ef", "#0ea5e9", "#22c55e", "#eab308",
];

function orderTimelineColor(order: Order): string {
  const id = order.legacyOrderId || order.orderId;
  let hash = 0;
  for (let index = 0; index < id.length; index++) {
    hash = id.charCodeAt(index) + ((hash << 5) - hash);
  }
  return ORDER_TIMELINE_COLORS[Math.abs(hash) % ORDER_TIMELINE_COLORS.length];
}
function isUspsCarrier(code?: string): boolean {
  const normalized = (code || "").trim().toUpperCase();
  return normalized === "USPS" || normalized.startsWith("USPS") || normalized.includes("US POSTAL");
}

function isUnshippedRefund(order: Order): boolean {
  const isRefunded = order.orderPaymentStatus.trim().toUpperCase() === "FULLY_REFUNDED";
  const hasShipped = order.shippingFulfillments?.some(fulfillment => Boolean(fulfillment.shippedDate)) ?? false;
  return isRefunded && !hasShipped;
}

const EBAY_DELIVERY_FALLBACK_DISCLAIMER =
  "USPS does not currently provide an expected delivery date. This date uses eBay's estimate instead.";

function resolveExpectedDelivery(
  order: Order,
  uspsByNumber: Record<string, UspsTracking>,
  uspsUnavailable: Set<string>,
): { date?: string; isEbayFallback: boolean } {
  if (isUnshippedRefund(order)) {
    return { date: undefined, isEbayFallback: false };
  }
  const ebayDate = order.fulfillmentStartInstructions?.[0]?.maxEstimatedDeliveryDate;
  const shippedUsps = order.shippingFulfillments?.find(
    fulfillment => Boolean(fulfillment.shippedDate) &&
      (isUspsCarrier(fulfillment.shippingCarrierCode) || Boolean(fulfillment.uspsTracking))
  );
  if (!shippedUsps) return { date: ebayDate, isEbayFallback: false };

  const number = shippedUsps.shipmentTrackingNumber?.trim();
  const uspsDate = shippedUsps.uspsTracking?.expectedDeliveryDate ||
    (number ? uspsByNumber[number]?.expectedDeliveryDate : undefined);
  if (uspsDate) return { date: uspsDate, isEbayFallback: false };

  const shouldFallback = !number || uspsUnavailable.has(number);
  return {
    date: shouldFallback ? ebayDate : undefined,
    isEbayFallback: shouldFallback && Boolean(ebayDate),
  };
}


function timelineFillStyle(fill: TimelineFill, color: string): CSSProperties {
  if (fill === "remaining") {
    return {
      backgroundImage: `linear-gradient(to right, ${color} 50%, transparent 50%)`,
      backgroundSize: "12.5% 100%",
      backgroundRepeat: "repeat-x",
      opacity: 1,
    };
  }
  return { backgroundColor: color, opacity: 1 };
}
function calendarEventDomId(dateStr: string, event: CalendarTrackingEvent): string {
  const identity = `${event.order.orderId}-${event.type}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `calendar-event-${dateStr}-${identity}`;
}


function OrderStateIcon({ type, className = "h-3.5 w-3.5" }: { type: OrderEventType; className?: string }) {
  if (type === "Shipped") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M10 17h4V5H2v12h3" />
        <path d="M14 9h4l4 4v4h-3" />
        <circle cx="7.5" cy="17.5" r="2.5" />
        <circle cx="16.5" cy="17.5" r="2.5" />
      </svg>
    );
  }
  if (type === "Expected Delivery") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18m-9 4v3m0 0 2-1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4.5 7.7 7.5 4.2 7.5-4.2M12 12v9" />
    </svg>
  );
}
function CalendarMilestoneButton({
  trackingEvent,
  line,
  candidates,
  domId,
  isPinned,
  onHoverChange,
  onSelect,
}: {
  trackingEvent: CalendarTrackingEvent;
  line: OrderTimeline;
  candidates: string[];
  domId: string;
  isPinned: boolean;
  onHoverChange: (orderId: string | null) => void;
  onSelect: () => void;
}) {
  const color = orderTimelineColor(trackingEvent.order);
  const item = trackingEvent.order.lineItems?.[0];

  return (
    <button
      id={domId}
      type="button"
      aria-label={`${trackingEvent.type} for ${item?.title || `order ${trackingEvent.order.legacyOrderId}`}. Hover, focus, or select to show its timeline.${trackingEvent.disclaimer ? ` ${trackingEvent.disclaimer}` : ""}`}
      aria-pressed={isPinned}
      className="group/event relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border shadow-sm transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:scale-105 focus-visible:-translate-y-0.5 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 motion-reduce:transform-none motion-reduce:transition-none sm:h-6 sm:w-6"
      style={{
        color,
        borderColor: color,
        backgroundColor: "var(--color-surface)",
        boxShadow: isPinned ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${color}` : undefined,
      }}
      onMouseEnter={() => onHoverChange(line.id)}
      onMouseLeave={() => onHoverChange(null)}
      onFocus={() => onHoverChange(line.id)}
      onBlur={() => onHoverChange(null)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <OrderStateIcon type={trackingEvent.type} className="h-[70%] w-[70%]" />
      {trackingEvent.type === "Expected Delivery" && trackingEvent.disclaimer && (
        <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 ring-1 ring-surface" />
      )}

      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-[80] mb-2 hidden w-52 -translate-x-1/2 flex-col rounded-xl border-[3px] bg-surface/95 p-3 text-left shadow-xl backdrop-blur-md md:group-hover/event:flex md:group-focus-visible/event:flex"
        style={{ borderColor: color }}
      >
        {candidates.length > 0 && (
          <img src={candidates[0]} alt="" className="mb-2.5 h-28 w-full rounded-lg bg-white/50 object-contain" />
        )}
        <span className="truncate text-sm font-bold tracking-tight text-text-primary">{item?.title || `Order #${trackingEvent.order.legacyOrderId}`}</span>
        <span className="mt-1 text-[11px] font-medium text-text-secondary">Order: {trackingEvent.order.legacyOrderId}</span>
        <span className="text-[11px] text-text-secondary/80">Buyer: {trackingEvent.order.buyer?.username || "Unknown"}</span>
        <span className="mt-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
          {trackingEvent.type}
        </span>
        {trackingEvent.disclaimer && (
          <span className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[10px] font-medium leading-snug text-text-primary">
            {trackingEvent.disclaimer}
          </span>
        )}
      </span>
    </button>
  );
}


export default function Calendar() {
  const { data: session } = useSession();
  const { users, loadingUsers } = useUsers();
  
  const [activeTab, setActiveTab] = useState<"payouts" | "tracking">("payouts");
  const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(new Set());
  
  // Data states
  const [userPayouts, setUserPayouts] = useState<{ [user: string]: Payout[] }>({});
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);

  const [userOrders, setUserOrders] = useState<UserOrders[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [usingSandboxOrders, setUsingSandboxOrders] = useState(false);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  const [extraImages, setExtraImages] = useState<Record<string, string[]>>({});
  const extraTriedRef = useRef<Set<string>>(new Set());
  const [uspsByNumber, setUspsByNumber] = useState<Record<string, UspsTracking>>({});
  const uspsTriedRef = useRef<Set<string>>(new Set());
  const [uspsUnavailable, setUspsUnavailable] = useState<Set<string>>(new Set());

  const abortRef = useRef<AbortController | null>(null);

  // Calendar State
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(
    new Date().toLocaleDateString("en-CA")
  );
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [expandedEventsDateStr, setExpandedEventsDateStr] = useState<string | null>(null);
  const [pendingCalendarEventId, setPendingCalendarEventId] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const detailsRef = useRef<HTMLDivElement | null>(null);
  const detailCardsRef = useRef<HTMLDivElement | null>(null);
  const detailCardsContentRef = useRef<HTMLDivElement | null>(null);
  const [showDetailsFade, setShowDetailsFade] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const updateDetailsFade = useCallback(() => {
    const details = detailCardsRef.current;
    if (!details) {
      setShowDetailsFade(false);
      return;
    }

    const remainingScroll = details.scrollHeight - details.clientHeight - details.scrollTop;
    setShowDetailsFade(remainingScroll > 1);
  }, []);


  const selectDate = useCallback((dateStr: string) => {
    setSelectedDateStr(dateStr);
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      window.requestAnimationFrame(() => {
        detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);
  const showEventOnCalendar = useCallback((dateStr: string, event: CalendarTrackingEvent, lineId: string) => {
    setSelectedDateStr(dateStr);
    setSelectedOrderId(lineId);
    setExpandedEventsDateStr(dateStr);
    setPendingCalendarEventId(calendarEventDomId(dateStr, event));
  }, []);
  useEffect(() => {
    if (!pendingCalendarEventId) return;
    const marker = document.getElementById(pendingCalendarEventId);
    if (!marker) return;
    marker.focus({ preventScroll: true });
    marker.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    setPendingCalendarEventId(null);
  }, [pendingCalendarEventId]);

  // SWR Hook for listings (shared with Tracking and Inventory)


  const { listingsByUser, fetchedAt, isLoading: listingsLoading, isValidating, refresh } = useDefaultEbayListings(
    users,
  );
  const lastRefreshed = fetchedAt ? new Date(fetchedAt) : null;

  // Fetch Payouts
  const loadPayouts = useCallback(async (signal: AbortSignal) => {
    if (users.length === 0 || loadingUsers) return;
    setPayoutsLoading(true);
    setPayoutsError(null);
    try {
      const results = await Promise.all(
        users.map(async (user) => {
          try {
            const res = await fetchAllPayouts(user, { signal });
            return { user, payouts: res.payouts || [] };
          } catch (err: any) {
            if (err.name !== "AbortError") console.error(`Failed to fetch payouts for ${user}:`, err);
            return { user, payouts: [] };
          }
        })
      );
      if (signal.aborted) return;
      const map: { [user: string]: Payout[] } = {};
      results.forEach((r) => { map[r.user] = r.payouts; });
      setUserPayouts(map);
    } catch (err: any) {
      if (!signal.aborted) setPayoutsError("Failed to fetch payouts.");
    } finally {
      if (!signal.aborted) setPayoutsLoading(false);
    }
  }, [users, loadingUsers]);

  // Fetch Tracking
  const loadTracking = useCallback(async (signal: AbortSignal) => {
    try {
      setTrackingLoading(true);
      setTrackingError(null);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiUrl}/tracking`, { credentials: "include", signal });
      if (!res.ok) throw new Error("Failed to fetch tracking data");
      const data = await res.json();
      
      let groups: UserOrders[] = [];
      if (Array.isArray(data)) {
        groups = data
          .filter((g: any) => g.user && Array.isArray(g.orders))
          .map((g: any) => ({ user: g.user, orders: g.orders }));
      }
      
      const hasAnyOrders = groups.some(g => g.orders.length > 0);
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
      setUspsUnavailable(new Set());
      setUserOrders(groups);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setTrackingError(err.message || "An error occurred fetching tracking.");
    } finally {
      if (!signal.aborted) setTrackingLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    loadPayouts(controller.signal);
    loadTracking(controller.signal);
    return () => controller.abort();
  }, [loadPayouts, loadTracking]);

  const handleRefresh = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setOrdersRefreshing(true);
    Promise.all([refresh(), loadPayouts(controller.signal), loadTracking(controller.signal)]).finally(() => {
      if (!controller.signal.aborted) setOrdersRefreshing(false);
    });
  }, [refresh, loadPayouts, loadTracking]);

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
    if (usingSandboxOrders || listingsLoading || users.length === 0) return;
    const missing: { user: string; id: string }[] = [];
    const cachedHits: Record<string, string[]> = {};
    for (const group of userOrders) {
      for (const order of group.orders) {
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
  }, [userOrders, users, listingsByUser, listingsLoading, usingSandboxOrders, extraImages, listingImages]);
  useEffect(() => {
    if (usingSandboxOrders) return;

    const jobs: { number: string; mailingDate?: string; destinationZIPCode?: string }[] = [];
    for (const group of userOrders) {
      for (const order of group.orders) {
        const destinationZIPCode =
          order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.postalCode;
        for (const fulfillment of order.shippingFulfillments ?? []) {
          if (
            !fulfillment.shippedDate ||
            (!isUspsCarrier(fulfillment.shippingCarrierCode) && !fulfillment.uspsTracking)
          ) continue;
          const number = fulfillment.shipmentTrackingNumber?.trim();
          if (
            !number ||
            fulfillment.uspsTracking?.expectedDeliveryDate ||
            uspsByNumber[number] ||
            uspsUnavailable.has(number)
          ) continue;
          if (uspsTriedRef.current.has(number)) continue;
          uspsTriedRef.current.add(number);
          jobs.push({
            number,
            mailingDate: fulfillment.shippedDate,
            destinationZIPCode,
          });
        }
      }
    }
    if (jobs.length === 0) return;

    const controller = new AbortController();
    (async () => {
      const found: Record<string, UspsTracking> = {};
      const unavailable: string[] = [];
      await Promise.all(jobs.map(async ({ number, mailingDate, destinationZIPCode }) => {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
          const params = new URLSearchParams();
          if (mailingDate) params.set("mailingDate", mailingDate);
          if (destinationZIPCode) params.set("destinationZIPCode", destinationZIPCode);
          const query = params.toString();
          const response = await trackedFetch(
            `${apiUrl}/tracking/${encodeURIComponent(number)}${query ? `?${query}` : ""}`,
            { credentials: "include", signal: controller.signal },
          );
          if (!response.ok) throw new Error(`USPS ${response.status}`);
          const tracking = (await response.json()) as UspsTracking;
          if (tracking.expectedDeliveryDate) found[number] = tracking;
          else unavailable.push(number);
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.warn(`USPS lookup failed for ${number}; using eBay's estimate when available.`, error);
            unavailable.push(number);
          }
        }
      }));
      if (controller.signal.aborted) return;
      if (Object.keys(found).length > 0) {
        setUspsByNumber(previous => ({ ...previous, ...found }));
      }
      if (unavailable.length > 0) {
        setUspsUnavailable(previous => {
          const next = new Set(previous);
          for (const number of unavailable) next.add(number);
          return next;
        });
      }
    })();

    return () => {
      controller.abort();
      for (const job of jobs) uspsTriedRef.current.delete(job.number);
    };
  }, [userOrders, usingSandboxOrders, uspsByNumber, uspsUnavailable]);


  const toggleUserFilter = (user: string) => {
    setHiddenUsers(prev => {
      const next = new Set(prev);
      if (next.has(user)) next.delete(user);
      else next.add(user);
      return next;
    });
  };

  const getLocalDateStr = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-CA"); // YYYY-MM-DD
  };

  // Group payouts by day map
  const payoutsMap = useMemo(() => {
    const map: Record<string, { total: number, payouts: (Payout & { user: string })[] }> = {};
    for (const [user, payouts] of Object.entries(userPayouts)) {
      if (hiddenUsers.has(user)) continue;
      for (const p of payouts) {
        const amt = Number(p.amount?.value) || 0;
        if (amt === 0) continue;
        if (!p.payoutDate) continue;
        const day = getLocalDateStr(p.payoutDate);
        if (!map[day]) map[day] = { total: 0, payouts: [] };
        map[day].total += amt;
        map[day].payouts.push({ ...p, user });
      }
    }
    return map;
  }, [userPayouts, hiddenUsers]);

  // Group tracking by day map
  const trackingMap = useMemo(() => {
    const map: Record<string, { events: CalendarTrackingEvent[] }> = {};
    for (const group of userOrders) {
      if (hiddenUsers.has(group.user)) continue;
      for (const order of group.orders) {
        if (order.creationDate) {
          const day = getLocalDateStr(order.creationDate);
          if (!map[day]) map[day] = { events: [] };
          map[day].events.push({ type: "Order Created", order, user: group.user });
        }
        if (order.shippingFulfillments) {
          for (const f of order.shippingFulfillments) {
            if (f.shippedDate) {
              const day = getLocalDateStr(f.shippedDate);
              if (!map[day]) map[day] = { events: [] };
              map[day].events.push({ 
                type: "Shipped", 
                order, 
                user: group.user, 
                details: `${f.shippingCarrierCode || "Carrier"} ${f.shipmentTrackingNumber || ""}`
              });
            }
          }
        }
        const expectedDelivery = resolveExpectedDelivery(order, uspsByNumber, uspsUnavailable);
        if (expectedDelivery.date) {
          const day = getLocalDateStr(expectedDelivery.date);
          if (!map[day]) map[day] = { events: [] };
          map[day].events.push({
            type: "Expected Delivery",
            order,
            user: group.user,
            disclaimer: expectedDelivery.isEbayFallback
              ? EBAY_DELIVERY_FALLBACK_DISCLAIMER
              : undefined,
          });
        }
      }
    }
    return map;
  }, [userOrders, hiddenUsers, uspsByNumber, uspsUnavailable]);
  const orderLines = useMemo(() => {
    const lines: OrderTimeline[] = [];
    for (const group of userOrders) {
      if (hiddenUsers.has(group.user)) continue;
      for (const order of group.orders) {
        if (!order.creationDate) continue;
        const start = getLocalDateStr(order.creationDate);
        const expectedDelivery = resolveExpectedDelivery(order, uspsByNumber, uspsUnavailable);
        const shippedDate = order.shippingFulfillments?.find(fulfillment => fulfillment.shippedDate)?.shippedDate;
        let end = start;
        if (expectedDelivery.date) {
          end = getLocalDateStr(expectedDelivery.date);
        } else if (shippedDate) {
          end = getLocalDateStr(shippedDate);
        }

        const shipped = shippedDate ? getLocalDateStr(shippedDate) : undefined;
        
        // ensure start <= end chronologically
        let startDate = new Date(start);
        let endDate = new Date(end);
        if (startDate > endDate) {
          end = start;
        }

        lines.push({ id: order.orderId, order, user: group.user, start, end, shipped });
      }
    }
    return lines;
  }, [userOrders, hiddenUsers, uspsByNumber, uspsUnavailable]);
  const orderLineByOrderId = useMemo(() => {
    const map = new Map<string, OrderTimeline>();
    for (const line of orderLines) {
      map.set(line.order.orderId, line);
      map.set(line.order.legacyOrderId, line);
    }
    return map;
  }, [orderLines]);


  const lineLanes = useMemo(() => {
    const sorted = [...orderLines].sort((a, b) => {
      const cmp = a.start.localeCompare(b.start);
      if (cmp !== 0) return cmp;
      return b.end.localeCompare(a.end); // longer first
    });
    
    const lanesEnd: string[] = [];
    const assignments = new Map<string, number>();
    
    for (const line of sorted) {
      let placed = false;
      for (let i = 0; i < lanesEnd.length; i++) {
        if (lanesEnd[i] < line.start) {
          assignments.set(line.id, i);
          lanesEnd[i] = line.end;
          placed = true;
          break;
        }
      }
      if (!placed) {
        assignments.set(line.id, lanesEnd.length);
        lanesEnd.push(line.end);
      }
    }
    
    return { assignments, maxLanes: lanesEnd.length };
  }, [orderLines]);

  const selectedPayouts = selectedDateStr ? payoutsMap[selectedDateStr] : null;
  const selectedTracking = selectedDateStr ? trackingMap[selectedDateStr] : null;

  useEffect(() => {
    if (!mounted) return;

    const frame = window.requestAnimationFrame(updateDetailsFade);
    const resizeObserver = new ResizeObserver(updateDetailsFade);
    if (detailCardsRef.current) {
      resizeObserver.observe(detailCardsRef.current);
    }
    if (detailCardsContentRef.current) {
      resizeObserver.observe(detailCardsContentRef.current);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [activeTab, mounted, selectedDateStr, selectedPayouts, selectedTracking, updateDetailsFade]);

  useEffect(() => {
    detailCardsRef.current?.scrollTo({ top: 0 });
    updateDetailsFade();
  }, [activeTab, selectedDateStr, updateDetailsFade]);
  if (!mounted) return null;

  // Calendar math
  const currentYear = currentMonthDate.getFullYear();
  const currentMonth = currentMonthDate.getMonth(); // 0-11
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0-6
  const trailingBlanks = (7 - ((firstDayOfMonth + daysInMonth) % 7)) % 7;
  const totalCells = firstDayOfMonth + daysInMonth + trailingBlanks;

  const prevMonth = () => setCurrentMonthDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentMonthDate(new Date(currentYear, currentMonth + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setCurrentMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateStr(now.toLocaleDateString("en-CA"));
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

  const formatMoney = (amount?: { value: string; currency: string }) => {
    if (!amount) return "";
    const num = parseFloat(amount.value);
    if (Number.isNaN(num)) return amount.value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: amount.currency || "USD",
    }).format(num);
  };

  return (
    <div className="page-content-shell bg-background">
      <PageHeader
        title="Calendar"
        description={<span className="italic">Daily overview of your Payouts and Tracking events.</span>}
      />
      
      {/* Controls */}
      <PageActionBar ariaLabel="Calendar controls">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid w-full grid-cols-2 rounded-xl border border-border/60 bg-background/60 p-1 sm:flex sm:w-auto">
            <button
              onClick={() => setActiveTab("payouts")}
              aria-pressed={activeTab === "payouts"}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === "payouts"
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:bg-hover/70 hover:text-text-primary"
              }`}
            >
              Payouts
            </button>
            <button
              onClick={() => setActiveTab("tracking")}
              aria-pressed={activeTab === "tracking"}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === "tracking"
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:bg-hover/70 hover:text-text-primary"
              }`}
            >
              Tracking
            </button>
          </div>
          {activeTab === "tracking" && (
            <div aria-label="Tracking legend" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[10px] font-semibold text-text-muted sm:text-xs">
              <span className="uppercase tracking-wider">Events</span>
              {(["Order Created", "Shipped", "Expected Delivery"] as const).map((type) => (
                <span key={type} className="inline-flex items-center gap-1 whitespace-nowrap">
                  <span className="flex h-4 w-4 items-center justify-center rounded border border-border/70 bg-background/70">
                    <OrderStateIcon type={type} className="h-3 w-3" />
                  </span>
                  {type === "Order Created" ? "Created" : type === "Expected Delivery" ? "Expected" : type}
                </span>
              ))}
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span aria-hidden="true" className="h-1.5 w-6 rounded-full" style={timelineFillStyle("done", "#64748b")} />
                Done
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span aria-hidden="true" className="h-1.5 w-6 rounded-full" style={timelineFillStyle("remaining", "#64748b")} />
                Remaining
              </span>
              <span className="hidden font-normal italic text-text-muted/80 2xl:inline">Hover, focus, or select an event to trace its order</span>
            </div>
          )}

          <RefreshAction
            updated={lastRefreshed ? formatFetchedAt(lastRefreshed) : null}
            refreshing={isValidating || ordersRefreshing}
            onRefresh={handleRefresh}
          />
        </div>

        {users.length > 0 && (
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max items-center gap-2">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Sellers</span>
              {users.map((u) => {
                const visible = !hiddenUsers.has(u);
                return (
                  <label
                    key={u}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      visible
                        ? "border-primary/25 bg-primary/10 text-primary"
                        : "border-border/60 bg-background/60 text-text-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => toggleUserFilter(u)}
                      className="h-3.5 w-3.5 cursor-pointer accent-primary"
                    />
                    {u}
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </PageActionBar>
      
      {/* Loading States */}
      {(activeTab === "payouts" && payoutsLoading) || (activeTab === "tracking" && trackingLoading) ? (
        <div className="mb-4 text-primary animate-pulse text-sm font-medium">Loading data...</div>
      ) : (activeTab === "payouts" && payoutsError) || (activeTab === "tracking" && trackingError) ? (
        <div className="mb-4 text-error-text text-sm font-medium">Error loading data.</div>
      ) : null}

      <div className="flex flex-col gap-6 xl:flex-row xl:gap-8">
        
        {/* Calendar Grid Area */}
        <div ref={calendarRef} className="min-w-0 flex-grow scroll-mt-4">
          {/* Calendar Header */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
              {currentMonthDate.toLocaleString('default', { month: 'long' })}
              <span className="ml-2 font-light text-text-secondary">{currentMonthDate.getFullYear()}</span>
            </h2>
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={goToToday} className="px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold border border-border/80 rounded-full hover:bg-hover hover:text-primary transition-all bg-surface shadow-sm active:scale-95">
                Today
              </button>
              <div className="flex border border-border/80 rounded-full overflow-hidden bg-surface shadow-sm">
                <button onClick={prevMonth} className="px-3 py-1.5 sm:py-2 hover:bg-hover hover:text-primary transition-colors border-r border-border/80 active:bg-hover/80" aria-label="Previous Month">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <button onClick={nextMonth} className="px-3 py-1.5 sm:py-2 hover:bg-hover hover:text-primary transition-colors active:bg-hover/80" aria-label="Next Month">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px bg-border/40 rounded-2xl shadow-sm border border-border/50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
              <div key={day} className={`bg-surface/90 py-3 text-center text-[10px] sm:text-xs font-bold text-text-secondary uppercase tracking-widest border-b border-border/30 ${i === 0 ? 'rounded-tl-2xl' : ''} ${i === 6 ? 'rounded-tr-2xl' : ''}`}>
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.charAt(0)}</span>
              </div>
            ))}
            
            {/* Blanks and Days combined */}
            {Array.from({ length: totalCells }).map((_, i) => {
              const isFirstOfLastRow = i === totalCells - 7;
              const isLastOfLastRow = i === totalCells - 1;
              const cornerClasses = `${isFirstOfLastRow ? 'rounded-bl-2xl' : ''} ${isLastOfLastRow ? 'rounded-br-2xl' : ''}`;
              
              if (i < firstDayOfMonth || i >= firstDayOfMonth + daysInMonth) {
                return <div key={`blank-${i}`} className={`bg-surface/60 min-h-[90px] sm:min-h-[112px] ${cornerClasses}`}></div>;
              }
              
              const date = i - firstDayOfMonth + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
              const isSelected = dateStr === selectedDateStr;
              const isToday = dateStr === new Date().toLocaleDateString("en-CA");
              
              const dayPayouts = payoutsMap[dateStr];
              const dayTracking = trackingMap[dateStr];
              
              const dayEvents = dayTracking?.events ?? [];
              const eventCount = dayEvents.length;
              const isOverflowExpanded = expandedEventsDateStr === dateStr;
              const visibleEventLimit = eventCount > 2 ? 1 : Math.min(eventCount, 2);
              const activeTraceOrderId = hoveredOrderId || selectedOrderId;
              const activeEventIndex = !isOverflowExpanded && activeTraceOrderId
                ? dayEvents.findIndex(event => orderLineByOrderId.get(event.order.orderId)?.id === activeTraceOrderId)
                : -1;
              const visibleDayEvents = activeEventIndex >= visibleEventLimit
                ? [dayEvents[activeEventIndex], ...dayEvents.slice(0, Math.max(0, visibleEventLimit - 1))]
                : dayEvents.slice(0, visibleEventLimit);
              const hiddenDayEvents = dayEvents.filter(event => !visibleDayEvents.includes(event));
              const hiddenEventCount = hiddenDayEvents.length;
               
              const activeLines = orderLines.filter(l => l.start <= dateStr && l.end >= dateStr);
              const todayStr = new Date().toLocaleDateString("en-CA");
              const calendarColumn = i % 7;
              const overflowAlignment = calendarColumn <= 1
                ? "left-0"
                : calendarColumn >= 5
                  ? "right-0"
                  : "left-1/2 -translate-x-1/2";
              const renderMilestone = (trackingEvent: CalendarTrackingEvent) => {
                const line = orderLineByOrderId.get(trackingEvent.order.orderId);
                if (!line) return null;
                const item = trackingEvent.order.lineItems?.[0];
                const candidates = item ? (listingImages[item.legacyItemId] || []) : [];
                return (
                  <CalendarMilestoneButton
                    key={`${trackingEvent.order.orderId}-${trackingEvent.type}-${dayEvents.indexOf(trackingEvent)}`}
                    trackingEvent={trackingEvent}
                    line={line}
                    candidates={candidates}
                    domId={calendarEventDomId(dateStr, trackingEvent)}
                    isPinned={selectedOrderId === line.id}
                    onHoverChange={setHoveredOrderId}
                    onSelect={() => {
                      selectDate(dateStr);
                      setSelectedOrderId(line.id);
                    }}
                  />
                );
              };
              
              return (
                <div 
                  key={dateStr}
                  role="button"
                  tabIndex={0}
                  aria-label={`${new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric" })}${eventCount ? `, ${eventCount} tracking event${eventCount === 1 ? "" : "s"}` : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedOrderId(null);
                    setExpandedEventsDateStr(null);
                    selectDate(dateStr);
                  }}
                  onKeyDown={(event) => {
                    if (event.currentTarget === event.target && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      setSelectedOrderId(null);
                      selectDate(dateStr);
                      setExpandedEventsDateStr(null);
                    }
                  }}
                  className={`group relative min-h-[90px] cursor-pointer bg-surface transition-all duration-200 hover:z-50 focus-visible:z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:min-h-[112px] ${isOverflowExpanded ? 'z-[70] bg-primary/[0.05] ring-1 ring-inset ring-primary/60' : isSelected ? 'z-20 bg-primary/[0.05] ring-1 ring-inset ring-primary/60' : 'hover:bg-primary/[0.025]'} ${cornerClasses}`}
                >
                  <div className="pointer-events-none relative z-10 p-2 sm:p-3">
                    <div className={`mb-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 sm:h-8 sm:w-8 sm:text-sm ${isToday ? 'scale-105 bg-primary text-white shadow-md' : isSelected ? 'scale-105 bg-primary/15 text-primary' : 'text-text-secondary group-hover:text-text-primary group-hover:bg-hover'}`}>
                      {date}
                    </div>
                    
                    {/* Payouts Badges */}
                    <div className="flex flex-col gap-1.5 overflow-hidden pointer-events-auto mt-1">
                      {activeTab === 'payouts' && dayPayouts && dayPayouts.total > 0 && (
                        <div className="bg-[#E9F7EF]/90 dark:bg-green-900/20 text-[#1E8449] dark:text-green-400 border border-[#27AE60]/30 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium truncate shadow-sm backdrop-blur-sm flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                          ${formatCurrency(dayPayouts.total)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Milestone markers stay compact; order lines appear only during interaction. */}
                  {activeTab === "tracking" && (
                    <>
                      <div className="pointer-events-none absolute bottom-10 left-0 right-0 top-11 flex flex-col justify-start gap-0.5 sm:bottom-[52px] sm:top-14">
                        {Array.from({ length: lineLanes.maxLanes }).map((_, laneIndex) => {
                          const line = activeLines.find(candidate => lineLanes.assignments.get(candidate.id) === laneIndex);
                          if (!line) return <div key={laneIndex} className="min-h-0 flex-1" />;

                          const isStart = dateStr === line.start;
                          const isEnd = dateStr === line.end;
                          const color = orderTimelineColor(line.order);
                          const fill: TimelineFill = dateStr <= todayStr ? "done" : "remaining";
                          const lineStyle = timelineFillStyle(fill, color);
                          const isTraced = activeTraceOrderId === line.id;

                          return (
                            <div key={laneIndex} className="relative min-h-0 flex-1">
                              <div
                                aria-hidden="true"
                                className={`absolute top-1/2 h-[5px] -translate-y-1/2 transition-opacity duration-200 motion-reduce:transition-none ${
                                  isStart ? "left-1 rounded-l-full" : "left-0"
                                } ${isEnd ? "right-1 rounded-r-full" : "right-0"}`}
                                style={{
                                  ...lineStyle,
                                  opacity: isTraced ? lineStyle.opacity : 0,
                                  transitionDuration: isTraced ? "200ms" : "0ms",
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {eventCount > 0 && (
                        <div className="absolute bottom-2 left-1 right-1 z-20 flex items-center justify-center gap-1 sm:bottom-3">
                          {isOverflowExpanded && hiddenEventCount > 0 && (
                            <div
                              id={`tracking-overflow-${dateStr}`}
                              role="group"
                              aria-label={`${hiddenEventCount} additional tracking event${hiddenEventCount === 1 ? "" : "s"}`}
                              className={`absolute bottom-7 z-[70] flex w-max max-w-[148px] flex-wrap items-center justify-center gap-1 rounded-xl border border-primary/30 bg-surface p-2 shadow-xl sm:bottom-8 ${overflowAlignment}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {hiddenDayEvents.map(renderMilestone)}
                            </div>
                          )}
                          {visibleDayEvents.map(renderMilestone)}

                          {hiddenEventCount > 0 && (
                            <button
                              type="button"
                              aria-controls={`tracking-overflow-${dateStr}`}
                              aria-expanded={isOverflowExpanded}
                              aria-label={isOverflowExpanded
                                ? `Collapse ${hiddenEventCount} additional tracking event${hiddenEventCount === 1 ? "" : "s"} on this date.`
                                : `Expand ${hiddenEventCount} more tracking event${hiddenEventCount === 1 ? "" : "s"} on this date.`}
                              className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full border border-primary bg-primary px-1 text-[8px] font-extrabold text-white shadow-sm transition-[transform,filter] duration-200 hover:scale-105 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 motion-reduce:transform-none motion-reduce:transition-none sm:h-6 sm:min-w-6 sm:text-[10px]"
                              onClick={(event) => {
                                event.stopPropagation();
                                setHoveredOrderId(null);
                                setSelectedDateStr(dateStr);
                                setExpandedEventsDateStr(previous => previous === dateStr ? null : dateStr);
                              }}
                            >
                              {isOverflowExpanded ? `−${hiddenEventCount}` : `+${hiddenEventCount}`}
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details Panel */}
        <div ref={detailsRef} className="flex w-full min-w-0 shrink-0 scroll-mt-4 flex-col xl:w-[450px]">
          <div className="relative flex h-[32rem] flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface/80 shadow-lg backdrop-blur-xl sm:h-[38rem] xl:sticky xl:top-24 xl:h-full xl:max-h-[48rem]">
            <div className="shrink-0 border-b border-border/60 bg-background/40 p-4 sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-3 xl:hidden">
                <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Selected day</span>
                <button
                  type="button"
                  onClick={() => calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>
                  Calendar
                </button>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-xl font-extrabold tracking-tight text-text-primary">
                    {selectedDateStr ? new Date(selectedDateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a date'}
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">
                    {activeTab === "tracking"
                      ? `${selectedTracking?.events.length ?? 0} tracking event${selectedTracking?.events.length === 1 ? "" : "s"}`
                      : `${selectedPayouts?.payouts.length ?? 0} payout${selectedPayouts?.payouts.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                {activeTab === 'payouts' && selectedPayouts && (
                  <div className="text-2xl font-black text-primary sm:text-3xl">
                    ${formatCurrency(selectedPayouts.total)}
                  </div>
                )}
              </div>
            </div>
            
            <div className="relative min-h-0 flex-1">
            <div
              ref={detailCardsRef}
              className="h-full min-h-0 overflow-y-auto p-4 [scrollbar-gutter:stable] sm:p-6"
              onScroll={updateDetailsFade}
            >
              <div ref={detailCardsContentRef}>
              {!selectedDateStr ? (
                <div className="text-text-muted text-center py-8">Click a day on the calendar to view details.</div>
              ) : activeTab === 'payouts' ? (
                !selectedPayouts ? (
                  <div className="text-text-muted text-center py-8">No payouts on this date.</div>
                ) : (
                  <div className="space-y-4">
                    {selectedPayouts.payouts.map((p, idx) => (
                      <div key={p.payoutId || idx} className="bg-surface border border-border/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider border border-primary/20">{p.user}</span>
                          <span className="font-extrabold text-lg text-text-primary">${formatCurrency(Number(p.amount.value) || 0)}</span>
                        </div>
                        <div className="text-text-secondary flex justify-between items-center text-xs font-medium">
                          <span className="bg-background px-2 py-1 rounded border border-border/40">{p.payoutStatusDescription || p.payoutStatus || "Payout"}</span>
                          {p.transactionCount ? <span className="text-text-muted">{p.transactionCount} txns</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : activeTab === 'tracking' ? (
                !selectedTracking ? (
                  <div className="text-text-muted text-center py-8">No tracking events on this date.</div>
                ) : (
                  <div className="space-y-4">
                    {selectedTracking.events.map((e, idx) => {
                       const items = e.order.lineItems && e.order.lineItems.length > 0
                          ? e.order.lineItems
                          : [{ lineItemId: "empty", legacyItemId: "", title: `Order #${e.order.legacyOrderId}`, sku: "", quantity: 0 }];
                       const color = orderTimelineColor(e.order);
                       const line = orderLineByOrderId.get(e.order.orderId);
                       
                       return (
                         <article
                           key={idx}
                           className="space-y-4 rounded-2xl border-2 bg-surface p-4 shadow-sm transition-shadow duration-300 hover:shadow-md"
                           style={{ borderColor: color }}
                           onMouseEnter={() => line && setHoveredOrderId(line.id)}
                           onMouseLeave={() => setHoveredOrderId(null)}
                         >
                           <div className="flex flex-wrap items-start justify-between gap-2">
                             <div className="min-w-0">
                               <span className="inline-flex rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">{e.user}</span>
                               <p className="mt-1.5 truncate text-xs font-medium text-text-muted">Order {e.order.legacyOrderId}</p>
                             </div>
                             <div className="flex flex-wrap items-center justify-end gap-1.5">
                               <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${e.type === 'Shipped' ? 'bg-[#EBF5FB]/80 dark:bg-blue-900/20 text-[#2874A6] dark:text-blue-400' : e.type === 'Expected Delivery' ? 'bg-[#F4ECF7]/80 dark:bg-purple-900/20 text-[#76448A] dark:text-purple-400' : 'bg-[#FDF2E9]/80 dark:bg-orange-900/20 text-[#BA4A00] dark:text-orange-400'}`}>
                                 {e.type}
                               </span>
                               <button
                                 type="button"
                                 aria-label={`Show ${e.type.toLowerCase()} for order ${e.order.legacyOrderId} on the calendar`}
                                 aria-pressed={Boolean(line && selectedOrderId === line.id)}
                                 disabled={!line || !selectedDateStr}
                                 className="rounded-full border px-2.5 py-1 text-[10px] font-bold transition-[transform,background-color] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transform-none motion-reduce:transition-none"
                                 style={{ color, borderColor: color, backgroundColor: `${color}12` }}
                                 onFocus={() => line && setHoveredOrderId(line.id)}
                                 onBlur={() => setHoveredOrderId(null)}
                                 onClick={() => {
                                   if (line && selectedDateStr) showEventOnCalendar(selectedDateStr, e, line.id);
                                 }}
                               >
                                 Show line &amp; icon
                               </button>
                             </div>
                           </div>
                           {e.disclaimer && (
                             <div role="note" className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-medium leading-relaxed text-text-primary">
                               <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                 <path d="M12 9v4m0 4h.01M10.3 3.7 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
                               </svg>
                               <span>{e.disclaimer}</span>
                             </div>
                           )}
                           
                           {/* Render Items identically to Tracking cards */}
                           {items.map(item => {
                             const itemUrl = item.legacyItemId ? `https://www.ebay.com/itm/${item.legacyItemId}` : "#";
                             const isUsps = (c?: string) => c && (c.toUpperCase() === "USPS" || c.toUpperCase().startsWith("USPS"));
                             
                             return (
                               <div key={item.lineItemId} className="flex gap-3 border-t border-border/40 pt-3 first:border-0 first:pt-0">
                                 <a
                                   href={itemUrl}
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-background sm:h-20 sm:w-20"
                                 >
                                   {cardImage(item) || (
                                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted/60" aria-hidden="true">
                                       <rect x="3" y="3" width="18" height="18" rx="3" />
                                       <circle cx="8.5" cy="8.5" r="1.5" />
                                       <path d="m21 15-5-5L5 21" />
                                     </svg>
                                   )}
                                 </a>
                                 <div className="min-w-0 flex-1">
                                   <a
                                     href={itemUrl}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="block text-sm font-semibold leading-snug text-text-primary hover:text-primary hover:underline"
                                   >
                                     <span className="line-clamp-2">{item.title}</span>
                                   </a>
                                   <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                                     {item.total && (
                                       <span className="rounded-full bg-primary/10 px-2 py-1 font-bold text-primary">
                                         {formatMoney(item.total)}
                                       </span>
                                     )}
                                     {item.quantity > 0 && <span className="rounded-full bg-background px-2 py-1">Qty {item.quantity}</span>}
                                   </div>
                                 </div>
                               </div>
                             );
                           })}
                           
                           {/* Details mapping similar to Tracking Card bottom row */}
                           {(Boolean(e.details) || (e.order.shippingFulfillments?.length ?? 0) > 0) && (
                             <div className="space-y-2 border-t border-border/40 pt-3 text-xs">
                               {e.order.shippingFulfillments?.map((f, fIdx) => {
                                  const number = f.shipmentTrackingNumber?.trim();
                                  const isUspsCarrier = f.shippingCarrierCode && (f.shippingCarrierCode.toUpperCase() === "USPS" || f.shippingCarrierCode.toUpperCase().startsWith("USPS"));
                                  const trackingHref = number && isUspsCarrier
                                    ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(number)}`
                                    : null;
                                  
                                  return (
                                    <div key={fIdx} className="rounded-xl bg-background/70 p-3">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="font-semibold text-text-primary">{f.shippingCarrierCode || "Carrier"}</span>
                                        {trackingHref && (
                                          <a href={trackingHref} target="_blank" rel="noopener noreferrer" className="rounded-full bg-primary px-3 py-1.5 font-semibold text-white transition-opacity hover:opacity-90">
                                            Track package
                                          </a>
                                        )}
                                      </div>
                                      {number && <p className="mt-2 break-all font-mono text-[11px] text-text-secondary">{number}</p>}
                                    </div>
                                  );
                               })}
                             </div>
                           )}
                           
                         </article>
                       );
                    })}
                  </div>
                )
              ) : null}
              </div>
            </div>
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 rounded-b-2xl bg-gradient-to-b from-transparent via-surface/95 to-surface transition-opacity duration-200 ${
                showDetailsFade ? "opacity-100" : "opacity-0"
              }`}
            />
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
