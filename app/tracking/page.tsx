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

type BoardCard = {
  key: string;
  user: string;
  order: Order;
  item: LineItem;
  step: number;
};


export default function TrackingPage() {
  const [userGroups, setUserGroups] = useState<UserOrders[]>([]);
  const [usingSandboxOrders, setUsingSandboxOrders] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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

  const getProgressState = (order: Order) => {
    const isPaid =
      order.orderPaymentStatus === "PAID" ||
      order.orderPaymentStatus === "FULLY_REFUNDED";
    const isShipped = order.orderFulfillmentStatus === "FULFILLED";
    const isProcessing = order.orderFulfillmentStatus === "IN_PROGRESS";

    if (isShipped) return 3;
    if (isProcessing) return 2;
    if (isPaid) return 1;
    return 0;
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            Paid
          </span>
        );
      case "FULLY_REFUNDED":
        return (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            Refunded
          </span>
        );
      default:
        return (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {status.replace(/_/g, " ")}
          </span>
        );
    }
  };

  const steps = ["Not started", "Paid", "Processing", "Shipped"] as const;

  const boardCards = useMemo(() => {
    const cards: BoardCard[] = [];
    for (const group of userGroups) {
      for (const order of group.orders) {
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
  }, [userGroups]);

  const cardsByStep = useMemo(() => {
    return steps.map((_, idx) => boardCards.filter((c) => c.step === idx));
  }, [boardCards]);


  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <PageHeader title="Tracking" />
      <p className="text-sm text-text-secondary mb-6">
        Showing orders from the last 90 days. eBay&apos;s Get Orders API
        defaults to that window unless a wider date filter is requested.
      </p>


      {Object.keys(errorsByUser).length > 0 && (
        <div className="mb-4 space-y-2">
          {Object.entries(errorsByUser).map(([user, message]) => (
            <p key={user} className="text-red-500 font-medium">
              {user}: Request failed: {message}
            </p>
          ))}
        </div>
      )}

      {loading ? (
        <div className="seller-card">
          <p className="text-primary text-lg">Loading Orders...</p>
        </div>
      ) : error ? (
        <div className="text-error-text text-center py-10">{error}</div>
      ) : userGroups.length === 0 ? (
        <div className="seller-card">
          <p className="text-text-secondary text-lg">No tracking data found.</p>
        </div>
      ) : (
        <div className="seller-card overflow-hidden">
          <div className="relative mb-8 px-2">
            <div className="absolute top-2 left-[12.5%] right-[12.5%] h-0.5 bg-border" />
            <div className="relative grid grid-cols-4">
              {steps.map((step, idx) => (
                <div key={step} className="flex flex-col items-center text-center">
                  <div className="w-4 h-4 rounded-full border-2 border-primary bg-surface z-10 mb-2" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                    {step}
                  </h3>
                  <span className="text-xs text-text-secondary mt-0.5">
                    {cardsByStep[idx].length}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-6">
            {steps.map((step, idx) => (
              <div key={step} className="min-w-0 space-y-2">
                {cardsByStep[idx].length === 0 ? (
                  <p className="text-xs text-text-secondary text-center py-6">
                    None
                  </p>
                ) : (
                  cardsByStep[idx].map(({ key, user, order, item }) => {
                    const itemUrl = item.legacyItemId
                      ? `https://www.ebay.com/itm/${item.legacyItemId}`
                      : "#";
                    const imgCandidates = listingImages[item.legacyItemId] || [];
                    const placed = order.creationDate
                      ? new Date(order.creationDate).toLocaleDateString()
                      : "N/A";

                    return (
                      <a
                        key={key}
                        href={itemUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`group relative block rounded-lg border border-border/40 border-l-4 p-2.5 bg-surface hover:border-border transition-colors ${USER_TONES[(uniqueUsersArray.indexOf(user) >= 0 ? uniqueUsersArray.indexOf(user) : 0) % USER_TONES.length]}`}
                      >
                        <div className="flex gap-2.5">
                          <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden bg-surface border border-border/30 flex items-center justify-center">
                            {imgCandidates[0] ? (
                              <img
                                src={imgCandidates[0]}
                                alt=""
                                data-i="0"
                                referrerPolicy="no-referrer"
                                className="max-w-full max-h-full object-contain"
                                onError={(e) => {
                                  const img = e.currentTarget;
                                  const next = Number(img.dataset.i || "0") + 1;
                                  if (next < imgCandidates.length) {
                                    img.dataset.i = String(next);
                                    img.src = imgCandidates[next];
                                    return;
                                  }
                                  img.style.display = "none";
                                }}
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary truncate">
                              {user}
                            </p>
                            <p className="text-sm font-medium text-primary line-clamp-2 leading-snug">
                              {item.title}
                            </p>
                            {item.total && (
                              <p className="text-sm font-semibold text-primary mt-0.5">
                                {item.total.currency} {item.total.value}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="pointer-events-none absolute left-0 right-0 top-full z-20 hidden group-hover:block pt-1">
                          <div className="rounded-lg border border-border bg-surface shadow-lg p-3 space-y-1.5 text-xs text-text-secondary">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>Order #{order.orderId}</span>
                              {getPaymentBadge(order.orderPaymentStatus)}
                            </div>
                            {order.salesRecordReference && (
                              <p>Sales record: {order.salesRecordReference}</p>
                            )}
                            {order.buyer?.username && (
                              <p>Buyer: {order.buyer.username}</p>
                            )}
                            <p>Placed: {placed}</p>
                            {order.pricingSummary?.total?.value && (
                              <p>
                                Order total: {order.pricingSummary.total.currency}{" "}
                                {order.pricingSummary.total.value}
                              </p>
                            )}
                            {order.pricingSummary?.deliveryCost?.value && (
                              <p>
                                Shipping: {order.pricingSummary.deliveryCost.currency}{" "}
                                {order.pricingSummary.deliveryCost.value}
                              </p>
                            )}
                            {item.quantity > 0 && <p>Qty: {item.quantity}</p>}
                            {item.sku && (
                              <p>
                                SKU:{" "}
                                <span className="font-mono text-text-primary">
                                  {item.sku}
                                </span>
                              </p>
                            )}
                            {item.legacyItemId && (
                              <p>Item ID: {item.legacyItemId}</p>
                            )}
                            {item.lineItemFulfillmentStatus && (
                              <p>Line item: {item.lineItemFulfillmentStatus.replace(/_/g, " ")}</p>
                            )}
                            {order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo && (
                              <p>
                                Ship to:{" "}
                                {[
                                  order.fulfillmentStartInstructions[0].shippingStep.shipTo.city,
                                  order.fulfillmentStartInstructions[0].shippingStep.shipTo.stateOrProvince,
                                  order.fulfillmentStartInstructions[0].shippingStep.shipTo.postalCode,
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                            )}
                            {order.fulfillmentStartInstructions?.[0]?.minEstimatedDeliveryDate && (
                              <p>
                                Est. delivery:{" "}
                                {new Date(
                                  order.fulfillmentStartInstructions[0].minEstimatedDeliveryDate
                                ).toLocaleDateString()}
                                {order.fulfillmentStartInstructions[0].maxEstimatedDeliveryDate
                                  ? `–${new Date(
                                      order.fulfillmentStartInstructions[0].maxEstimatedDeliveryDate
                                    ).toLocaleDateString()}`
                                  : ""}
                              </p>
                            )}
                            {(order.shippingFulfillments ?? []).map((f) => (
                              <div key={f.fulfillmentId || f.shipmentTrackingNumber} className="pt-1 space-y-0.5">
                                {f.shippingCarrierCode && (
                                  <p>Carrier: {f.shippingCarrierCode}</p>
                                )}
                                {f.shipmentTrackingNumber && (
                                  <p>
                                    Tracking:{" "}
                                    <span className="font-mono text-text-primary">
                                      {f.shipmentTrackingNumber}
                                    </span>
                                  </p>
                                )}
                                {f.shippedDate && (
                                  <p>
                                    Shipped:{" "}
                                    {new Date(f.shippedDate).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            ))}
                            <p className="text-primary font-medium">Open on eBay →</p>
                          </div>
                        </div>
                      </a>
                    );
                  })
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
