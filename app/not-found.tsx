"use client";

import Link from "next/link";
import { useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
  }
}

export default function NotFound() {
  useEffect(() => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "page_not_found", {
        page_path:     window.location.pathname,
        page_referrer: document.referrer,
        page_title:    document.title,
      });
    }
    // Belt-and-braces: push to GTM dataLayer too, since GA4 lives inside the
    // GTM container. GA4 tags inside GTM will pick up either signal.
    if (typeof window !== "undefined" && window.dataLayer) {
      window.dataLayer.push({
        event:         "page_not_found",
        page_path:      window.location.pathname,
        page_referrer:  document.referrer,
        page_title:     document.title,
      });
    }
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-xl text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">404</p>
        <h1 className="mt-4 font-serif text-3xl sm:text-4xl font-bold leading-tight">
          That page does not exist.
        </h1>
        <p className="mx-auto mt-6 max-w-md text-base text-neutral-300 leading-relaxed">
          The link may be old, mistyped, or moved. Try one of these instead.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-xl bg-white px-6 py-3 font-serif text-sm font-bold text-neutral-950 transition hover:-translate-y-0.5"
          >
            Home
          </Link>
          <Link
            href="/gpt"
            className="rounded-xl border border-neutral-700 px-6 py-3 font-serif text-sm font-bold text-white transition hover:border-white"
          >
            All tax pre-checks
          </Link>
          <Link
            href="/questions"
            className="rounded-xl border border-neutral-700 px-6 py-3 font-serif text-sm font-bold text-white transition hover:border-white"
          >
            Questions answered
          </Link>
        </div>
      </div>
    </main>
  );
}
