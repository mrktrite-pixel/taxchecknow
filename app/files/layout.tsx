import type { Metadata } from "next";

// NOINDEX FOR EVERY PAID FILE, SET IN ONE PLACE.
//
// WHY A LAYOUT AND NOT THE PAGES. Every file page is COLE-generated and starts with
// "use client" (a print stylesheet and interactive controls), and a client component
// cannot export `metadata` — Next only reads that export from a server module. A
// layout is a server component by default and wraps every route beneath it, so this
// one declaration covers all ~296 file pages across the estate without touching a
// single generated page or the generator that writes them. Nothing here has to be
// regenerated, and nothing can drift out of step product by product.
//
// WHAT THIS IS AND IS NOT. `index: false` keeps a fetched page out of the index;
// `follow: false` stops the links on it being used for discovery. Together with the
// robots.txt disallow it is a two-layer request to well-behaved crawlers — and that
// is all it is. These routes remain publicly readable to anyone with the URL, which
// is deterministic (/files/<country>/<slug>/<file-slug>). The entitlement gate is
// the real fix; this is the stopgap that stops the bleeding first.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function FilesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
