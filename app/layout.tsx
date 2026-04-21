import type { Metadata } from "next";
import { Playfair_Display, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";

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
const LAST_VERIFIED = "2026-04-21";

export const metadata: Metadata = {
  title: "TaxCheckNow | Tax Position Checks — AU · UK · US · NZ",
  description:
    "Free tax position calculators for Australia, UK, US, and New Zealand. Personalised assessments built around your exact answers — not generic guides. ATO, HMRC, IRS, and IRD verified.",
  keywords: [
    "tax calculator Australia",
    "Medicare Levy Surcharge calculator",
    "CGT main residence exemption",
    "Making Tax Digital calculator",
    "HMRC tax check",
    "ATO tax position",
    "IRD New Zealand tax",
    "personalised tax assessment",
    "tax citation gap",
  ],
  other: {
    "article:modified_time": LAST_VERIFIED,
    "article:published_time": "2026-04-01",
    "article:author": "TaxCheckNow",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} ${dmMono.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
