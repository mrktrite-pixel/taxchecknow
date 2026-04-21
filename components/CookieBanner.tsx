"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem("cookie_consent");
      if (!consent) setVisible(true);
    } catch { /* localStorage not available */ }
  }, []);

  function accept() {
    try { localStorage.setItem("cookie_consent", "accepted"); } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white px-4 py-3 shadow-lg lg:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <p className="text-xs text-neutral-600">
          This site uses essential cookies and privacy-first analytics.
          No advertising cookies. No cross-site tracking.{" "}
          <Link href="/privacy" className="underline hover:text-neutral-950 transition">
            Privacy policy →
          </Link>
        </p>
        <button
          onClick={accept}
          className="shrink-0 rounded-lg bg-neutral-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-800"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
