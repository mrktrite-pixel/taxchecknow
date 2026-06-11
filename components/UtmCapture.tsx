"use client";

// UTM capture (8b) — global, mounted once in the root layout. Two jobs, zero
// per-calculator edits:
//
//   1. FIRST-TOUCH capture: on landing, read location.search; if any utm_* param
//      is present AND sessionStorage has none yet, persist {utm_source/medium/
//      campaign/content} to sessionStorage('tcn_utm'). First-touch wins — the
//      attribution belongs to the ARRIVAL, so we never overwrite an existing
//      value on later navigations (which strip the query string today).
//
//   2. FETCH WRAPPER: monkey-patch window.fetch ONCE to inject the stored UTMs
//      into the body of POST /api/decision-sessions (the session-create call),
//      only for fields the caller didn't already set. Every calculator's inline
//      POST then carries the UTMs without being touched.
//
// Server (route.ts) reads the four fields, trims + caps them, writes the columns.
// Sessions with no UTMs are unchanged.
import { useEffect } from "react";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
const STORE = "tcn_utm";

export default function UtmCapture() {
  useEffect(() => {
    // 1 — first-touch capture
    try {
      if (!sessionStorage.getItem(STORE)) {
        const sp = new URLSearchParams(window.location.search);
        const utm: Record<string, string> = {};
        for (const k of UTM_KEYS) { const v = sp.get(k); if (v) utm[k] = v.slice(0, 100); }
        if (Object.keys(utm).length) sessionStorage.setItem(STORE, JSON.stringify(utm));
      }
    } catch { /* sessionStorage unavailable (SSR/private mode) — non-blocking */ }

    // 2 — fetch wrapper (patch once for the app lifetime)
    const w = window as unknown as { __tcnUtmPatched?: boolean };
    if (w.__tcnUtmPatched) return;
    w.__tcnUtmPatched = true;
    const orig = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url ?? "";
        const method = (init?.method ?? (input instanceof Request ? input.method : "GET") ?? "GET").toUpperCase();
        if (url.includes("/api/decision-sessions") && method === "POST" && typeof init?.body === "string") {
          const raw = sessionStorage.getItem(STORE);
          if (raw) {
            const utm = JSON.parse(raw) as Record<string, string>;
            const body = JSON.parse(init.body) as Record<string, unknown>;
            for (const k of UTM_KEYS) if (utm[k] && body[k] === undefined) body[k] = utm[k];
            init = { ...init, body: JSON.stringify(body) };
          }
        }
      } catch { /* never let attribution break a real request */ }
      return orig(input, init);
    };
  }, []);

  return null;
}
