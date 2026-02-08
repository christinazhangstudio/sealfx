import type { Metadata } from "next";
import "../styles/globals.css";
import NavMenu from "./navmenu";

import { Providers } from "./providers";

// Font imports removed


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
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background">
        <Providers>
          <div>
            <div className="bg-[var(--nav-bg)] border-b py-4 shadow-sm border-border">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between backdrop-blur-sm rounded-lg p-2 flex-col md:flex-row gap-4 sm:gap-0">
                  <div className="flex items-center space-x-4 shrink-0">
                    <img
                      src="/seal.png"
                      alt="web logo"
                      className="h-16 w-30 object-contain"
                    />
                    <h1 className="text-6xl text-primary-hover drop-shadow-sm whitespace-nowrap font-heading">
                      sealift
                    </h1>
                  </div>
                  <p className="text-2xl text-primary hidden sm:block drop-shadow-sm text-center md:text-left font-heading">
                    See all of your marketplace!
                  </p>
                </div>
              </div>
            </div>
          </div>

          <NavMenu />

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-0">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}