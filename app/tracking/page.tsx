"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";

interface Order {
  orderId: string;
  creationDate: string;
  orderPaymentStatus: string; // e.g., PAID, PENDING
  orderFulfillmentStatus: string; // e.g., FULFILLED, IN_PROGRESS, NOT_STARTED
  pricingSummary?: {
    total?: {
      value: string;
      currency: string;
    };
  };
}

export default function TrackingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchOrders() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
        let ordersArray: Order[] = [];
        const res = await fetch(`${apiUrl}/tracking`, {
          // Pass credentials so the backend gets the session cookie
          credentials: "include"
        });
        if (!res.ok) throw new Error("Failed to fetch tracking data");
        const data = await res.json();
        if (Array.isArray(data)) {
          ordersArray = data.flatMap(d => d.orders || []);
        } else if (data && typeof data === "object") {
          ordersArray = data.orders || data.items || data.data || [];
        }
        setOrders(ordersArray);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrders();
  }, []);

  const getProgressState = (order: Order) => {
    const isPaid = order.orderPaymentStatus === "PAID";
    const isShipped = order.orderFulfillmentStatus === "FULFILLED";
    const isProcessing = order.orderFulfillmentStatus === "IN_PROGRESS";
    
    // Steps: 0: Pending, 1: Paid, 2: Processing, 3: Shipped, 4: Delivered
    // We will simplify to the 4 steps requested: Paid, Processing, Shipped, Delivered
    // If not paid, it's 0 (before the first bar).
    
    // If fulfilled, it's shipped (or delivered). Without carrier tracking info,
    // we'll just set it to Shipped (step 3).
    if (isShipped) return 3; 
    if (isProcessing) return 2;
    if (isPaid) return 1;
    return 0; // Not paid yet
  };

  const steps = ["Paid", "Processing", "Shipped", "Delivered"];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <PageHeader title="Tracking" />
      
      {loading ? (
        <div className="text-center py-10 text-secondary">Loading orders...</div>
      ) : error ? (
        <div className="text-red-500 text-center py-10">{error}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-10 text-secondary">No tracking data found.</div>
      ) : (
        <div className="space-y-6 mt-6">
          {orders.map((order) => {
            // progress is 1-based for the steps (Paid is 1)
            // 0 means no steps completed.
            const currentStep = getProgressState(order);
            // Calculate width percentage based on steps. 
            // 0 steps -> 0%
            // 1 step (Paid) -> 25% (or 0% for the first node if we do node-based)
            // Let's do a step-based width where max is 100%.
            // With 4 steps, step 1 is 0%, step 2 is 33%, step 3 is 66%, step 4 is 100%.
            // Wait, "Paid -> Processing -> Shipped -> Delivered".
            // If it's step 1 (Paid), we want the "Paid" text highlighted, and the bar at least at the first dot.
            
            // Let's make it look like a stepper.
            
            return (
              <div key={order.orderId} className="bg-card border border-border rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-primary">Order #{order.orderId}</h3>
                    <p className="text-sm text-secondary">
                      Placed on: {order.creationDate ? new Date(order.creationDate).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  {order.pricingSummary?.total && (
                    <div className="text-lg font-medium text-primary">
                      {order.pricingSummary.total.currency} {order.pricingSummary.total.value}
                    </div>
                  )}
                </div>

                {/* Stepper Progress Bar */}
                <div className="relative pt-6 pb-2">
                  <div className="absolute top-1/2 left-0 w-full h-1 bg-border -translate-y-1/2 rounded" />
                  <div 
                    className="absolute top-1/2 left-0 h-1 bg-blue-500 -translate-y-1/2 rounded transition-all duration-500"
                    style={{ width: `${Math.max(0, (currentStep - 1) / (steps.length - 1)) * 100}%` }}
                  />
                  
                  <div className="relative flex justify-between">
                    {steps.map((step, idx) => {
                      const stepNumber = idx + 1; // 1-based
                      const isCompleted = currentStep >= stepNumber;
                      const isCurrent = currentStep === stepNumber;
                      
                      return (
                        <div key={step} className="flex flex-col items-center">
                          <div 
                            className={`w-4 h-4 rounded-full border-2 mb-2 z-10 bg-card ${
                              isCompleted ? 'border-blue-500 bg-blue-500' : 'border-border'
                            }`}
                          />
                          <span className={`text-xs font-medium ${isCompleted || isCurrent ? 'text-primary' : 'text-secondary'}`}>
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
