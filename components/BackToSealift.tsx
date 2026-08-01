"use client";

import { useRouter } from "next/navigation";
import { isFooterPath, readReturnPath } from "@/lib/footer-links";

function safeInternalPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || isFooterPath(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export default function BackToSealift() {
  const router = useRouter();

  const handleBack = () => {
    const remembered = safeInternalPath(readReturnPath());
    if (remembered) {
      router.push(remembered);
      return;
    }

    try {
      const referrer = new URL(document.referrer);
      const referrerPath = referrer.origin === window.location.origin
        ? safeInternalPath(`${referrer.pathname}${referrer.search}${referrer.hash}`)
        : null;
      if (referrerPath) {
        router.push(referrerPath);
        return;
      }
    } catch {
      // A direct visit has no usable referrer.
    }

    router.push("/");
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
    >
      ← Back to Sealift
    </button>
  );
}
