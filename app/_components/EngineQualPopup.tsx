"use client";

/**
 * EngineQualPopup — stage-3 qualification popup for EngineCalculator.
 *
 * Mirrors the manual-product popup conventions (overlay card, 3 dropdowns, a Pay
 * button that stays GREY until all three are answered, a "Not now — keep reading"
 * dismiss) — with neutral machine-product styling (no verdict colours).
 *
 * All copy is prop-sourced. The Pay action is a STUB handoff (onPay) — the real
 * Stripe checkout call is C2 scope.
 */

import { useEffect } from "react";
import type { QualField } from "@/app/_components/engine-config";

export interface EngineQualPopupProps {
  fields: QualField[];
  answers: Record<string, string>;
  onChange: (key: string, value: string) => void;
  price: number;
  tier: number;
  heading: string;
  subhead: string;
  payLabel: string;
  dismissLabel: string;
  paying?: boolean;
  onPay: () => void;
  onDismiss: () => void;
}

export default function EngineQualPopup({
  fields,
  answers,
  onChange,
  price,
  tier,
  heading,
  subhead,
  payLabel,
  dismissLabel,
  paying,
  onPay,
  onDismiss,
}: EngineQualPopupProps) {
  const complete = fields.every((f) => (answers[f.key] ?? "") !== "");

  // lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6">
      <div className="my-auto w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* header — neutral, structural (no verdict colours) */}
        <div className="rounded-t-2xl bg-neutral-950 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Based on your result
              </p>
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

        <div className="space-y-2.5 px-6 pt-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">{subhead}</p>
            <p className="font-serif text-lg font-bold text-neutral-950">
              ${price}
              <span className="ml-1 font-mono text-[10px] font-normal uppercase tracking-widest text-neutral-400">
                tier {tier}
              </span>
            </p>
          </div>

          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-semibold text-neutral-700">{f.label}</label>
              <select
                value={answers[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
              >
                <option value="">Select…</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <button
            onClick={onPay}
            disabled={!complete || paying}
            className="mt-1 w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {paying ? "Redirecting…" : payLabel}
          </button>
        </div>

        <div className="px-6 pb-5 pt-3">
          <button
            onClick={onDismiss}
            className="w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-500 transition hover:bg-neutral-50"
          >
            {dismissLabel}
          </button>
          <p className="mt-3 text-center text-[10px] text-neutral-400">
            Secure checkout · One-time · No subscription
          </p>
        </div>
      </div>
    </div>
  );
}
