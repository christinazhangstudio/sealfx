"use client";

import { useEffect, useMemo, useState } from "react";
import { SWRConfig } from "swr";
import { clearListingsSession } from "@/lib/useEbayListings";

/** Reset private state before another account can render it in this tab. */
export default function SessionDataBoundary({ identity, children }: {
    identity: string | null;
    children: React.ReactNode;
}) {
    const [readyIdentity, setReadyIdentity] = useState<string | null>(null);
    const swrConfig = useMemo(() => ({ provider: () => new Map() }), []);

    useEffect(() => {
        if (identity === readyIdentity) return;
        // Children have already unmounted, closing their SSE streams and
        // disconnecting any old async state setters. Clear module data before
        // mounting the next account's providers and page state.
        let cancelled = false;
        void clearListingsSession().then(() => {
            if (!cancelled) setReadyIdentity(identity);
        });
        return () => { cancelled = true; };
    }, [identity, readyIdentity]);

    if (identity === null || identity !== readyIdentity) return null;

    // A new SWR provider prevents both old cached values and old in-flight
    // fetches from publishing into the next account's cache.
    return <SWRConfig key={readyIdentity} value={swrConfig}>{children}</SWRConfig>;
}
