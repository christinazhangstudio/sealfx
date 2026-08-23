"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import ApiUsageIndicator from "@/components/ApiUsageIndicator";
import { useSession, signOut } from "next-auth/react";
import { clearListingsSession } from "@/lib/useEbayListings";
import { usePathname } from "next/navigation";
import { useNotifications } from "@/components/NotificationContext";

type NavigationItemVariant = "desktop" | "mobile" | "dropdown";

function navigationItemClass(variant: NavigationItemVariant, active: boolean): string {
  if (variant === "desktop") {
    return `relative inline-flex items-center whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold tracking-wide transition-all duration-200 motion-reduce:transform-none motion-reduce:transition-none ${
      active
        ? "border-primary/35 bg-surface text-primary shadow-[0_4px_14px_rgba(0,0,0,0.08)] ring-1 ring-inset ring-primary/10"
        : "border-transparent text-primary/80 hover:-translate-y-0.5 hover:border-border/70 hover:bg-surface/70 hover:text-hover-content hover:shadow-sm"
    }`;
  }

  if (variant === "mobile") {
    return `relative flex w-full items-center justify-center rounded-full border px-4 py-2 text-base font-semibold tracking-wide transition-all duration-200 ${
      active
        ? "border-primary/35 bg-primary/10 text-primary shadow-sm ring-1 ring-inset ring-primary/10"
        : "border-transparent text-primary/85 hover:border-border/70 hover:bg-hover/70 hover:text-hover-content"
    }`;
  }

  return `flex items-center rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-150 ${
    active
      ? "border-primary/25 bg-primary/10 text-primary shadow-sm"
      : "border-transparent text-primary/85 hover:border-border/60 hover:bg-hover hover:text-hover-content"
  }`;
}

export default function NavMenu({ isMobile }: { isMobile?: boolean }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreDropdownRef = useRef<HTMLDivElement>(null);
  const { unreadCount } = useNotifications();

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Reset mobile states when switching out of mobile view, and reset the
  // sub-menus when the main mobile menu closes. Adjust-during-render instead
  // of effects — same semantics without cascading extra commits.
  const [prevIsMobile, setPrevIsMobile] = useState(isMobile);
  if (prevIsMobile !== isMobile) {
    setPrevIsMobile(isMobile);
    if (!isMobile) {
      setIsMobileMenuOpen(false);
      setIsMobileMoreOpen(false);
    }
  }

  const [prevMenuOpen, setPrevMenuOpen] = useState(isMobileMenuOpen);
  if (prevMenuOpen !== isMobileMenuOpen) {
    setPrevMenuOpen(isMobileMenuOpen);
    if (!isMobileMenuOpen) {
      setIsMobileMoreOpen(false);
    }
  }

  if (pathname === "/login") return null;

  const navLinks = [
    { name: "Inbox", href: "/inbox" },
    { name: "Create Listing", href: "/create-listing" },
    { name: "Inventory", href: "/inventory" },
    { name: "Tracking", href: "/tracking" },
    { name: "Calendar", href: "/calendar" },
  ];

  const moreLinks = [
    { name: "Charts", href: "/charts" },
    { name: "Accounts", href: "/accounts" },
    { name: "Notifications", href: "/notifications" },
    { name: "Settings", href: "/settings" },
    { name: "Admin", href: "/admin" },
  ];

  const isActive = (path: string) => pathname === path;
  const isMoreActive = moreLinks.some((link) => isActive(link.href));


  return (
    <nav className="font-nav sticky top-0 z-40 border-b border-border/50 bg-surface/85 shadow-[0_8px_30px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-colors duration-200 @container">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex h-16 justify-between">
          {/* Left Side: Home + Desktop Links */}
          <div className="flex items-center">
            <div className="absolute left-1/2 flex flex-shrink-0 -translate-x-1/2 items-center @5xl:static @5xl:translate-x-0">
              <Link
                href="/"
                aria-current={isActive("/") ? "page" : undefined}
                className={`${navigationItemClass("desktop", isActive("/"))} text-base font-bold`}
              >
                Home
              </Link>
            </div>
            {/* Desktop Navigation */}
            <div className="hidden flex-wrap @5xl:ml-5 @5xl:flex @5xl:items-center @5xl:gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={navigationItemClass("desktop", isActive(link.href))}
                >
                  {link.name}
                  {link.name === "Inbox" && unreadCount > 0 && (
                    <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-blue-500 rounded-full">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              ))}


              {/* More Dropdown */}
              <div className="relative" ref={moreDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  aria-expanded={isMoreOpen}
                  className={navigationItemClass("desktop", isMoreActive)}
                >
                  More
                  <svg className={`ml-1 h-4 w-4 transition-transform duration-200 ${isMoreOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isMoreOpen && (
                  <div className="absolute right-0 z-[var(--z-nav)] mt-2 w-52 space-y-1 rounded-2xl border border-border/60 bg-surface/95 p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
                    {moreLinks.map((link) => (
                      <Link
                        key={link.name}
                        href={link.href}
                        aria-current={isActive(link.href) ? "page" : undefined}
                        className={navigationItemClass("dropdown", isActive(link.href))}
                        onClick={() => setIsMoreOpen(false)}
                      >
                        {link.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: Desktop Actions */}
          <div className="ml-4 hidden flex-shrink-0 @5xl:flex @5xl:items-center @5xl:gap-3">
            <ApiUsageIndicator />
            <ThemeSwitcher />
            {session && !(session.user as any)?.isGuest && (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to logout?')) {
                    clearListingsSession();
                    signOut({ callbackUrl: "/login" });
                  }
                }}
                title="Logout"
                className="rounded-full border border-primary/15 bg-primary/10 p-2 text-primary shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/60 hover:text-white hover:shadow-md motion-reduce:transform-none"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}
            {(session?.user as any)?.isGuest && (
              <Link
                href="/login"
                className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover font-semibold transition-colors duration-200 text-sm"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="-mr-2 flex items-center @5xl:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-primary hover:text-hover-content hover:bg-hover focus:outline-none transition-colors"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen && (
        <div className="border-t border-border/60 bg-surface/95 shadow-xl backdrop-blur-xl animate-in slide-in-from-top-1 duration-200 @5xl:hidden">
          <div className="space-y-1 p-2">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={navigationItemClass("mobile", isActive(link.href))}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
                {link.name === "Inbox" && unreadCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold leading-none text-white bg-blue-500 rounded-full">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            ))}


            {/* Collapsible More Links */}
            <div>
              <button
                type="button"
                onClick={() => setIsMobileMoreOpen(!isMobileMoreOpen)}
                aria-expanded={isMobileMoreOpen}
                className={navigationItemClass("mobile", isMoreActive)}
              >
                <span>More</span>
                <svg
                  className={`absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-transform duration-200 ${isMobileMoreOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isMobileMoreOpen && (
                <div className="mt-1 space-y-1 rounded-2xl border border-border/50 bg-background/40 p-1.5 animate-in slide-in-from-top-1 duration-200">
                  {moreLinks.map((link) => (
                    <Link
                      key={link.name}
                      href={link.href}
                      aria-current={isActive(link.href) ? "page" : undefined}
                      className={navigationItemClass("dropdown", isActive(link.href))}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border/60 py-4">
            <div className="flex items-center justify-center gap-5 px-5">
              <div className="flex items-center">
                <ApiUsageIndicator />
              </div>
              <ThemeSwitcher />
              {session && !(session.user as any)?.isGuest && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    if (confirm('Are you sure you want to logout?')) {
                      clearListingsSession();
                      signOut({ callbackUrl: "/login" });
                    }
                  }}
                  className="p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors"
                  title="Logout"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              )}
              {(session?.user as any)?.isGuest && (
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover font-semibold transition-colors duration-200 text-sm"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
