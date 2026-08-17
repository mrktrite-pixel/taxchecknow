"use client";

/**
 * SuccessDeadline — the red/amber/green strip (R2) and the key-dates block (R2 + E3).
 *
 * WHAT THIS REPLACES. Both were hardcoded and unconditional on every FRCGW success page:
 * one strip reading "Certificate must reach the buyer's solicitor BEFORE settlement · Lodge
 * ≥28 days out", and a calendar of one (tier 1) or three (tier 2) fixed events. They were
 * byte-identical for all ten terminals, so a buyer whose settlement had already passed
 * without a certificate was told to lodge 28 days out, and the tier-2 calendar shipped an
 * event literally titled "SET TO YOUR ACTUAL SETTLEMENT DATE" 28 days from purchase —
 * because there was no date to anchor to and it invented an anchor anyway.
 *
 * Now both come from the terminal (lib/terminal-presentation.ts) and, where the buyer gave a
 * real settlement date (E3), carry real dates. Where they did not, settlement-anchored events
 * are DROPPED rather than defaulted, and the strip states the rule instead of a countdown.
 *
 * GENERIC: unmapped products fall back to the caller's own copy and their config calendar.
 */

import { useState } from "react";
import type { BuyerContext } from "@/lib/buyer-context";
import { daysUntilIso } from "@/lib/buyer-context";
import {
  getTerminalPresentation,
  isPastSettlement,
  resolveCalendar,
  type ResolvedCalendarEvent,
  type StripTone,
} from "@/lib/terminal-presentation";

const TONE: Record<StripTone, { bar: string; text: string }> = {
  green: { bar: "bg-emerald-700", text: "text-white" },
  amber: { bar: "bg-amber-600", text: "text-white" },
  red: { bar: "bg-red-700", text: "text-white" },
  blue: { bar: "bg-blue-700", text: "text-white" },
};

const DOT: Record<StripTone, string> = { green: "🟢", amber: "🟠", red: "🔴", blue: "🔵" };

export interface SuccessDeadlineProps {
  productId: string;
  productName: string;
  calendarFileName: string;
  ctx: BuyerContext | null;
  /** Used when the product/terminal has no map entry — today's copy, unchanged. */
  fallback: { headline: string; badge?: string };
}

function icsDate(iso: string): string {
  return iso.replace(/-/g, "");
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function buildIcs(productName: string, events: ResolvedCalendarEvent[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TaxCheckNow//COLE//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(productName)} — key dates`,
  ];
  for (const e of events) {
    if (!e.isoDate) continue; // never emit an undated event
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}-${stamp}@taxchecknow.com`,
      `DTSTART;VALUE=DATE:${icsDate(e.isoDate)}`,
      `DTEND;VALUE=DATE:${icsDate(e.isoDate)}`,
      `DTSTAMP:${stamp}`,
      `SUMMARY:${escapeIcs(e.summary)}`,
      `DESCRIPTION:${escapeIcs(e.description)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export default function SuccessDeadline({
  productId,
  productName,
  calendarFileName,
  ctx,
  fallback,
}: SuccessDeadlineProps) {
  const [done, setDone] = useState(false);

  const presentation = getTerminalPresentation(productId, ctx?.terminalId, {
    headline: fallback.headline,
    badge: fallback.badge,
    fileSlugs: [],
  });
  const events = resolveCalendar(presentation.calendar, ctx ?? { terminalId: null, tier: null, flags: [], values: {}, conflicts: [] });
  const tone = presentation.strip.tone;

  const settlementIso = ctx?.values.settlement_date_iso;
  const daysToSettlement = settlementIso ? daysUntilIso(settlementIso) : null;

  // ── P1 — "you did not give us a settlement date" is a PRE-settlement sentence ──────────
  //
  // Measured on a live $147 recovery buy (17 Aug 2026, c0a51e9): a buyer whose settlement had
  // already passed was told "You did not give us a settlement date, so these are sequenced
  // rather than dated — and anything that could only be timed from your settlement is left out
  // rather than guessed." Nothing false, but there was never a date for him to give and nothing
  // was left out for want of one; it reads as an omission on his part that cost him content.
  //
  // Exactly the class D14 fixed for the labels, and the last surface still reading the wrong
  // bag: the note was gated on `!settlementIso` alone while every other conditional on the page
  // branches on the terminal. Same merged set here (terminalFlags), so this note and the File 01
  // / File 06 "Your dates" blocks — already {{#unless state:settled}}-guarded — cannot disagree.
  //
  // OMISSION ONLY, never a substitute assertion: the suppress: doctrine. All four past-settlement
  // terminals carry state:settled (the three no-certificate-* and certificate-provided), so
  // state:settled alone would do it; section:recovery is kept because that is what the sentence
  // is actually wrong ABOUT, and a future recovery terminal must not have to remember this file.
  const settlementIsBehindThem = isPastSettlement(productId, ctx);

  function download() {
    const blob = new Blob([buildIcs(productName, events)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = calendarFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDone(true);
  }

  return (
    <>
      {/* ── STRIP ── */}
      <div className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2.5 ${TONE[tone].bar}`}>
        <span className={`text-sm font-bold ${TONE[tone].text}`}>
          {DOT[tone]} {presentation.strip.headline}
        </span>
        {presentation.strip.badge && (
          <span className={`font-mono text-sm font-bold ${TONE[tone].text}`}>{presentation.strip.badge}</span>
        )}
      </div>

      {/* ── E3 COUNTDOWN — only ever from a date the buyer actually typed ── */}
      {ctx?.values.settlement_date && daysToSettlement !== null && (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your settlement</p>
          <p className="text-sm font-semibold text-neutral-950">
            {ctx.values.settlement_date}
            {daysToSettlement >= 0 ? (
              <span className="font-normal text-neutral-600">
                {" "}
                — {daysToSettlement} day{daysToSettlement === 1 ? "" : "s"} away
              </span>
            ) : (
              <span className="font-normal text-neutral-600"> — already passed</span>
            )}
          </p>
          {ctx.values.lodge_by_date && daysToSettlement >= 0 && (
            <p className="mt-0.5 text-xs text-neutral-500">
              Lodge by {ctx.values.lodge_by_date} to leave the full 28 days the ATO asks you to allow. Most
              certificates issue well inside that.
            </p>
          )}
        </div>
      )}

      {/* ── KEY DATES ── */}
      {events.length > 0 && (
        <div className="print-section mt-5 rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Key dates</p>
          <h2 className="mb-4 font-serif text-lg font-bold text-neutral-950">
            {settlementIso ? "Your dates — add them now" : "What to do, and when"}
          </h2>
          {!settlementIso && !settlementIsBehindThem && (
            <p className="mb-3 text-xs text-neutral-500">
              You did not give us a settlement date, so these are sequenced rather than dated — and anything
              that could only be timed from your settlement is left out rather than guessed.
            </p>
          )}
          <div className="mb-4 space-y-2">
            {events.map((e) => (
              <div
                key={e.uid}
                className="flex items-start justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{e.summary}</p>
                  <p className="text-xs text-neutral-500">{e.description}</p>
                </div>
                <span className="ml-3 shrink-0 whitespace-nowrap font-mono text-xs font-bold text-neutral-500">
                  {e.chip}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={download}
            className="no-print w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800"
          >
            {done ? "✓ Downloaded — open the .ics file to add to your calendar" : "📅 Add these to your calendar →"}
          </button>
        </div>
      )}
    </>
  );
}
