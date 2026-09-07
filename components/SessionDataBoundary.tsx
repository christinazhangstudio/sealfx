"use client";

import { useEffect, useMemo, useState } from "react";
import { SWRConfig } from "swr";
import { clearListingsSession } from "@/lib/useEbayListings";

/** Reset private state before another account can render it in this tab. */
export default function SessionDataBoundary({ identity, allowAnonymousWhileLoading = false, children }: {
    identity: string | null;
    allowAnonymousWhileLoading?: boolean;
    children: React.ReactNode;
}) {
    // Public pages can start with empty anonymous providers during SSR and a
    // slow initial session lookup. Resolving to anonymous preserves form input.
    // A previously mounted member still has to clear its data before switching.
    const initialAnonymous = identity === null && allowAnonymousWhileLoading;
    const targetIdentity = initialAnonymous ? "anonymous" : identity;
    const [readyIdentity, setReadyIdentity] = useState<string | null>(() => initialAnonymous ? "anonymous" : null);
    const swrConfig = useMemo(() => ({ provider: () => new Map() }), []);

    useEffect(() => {
        if (targetIdentity === readyIdentity) return;
        // Children have already unmounted, closing their SSE streams and
        // disconnecting any old async state setters. Clear module data before
        // mounting the next account's providers and page state.
        let cancelled = false;
        void clearListingsSession().then(() => {
            if (!cancelled) setReadyIdentity(targetIdentity);
        });
        return () => { cancelled = true; };
    }, [targetIdentity, readyIdentity]);

    if (targetIdentity === null || targetIdentity !== readyIdentity) return null;

    // A new SWR provider prevents both old cached values and old in-flight
    // fetches from publishing into the next account's cache.
    return <SWRConfig key={readyIdentity} value={swrConfig}>{children}</SWRConfig>;
}
