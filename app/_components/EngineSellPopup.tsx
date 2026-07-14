"use client";

/**
 * EngineSellPopup — popup 1 of the two-popup flow: the WHAT-YOU-GET sell panel.
 *
 * Shows the tier name + price, the "what's included" bullets (config planChecklist),
 * an alt-tier switch link (resolved dishes only), a primary "Get it" button that
 * advances to popup 2 (the 3 questions + Pay), and a "Not now — keep reading" dismiss.
 *
 * STRUCTURE here; all DOMAIN WORDS arrive via props (config-supplied).
 * PRESENTATION: "the engine look" — white premium modal on a navy backdrop-blur overlay
 * (tokens navy #0B1F44 / accent #2563EB / ink #0F172A / muted #64748B / hairline #E2E8F0).
 */

import { useEffect } from "react";

export interface EngineSellPopupProps {
  heading: string;
  subhead: string;
  tier: number;
  price: number;
  bullets: string[];
  getItLabel: string;
  onGetIt: () => void;
  dismissLabel: string;
  onDismiss: () => void;
  // resolved dishes only — escapes pass neither (no alt-tier on a "closer look")
  altLabel?: string;
  onAlt?: () => void;
}

export default function EngineSellPopup({
  heading, subhead, tier, price, bullets,
  getItLabel, onGetIt, dismissLabel, onDismiss, altLabel, onAlt,
}: EngineSellPopupProps) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#0B1F44]/80 px-4 py-6 backdrop-blur-sm">
      <div className="my-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        {/* header — kicker + heading, price chip top-right (structural, no verdict colours) */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">What you get</p>
            <p className="mt-1 text-[20px] font-bold leading-snug text-[#0F172A]">{heading}</p>
          </div>
          <div className="shrink-0 rounded-2xl border border-[#E2E8F0] bg-[#F4F6FB] px-3 py-2 text-right">
            <p className="text-lg font-bold leading-none text-[#0F172A]">${price}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">tier {tier}</p>
          </div>
        </div>

        <p className="mb-4 text-sm text-[#64748B]">{subhead}</p>

        <ul className="mb-5 space-y-2 text-[14px] text-[#334155]">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span aria-hidden className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={onGetIt}
          className="w-full rounded-xl bg-[#0B1F44] py-4 text-[16px] font-semibold text-white transition-colors hover:bg-[#132F62] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          {getItLabel}
        </button>

        {altLabel && onAlt && (
          <p className="mt-2 text-center">
            <button onClick={onAlt} className="rounded-md text-xs text-[#64748B] underline transition-colors hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 motion-reduce:transition-none">
              {altLabel}
            </button>
          </p>
        )}

        <button
          onClick={onDismiss}
          className="mt-3 w-full rounded-xl border border-[#E2E8F0] bg-white py-3 text-sm font-medium text-[#64748B] transition-colors hover:bg-[#F4F6FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          {dismissLabel}
        </button>
        <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Secure checkout · One-time · No subscription</p>
      </div>
    </div>
  );
}
