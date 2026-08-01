import type { Metadata } from "next";
import { Quattrocento_Sans } from "next/font/google";
import "../styles/globals.css";
import { Providers } from "./providers";
import ClientLayoutWrapper from "./client-layout-wrapper";

const quattrocentoSans = Quattrocento_Sans({
  variable: "--font-page-title",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${quattrocentoSans.variable} min-h-screen bg-background`}>
        <Providers>
          <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}
