"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { setGuestMode } from "@/lib/api-tracker";

/**
 * Component that synchronizes the authentication session's guest status
 * with the global API tracker to prevent accidental network calls.
 */
export default function GuestSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    // Treat unauthenticated users as "guest" for the purpose of network blocking
    const isGuest = status === "unauthenticated" || !!(session?.user && (session.user as any).isGuest);
    setGuestMode(isGuest);
  }, [session, status]);

  return null;
}
