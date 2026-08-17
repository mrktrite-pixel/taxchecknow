"use client";

/**
 * DocStrip — the urgency bar at the top of a deliverable document.
 *
 * R2. This bar was hardcoded red on every document of every product, composed from
 * config.deadline.urgencyLabel + config.deadline.display. On FRCGW that meant all eight
 * paid documents opened with "🔴 CERTIFICATE MUST ARRIVE BEFORE SETTLEMENT" — including
 * File 07, whose entire subject is what to do when settlement has already happened without
 * one. A red imperative to do something the reader can no longer do, at the top of the
 * document explaining that they no longer need to.
 *
 * Now it reads the terminal the buyer actually reached and shows that terminal's strip.
 * Where there is no session (a cold link, a different device) it falls back to the
 * product's own declared line, which is the current behaviour — so a product with no
 * terminal map is unchanged.
 */

import { useEffect, useState } from "react";
import { buyerContextFromSession } from "@/lib/buyer-context";
import { getTerminalPresentation, type StripTone } from "@/lib/terminal-presentation";

const TONE: Record<StripTone, { bar: string; link: string }> = {
  green: { bar: "bg-emerald-700", link: "text-emerald-200" },
  amber: { bar: "bg-amber-600", link: "text-amber-100" },
  red: { bar: "bg-red-700", link: "text-red-200" },
  blue: { bar: "bg-blue-700", link: "text-blue-200" },
};

const DOT: Record<StripTone, string> = { green: "🟢", amber: "🟠", red: "🔴", blue: "🔵" };

export interface DocStripProps {
  productId: string;
  /** Shown until a session is read, and whenever there is none. */
  fallbackText: string;
  checkHref: string;
}

export default function DocStrip({ productId, fallbackText, checkHref }: DocStripProps) {
  const [strip, setStrip] = useState<{ tone: StripTone; text: string } | null>(null);

  useEffect(() => {
    const ctx = buyerContextFromSession(productId);
    if (!ctx.terminalId) return;
    const p = getTerminalPresentation(productId, ctx.terminalId, { headline: "", fileSlugs: [] });
    if (p.strip.headline) setStrip({ tone: p.strip.tone, text: p.strip.headline });
  }, [productId]);

  const tone: StripTone = strip?.tone ?? "red";
  const text = strip?.text ?? fallbackText;
  if (!text) return null;

  return (
    <div className={`mb-4 flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 ${TONE[tone].bar}`}>
      <span className="text-sm font-bold text-white">
        {DOT[tone]} {text}
      </span>
      <a href={checkHref} className={`no-print shrink-0 text-xs font-semibold transition hover:text-white ${TONE[tone].link}`}>
        Check your position →
      </a>
    </div>
  );
}
