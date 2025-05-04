import type { Metadata } from "next";
import { Geist, Geist_Mono, Comfortaa } from "next/font/google";
import "../styles/globals.css";

const comfortaa = Comfortaa({
  weight: "400",
});

export const metadata: Metadata = {
  title: "Sealift",
  description: "Sealift for marketplace management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-pink-50">
        <div className={comfortaa.className}>
          <div className="bg-gradient-to-b from-blue-100 via-pink-100 to-pink-0 border-b py-4 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between backdrop-blur-sm rounded-lg p-2 flex-col md:flex-row gap-4 sm:gap-0">
                <div className="flex items-center space-x-4 shrink-0">
                  {/* seal */}
                  <img
                    src="/seal.png"
                    alt="web logo"
                    className="h-16 w-30 object-contain" // adjust size
                  />
                  <h1 className="text-6xl text-pink-800 drop-shadow-sm whitespace-nowrap">
                    sealift
                  </h1>
                </div>
                <p className="text-2xl text-pink-700 hidden sm:block drop-shadow-sm text-center lm:text-left">
                  See all of your marketplace!
                </p>
              </div>
            </div>
          </div>
        </div>

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
                    href="/transaction"
                    className="text-pink-700 hover:text-pink-900 transition-colors duration-200 text-sm md:text-base whitespace-nowrap"
                  >
                    Transactions
                  </a>
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
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* main content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-0">
          {children}
        </main>
      </body>
    </html>
  );
}
