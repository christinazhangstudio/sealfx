import type { Metadata } from "next";
import { Geist, Geist_Mono, Comfortaa } from "next/font/google";
import "./globals.css";

const comfortaa = Comfortaa({
  weight: '400',
})

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
            <div className="flex items-center justify-between backdrop-blur-sm rounded-lg p-2 flex-col sm:flex-row gap-4 sm:gap-0">
            <div className="flex items-center space-x-4 shrink-0">
                {/* seal */}
                <img 
                  src="/seal.png" 
                  alt="web logo" 
                  className="h-16 w-20 object-contain" // adjust size
                />
                <h1 className="text-6xl font-rubik text-pink-800 drop-shadow-sm whitespace-nowrap">
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <a
                  href="/"
                  className="flex items-center text-pink-700 hover:text-pink-900"
                >
                  <span className="font-rubik text-xl">Home</span>
                </a>
              </div>
              
              <div className="flex items-center space-x-8">
                <a
                  href="/about"
                  className="text-pink-700 hover:text-pink-900 font-rubik transition-colors duration-200"
                >
                  About
                </a>
                <a
                  href="/services"
                  className="text-pink-700 hover:text-pink-900 font-rubik transition-colors duration-200"
                >
                  Services
                </a>
                <a
                  href="/contact"
                  className="text-pink-700 hover:text-pink-900 font-rubik transition-colors duration-200"
                >
                  Contact
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
