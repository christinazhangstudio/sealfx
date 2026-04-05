"use client";

import { useEffect, useState } from "react";
import { trackedFetch as fetch } from "@/lib/api-tracker";

export default function DebugPage() {
  const [destinations, setDestinations] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
  const destinationsUri = process.env.NEXT_PUBLIC_NOTIFICATIONS_DESTINATIONS_URI;
  const usersUri = process.env.NEXT_PUBLIC_USERS_URI;
  const usersBaseUri = process.env.NEXT_PUBLIC_NOTIFICATIONS_USERS_BASE_URI;
  const subscriptionsUri = process.env.NEXT_PUBLIC_NOTIFICATIONS_SUBSCRIPTIONS_URI;

  useEffect(() => {
    if (!apiBaseUrl || !usersUri || !usersBaseUri || !subscriptionsUri) {
      setError("Missing environment variables.");
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      try {
        // Fetch destinations
        const destRes = await fetch(`${apiBaseUrl}/${destinationsUri}`);
        if (destRes.ok) {
          const destData = await destRes.json();
          setDestinations(destData);
        } else {
          setDestinations({ error: `Failed to fetch destinations: ${destRes.status}` });
        }

        // Fetch users
        const usersRes = await fetch(`${apiBaseUrl}/${usersUri}`);
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const users = usersData.users || [];

          // Fetch subscriptions for each user
          const subsMap: Record<string, any> = {};
          for (const user of users) {
            const subRes = await fetch(`${apiBaseUrl}/${usersBaseUri}/${user}/${subscriptionsUri}`);
            if (subRes.ok) {
              subsMap[user] = await subRes.json();
            } else {
              subsMap[user] = { error: `Failed to fetch: ${subRes.status}` };
            }
          }
          setSubscriptions(subsMap);
        } else {
          setSubscriptions({ error: `Failed to fetch users: ${usersRes.status}` });
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || "An unknown error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [apiBaseUrl, usersUri, usersBaseUri, subscriptionsUri]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <p className="text-xl text-primary animate-pulse">Fetching raw debug data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8 relative">
      <div className="max-w-7xl mx-auto space-y-8">

        <div className="pb-6 border-b border-border">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl text-primary font-heading mb-2">
            Raw Endpoint Data
          </h1>
          <p className="text-text-secondary text-sm sm:text-base">
            Admin debug view for raw JSON responses from background endpoints.
          </p>
        </div>

        {error && (
          <div className="bg-error-bg border-l-4 border-error-border text-error-text px-6 py-4 rounded-xl shadow-md">
            <p className="font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Destinations Section */}
          <section className="bg-surface p-6 rounded-2xl border border-border shadow-lg flex flex-col h-[75vh]">
            <h2 className="text-2xl text-primary mb-4 font-bold tracking-wide border-b border-border/50 pb-2">
              Destinations (Tenant Level)
            </h2>
            <div className="flex-1 overflow-auto rounded-lg border border-border/50 bg-background/50 p-4 custom-scrollbar">
              <pre className="text-sm text-text-secondary font-mono whitespace-pre-wrap word-break">
                {JSON.stringify(destinations, null, 2)}
              </pre>
            </div>
          </section>

          {/* Subscriptions Section */}
          <section className="bg-surface p-6 rounded-2xl border border-border shadow-lg flex flex-col h-[75vh]">
            <h2 className="text-2xl text-primary mb-4 font-bold tracking-wide border-b border-border/50 pb-2">
              Subscriptions (User Level)
            </h2>
            <div className="flex-1 overflow-auto rounded-lg border border-border/50 bg-background/50 p-4 custom-scrollbar space-y-6">
              {Object.keys(subscriptions).length > 0 ? (
                Object.entries(subscriptions).map(([user, data], idx) => (
                  <div key={user} className={idx > 0 ? "pt-6 border-t border-border/50" : ""}>
                    <h3 className="text-lg text-secondary font-bold mb-2 break-all">User: {user}</h3>
                    <pre className="text-sm text-text-secondary font-mono whitespace-pre-wrap word-break">
                      {JSON.stringify(data, null, 2)}
                    </pre>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 italic">No subscriptions found.</p>
              )}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}
