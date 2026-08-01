export const footerLinks = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "About", href: "/about" },
] as const;

export const FOOTER_RETURN_PATH_KEY = "sealift_footer_return_path";

function getStorage(storage: "sessionStorage" | "localStorage") {
  if (typeof window === "undefined") return null;

  try {
    return window[storage];
  } catch {
    return null;
  }
}

function normalizeInternalPath(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function isFooterPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return footerLinks.some(({ href }) =>
    pathname === href || pathname.startsWith(`${href}/`),
  );
}

export function rememberReturnPath(path: string | null | undefined): string | null {
  const normalized = normalizeInternalPath(path);
  if (!normalized) return null;

  for (const storage of [getStorage("sessionStorage"), getStorage("localStorage")]) {
    if (!storage) continue;

    try {
      storage.setItem(FOOTER_RETURN_PATH_KEY, normalized);
    } catch {
      // Ignore storage errors and fall back gracefully.
    }
  }

  return normalized;
}

export function readReturnPath(): string | null {
  for (const storage of [getStorage("sessionStorage"), getStorage("localStorage")]) {
    if (!storage) continue;

    try {
      const stored = storage.getItem(FOOTER_RETURN_PATH_KEY);
      const normalized = normalizeInternalPath(stored);
      if (normalized) return normalized;
    } catch {
      // Ignore storage errors and continue.
    }
  }

  return null;
}
