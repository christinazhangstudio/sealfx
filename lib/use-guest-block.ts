"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

/**
 * Hook to prevent API calls and data fetching for guest users
 * Returns early if user is logged in as a guest
 * Typical usage:
 *   const { isGuest } = useGuestBlock();
 *
 *   useEffect(() => {
 *     if (isGuest) return;
 *     // Make API calls here
 *   }, [isGuest]);
 */
export function useGuestBlock() {
  const { data: session } = useSession();
  const [isGuest, setIsGuest] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const guest = !!(session?.user && (session.user as any).isGuest);
    setIsGuest(guest);
    setIsReady(true);
  }, [session]);

  return { isGuest, isReady };
}
