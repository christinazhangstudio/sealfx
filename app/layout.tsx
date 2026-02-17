import type { Metadata } from "next";
import "../styles/globals.css";
import { Providers } from "./providers";
import ClientLayoutWrapper from "./client-layout-wrapper";

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
          <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}