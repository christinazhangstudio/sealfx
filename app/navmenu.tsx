"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import ApiUsageIndicator from "@/components/ApiUsageIndicator";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function NavMenu() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Reset mobile "More" when main mobile menu closes
  useEffect(() => {
    if (!isMobileMenuOpen) {
      setIsMobileMoreOpen(false);
    }
  }, [isMobileMenuOpen]);

  if (pathname === "/login") return null;

  const navLinks = [
    { name: "Notes", href: "/notes" },
    { name: "Payouts", href: "/payouts" },
    { name: "Listings (Detail)", href: "/listings" },
    { name: "Listings (Gallery)", href: "/gallery" },
    { name: "Charts", href: "/charts" },
  ];

  const moreLinks = [
    { name: "Changelog", href: "/changelog" },
    { name: "Accounts", href: "/accounts" },
    { name: "Transactions", href: "/transaction" },
    { name: "Notifications", href: "/notifications" },
  ];

  const isActive = (path: string) => pathname === path;

  return (
    <nav
      className="shadow-md sticky top-0 z-40 transition-all duration-200"
      style={{ background: "var(--nav-bg)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 relative">
          {/* Left Side: Home + Desktop Links */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0">
              <Link href="/" className="text-xl font-bold text-primary hover:text-primary-hover transition-colors">
                Home
              </Link>
            </div>
            {/* Desktop Navigation */}
            <div className="hidden lg:ml-6 lg:flex lg:space-x-2 xl:space-x-4 lg:items-center">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 whitespace-nowrap ${isActive(link.href) ? "text-primary-hover font-bold bg-primary/5" : "text-primary hover:text-primary-hover hover:bg-primary/5"
                    }`}
                >
                  {link.name}
                </Link>
              ))}

              {/* More Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  className="px-3 py-2 rounded-md text-sm font-medium text-primary hover:text-primary-hover hover:bg-primary/5 flex items-center transition-colors"
                >
                  More
                  <svg className={`ml-1 h-4 w-4 transition-transform duration-200 ${isMoreOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isMoreOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-surface border border-border ring-1 ring-black ring-opacity-5 focus:outline-none z-50 animate-in fade-in zoom-in-95 duration-100">
                    {moreLinks.map((link) => (
                      <Link
                        key={link.name}
                        href={link.href}
                        className="block px-4 py-2 text-sm text-primary hover:bg-primary/10 hover:text-primary-hover transition-colors"
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
          <div className="hidden lg:flex lg:items-center lg:space-x-4">
            <ApiUsageIndicator />
            <ThemeSwitcher />
            <button
              onClick={() => {
                if (session && window.confirm('Are you sure you want to logout?')) {
                  signOut({ callbackUrl: "/login" });
                }
              }}
              disabled={!session}
              title="Logout"
              className={`p-2 rounded-xl transition-all duration-200 ${session
                ? 'bg-destructive/10 text-destructive hover:bg-destructive hover:text-white'
                : 'opacity-0 cursor-default pointer-events-none'
                }`}
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
          </div>

          {/* Mobile Menu Button */}
          <div className="-mr-2 flex items-center lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-primary hover:text-primary-hover hover:bg-primary/10 focus:outline-none transition-colors"
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
        <div className="lg:hidden border-t border-border/100 bg-surface shadow-lg animate-in slide-in-from-top-1 duration-200">
          <div className="px-2 pt-1 pb-2">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`block px-3 py-1.5 text-base font-medium text-center transition-colors border-b border-solid border-border/50 ${isActive(link.href) ? "text-primary-hover font-bold bg-primary/10" : "text-primary hover:text-primary-hover hover:bg-primary/5"
                  }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}

            {/* Collapsible More Links */}
            <div>
              <button
                onClick={() => setIsMobileMoreOpen(!isMobileMoreOpen)}
                className="w-full px-3 py-1.5 text-base font-medium text-center relative text-primary hover:text-primary-hover hover:bg-primary/5 transition-colors border-b border-solid border-border/50"
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
                <div className="animate-in slide-in-from-top-1 duration-200">
                  {moreLinks.map((link) => (
                    <Link
                      key={link.name}
                      href={link.href}
                      className="block px-3 py-1.5 text-base font-medium text-center text-primary hover:text-primary-hover hover:bg-primary/5 transition-colors border-b border-solid border-border/50 last:border-b-0"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 pb-4 border-t border-border/100">
            <div className="flex items-center justify-center gap-6 px-5">
              <div className="flex items-center">
                <ApiUsageIndicator />
              </div>
              <ThemeSwitcher />
              {session && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    if (confirm('Are you sure you want to logout?')) signOut({ callbackUrl: "/login" });
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
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}