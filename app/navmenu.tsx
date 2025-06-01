"use client";

import { useState, useEffect, useRef } from "react";
import { Comfortaa } from "next/font/google";

// RootLayout.tsx is a server component in Next.js, and server components cannot have event handlers 
// like onClick directly attached to elements. In order to use the onClick prop, we need to isolate the
// interactive dropdown functionality in a client component (ergo NavMenu), as server components can't 
// handle client-side interactivity.

const comfortaa = Comfortaa({
  weight: "400",
  subsets: ['latin']
});

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
    <nav className="bg-gradient-to-b from-blue-50 to-pink-50 shadow-md sticky top-0 z-10">
      <div className={comfortaa.className}>
        <div className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-2 sm:py-4 flex-col md:flex-row gap-2 md:gap-0 min-h-[4rem] md:h-auto">
            <div className="flex shrink-0 pl-2 md:pl-4">
              <a
                href="/"
                className="flex items-center text-pink-700 hover:text-pink-900"
              >
                <span className="text-xl">Home</span>
              </a>
            </div>
            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-8 text-center md:text-left">
              <a
                href="/payouts"
                className="text-pink-700 hover:text-pink-900 transition-colors duration-200 text-sm md:text-base whitespace-nowrap"
              >
                Payouts
              </a>
              <a
                href="/listings"
                className="text-pink-700 hover:text-pink-900 transition-colors duration-200 text-sm md:text-base whitespace-nowrap"
              >
                Listings (Detail)
              </a>
              <a
                href="/gallery"
                className="text-pink-700 hover:text-pink-900 transition-colors duration-200 text-sm md:text-base whitespace-nowrap"
              >
                Listings (Gallery)
              </a>
              <a
                href="/charts"
                className="text-pink-700 hover:text-pink-900 transition-colors duration-200 text-sm md:text-base whitespace-nowrap"
              >
                Charts
              </a>
              {/* More Dropdown */}
              <div className="relative group" ref={dropdownRef}>
                <button
                  className="text-pink-700 hover:text-pink-900 transition-colors duration-200 text-sm md:text-base whitespace-nowrap flex items-center"
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
                  className={`${
                    isMoreOpen ? "block" : "hidden"
                  } md:group-hover:block absolute right-0 -mt-1 pt-2 w-48 z-20`}
                >
                  <div className="bg-white rounded-md shadow-lg">
                    <div className="py-1">
                      <a
                        href="/changelog"
                        className="block px-4 py-2 text-sm text-pink-700 hover:bg-pink-50 hover:text-pink-900"
                        onClick={() => setIsMoreOpen(false)}
                      >
                        Changelog
                      </a>
                      <a
                        href="/transaction"
                        className="block px-4 py-2 text-sm text-pink-700 hover:bg-pink-50 hover:text-pink-900"
                        onClick={() => setIsMoreOpen(false)}
                      >
                        Transactions
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}