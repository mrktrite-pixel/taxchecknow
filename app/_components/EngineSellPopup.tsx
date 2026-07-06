"use client";

/**
 * EngineSellPopup — popup 1 of the two-popup flow: the WHAT-YOU-GET sell panel.
 *
 * Shows the tier name + price, the "what's included" bullets (config planChecklist),
 * an alt-tier switch link (resolved dishes only), a primary "Get it" button that
 * advances to popup 2 (the 3 questions + Pay), and a "Not now — keep reading" dismiss.
 *
 * STRUCTURE here; all DOMAIN WORDS arrive via props (config-supplied).
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6">
      <div className="my-auto w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* header — neutral, structural */}
        <div className="rounded-t-2xl bg-neutral-950 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">What you get</p>
              <p className="mt-1 font-serif text-xl font-bold text-white">{heading}</p>
            </div>
            <button
              onClick={onDismiss}
              className="rounded-lg bg-white/10 px-2 py-1 font-mono text-xs text-neutral-300 transition hover:bg-white/20"
            >
              ✕ close
            </button>
          </div>
        </div>

        <div className="px-6 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-neutral-600">{subhead}</p>
            <p className="font-serif text-lg font-bold text-neutral-950">
              ${price}
              <span className="ml-1 font-mono text-[10px] font-normal uppercase tracking-widest text-neutral-400">tier {tier}</span>
            </p>
          </div>

          <ul className="mb-4 space-y-1.5 text-sm text-neutral-700">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-emerald-600">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={onGetIt}
            className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800"
          >
            {getItLabel}
          </button>

          {altLabel && onAlt && (
            <p className="mt-2 text-center">
              <button onClick={onAlt} className="text-xs text-neutral-400 underline transition hover:text-neutral-600">
                {altLabel}
              </button>
            </p>
          )}
        </div>

        <div className="px-6 pb-5 pt-3">
          <button
            onClick={onDismiss}
            className="w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-500 transition hover:bg-neutral-50"
          >
            {dismissLabel}
          </button>
          <p className="mt-3 text-center text-[10px] text-neutral-400">Secure checkout · One-time · No subscription</p>
        </div>
      </div>
    </div>
  );
}
