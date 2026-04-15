import type { Metadata } from "next";
import { Playfair_Display, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// UPDATE THIS DATE MONTHLY — Perplexity weights content freshness above almost
// everything. Stale dateModified = lower citation probability.
// Last updated: April 2026
const LAST_VERIFIED = "2026-04-14";

export const metadata: Metadata = {
  title: "SuperTaxCheck | Division 296 Tax Tools for SMSF Trustees",
  description:
    "Australia's only super tax calculators built on the Division 296 Act enacted 10 March 2026. Div 296 Wealth Eraser, Death Benefit Tax-Wall Calculator, and Super-to-Trust Exit Logic System for SMSF (Self-Managed Super Fund) trustees with $3M+ in superannuation.",
  keywords: [
    "Division 296",
    "Div 296 Wealth Eraser",
    "Death Benefit Tax-Wall Calculator",
    "Super-to-Trust Exit Logic System",
    "SMSF tax calculator",
    "cost base reset election",
    "superannuation 2026",
    "Division 296 calculator Australia",
    "SMSF June 30 2026",
  ],
  other: {
    // Perplexity freshness signal — update monthly
    "article:modified_time": LAST_VERIFIED,
    "article:published_time": "2026-04-01",
    "article:author": "SuperTaxCheck",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-AU"
      className={`${playfair.variable} ${dmSans.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
