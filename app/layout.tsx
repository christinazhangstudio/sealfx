import type { Metadata } from "next";
import { Comfortaa } from "next/font/google";
import "../styles/globals.css";
import NavMenu from "./navmenu";

const comfortaa = Comfortaa({
  weight: "400",
  subsets: ['latin']
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
                  <img
                    src="/seal.png"
                    alt="web logo"
                    className="h-16 w-30 object-contain"
                  />
                  <h1 className="text-6xl text-pink-800 drop-shadow-sm whitespace-nowrap">
                    sealift
                  </h1>
                </div>
                <p className="text-2xl text-pink-700 hidden sm:block drop-shadow-sm text-center md:text-left">
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
      </body>
    </html>
  );
}