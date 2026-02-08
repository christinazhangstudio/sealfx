"use client";

import { useState, useEffect, useRef } from "react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
// Font imports removed as they are handled globally

// Font initialization removed

export default function NavMenu() {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Toggle dropdown for mobile
  const toggleDropdown = () => {
    setIsMoreOpen(!isMoreOpen);
  };

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

  return (
    <nav className="bg-[var(--nav-bg)] shadow-md sticky top-0 z-10">
      <div>
        <div className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-2 sm:py-4 flex-col md:flex-row gap-2 md:gap-0 min-h-[4rem] md:h-auto">
            <div className="flex shrink-0 pl-2 md:pl-4">
              <a
                href="/"
                className="flex items-center text-primary hover:text-primary-hover"
              >
                <span className="text-xl">Home</span>
              </a>
            </div>
            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-8 text-center md:text-left">
              <a
                href="/notes"
                className="text-primary hover:text-primary-hover transition-colors duration-200 text-sm md:text-base whitespace-nowrap"
              >
                Notes
              </a>
              <a
                href="/payouts"
                className="text-primary hover:text-primary-hover transition-colors duration-200 text-sm md:text-base whitespace-nowrap"
              >
                Payouts
              </a>
              <a
                href="/listings"
                className="text-primary hover:text-primary-hover transition-colors duration-200 text-sm md:text-base whitespace-nowrap"
              >
                Listings (Detail)
              </a>
              <a
                href="/gallery"
                className="text-primary hover:text-primary-hover transition-colors duration-200 text-sm md:text-base whitespace-nowrap"
              >
                Listings (Gallery)
              </a>
              <a
                href="/charts"
                className="text-primary hover:text-primary-hover transition-colors duration-200 text-sm md:text-base whitespace-nowrap"
              >
                Charts
              </a>
              {/* More Dropdown */}
              <div className="relative group" ref={dropdownRef}>
                <button
                  className="text-primary hover:text-primary-hover transition-colors duration-200 text-sm md:text-base whitespace-nowrap flex items-center"
                  onClick={toggleDropdown}
                >
                  More
                  <svg
                    className="w-4 h-4 ml-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <div
                  className={`${isMoreOpen ? "block" : "hidden"
                    } md:group-hover:block absolute right-0 -mt-1 pt-2 w-48 z-20`}
                >
                  <div className="bg-surface rounded-md shadow-lg border border-border">
                    <div className="py-1">
                      <a
                        href="/changelog"
                        className="block px-4 py-2 text-sm text-primary hover:bg-background-start hover:text-primary-hover"
                        onClick={() => setIsMoreOpen(false)}
                      >
                        Changelog
                      </a>
                      <a
                        href="/accounts"
                        className="block px-4 py-2 text-sm text-primary hover:bg-background-start hover:text-primary-hover"
                        onClick={() => setIsMoreOpen(false)}
                      >
                        Accounts
                      </a>
                      <a
                        href="/transaction"
                        className="block px-4 py-2 text-sm text-primary hover:bg-background-start hover:text-primary-hover"
                        onClick={() => setIsMoreOpen(false)}
                      >
                        Transactions
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              <ThemeSwitcher />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}