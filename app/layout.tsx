import type { Metadata } from "next";
import {
  Inconsolata,
  Libre_Baskerville,
  M_PLUS_1p,
  Quattrocento_Sans,
} from "next/font/google";
import "../styles/globals.css";
import { Providers } from "./providers";
import ClientLayoutWrapper from "./client-layout-wrapper";

const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const quattrocentoSans = Quattrocento_Sans({
  variable: "--font-quattrocento-sans",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const inconsolata = Inconsolata({
  variable: "--font-inconsolata",
  subsets: ["latin"],
  display: "swap",
});

const mPlus1p = M_PLUS_1p({
  variable: "--font-m-plus-1p",
  subsets: ["latin"],
  weight: ["400"],
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
    <html
      lang="en"
      className={`${libreBaskerville.variable} ${quattrocentoSans.variable} ${inconsolata.variable} ${mPlus1p.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=person&display=swap"
        />
      </head>
      <body className="min-h-screen bg-background">
        <Providers>
          <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}
