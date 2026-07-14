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
 * PRESENTATION: "the engine look" — white premium modal on a navy backdrop-blur overlay
 * (tokens navy #0B1F44 / accent #2563EB / ink #0F172A / muted #64748B / hairline #E2E8F0).
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#0B1F44]/80 px-4 py-6 backdrop-blur-sm">
      <div className="my-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        {/* header — kicker + heading, price chip top-right (structural, no verdict colours) */}
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Based on your result</p>
            <p className="mt-1 text-[20px] font-bold leading-snug text-[#0F172A]">{heading}</p>
            <p className="mt-1 text-sm text-[#64748B]">{subhead}</p>
          </div>
          <div className="shrink-0 rounded-2xl border border-[#E2E8F0] bg-[#F4F6FB] px-3 py-2 text-right">
            <p className="text-lg font-bold leading-none text-[#0F172A]">${price}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">tier {tier}</p>
          </div>
        </div>

        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-semibold text-[#334155]">{f.label}</label>
              <select
                value={answers[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                className="min-h-[48px] w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none transition-colors focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#2563EB] motion-reduce:transition-none"
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
            className="mt-1 w-full rounded-xl bg-[#0B1F44] py-4 text-[16px] font-semibold text-white transition-colors hover:bg-[#132F62] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 motion-reduce:transition-none"
          >
            {paying ? "Redirecting…" : payLabel}
          </button>
        </div>

        <button
          onClick={onDismiss}
          className="mt-3 w-full rounded-xl border border-[#E2E8F0] bg-white py-3 text-sm font-medium text-[#64748B] transition-colors hover:bg-[#F4F6FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          {dismissLabel}
        </button>
        <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">
          Secure checkout · One-time · No subscription
        </p>
      </div>
    </div>
  );
}
