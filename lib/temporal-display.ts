// lib/temporal-display.ts — the ONE label, resolved at render.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// WHY THIS EXISTS
//
// TEMPORAL v1 ruled that a fixed deadline is a recurrence rule and never a stored date, and it
// enforced that for the EMAIL lane: lib/temporal-resolver.ts computes the next occurrence at send
// time from the product's declaration. The three DISPLAY surfaces never got the same treatment.
// They were emitted from `config.deadline`:
//
//   gate page      const DEADLINE_ISO = "2027-06-15T23:59:59.000-04:00"   (baked literal)
//   success pages  new Date("2027-06-15T23:59:59.000-04:00")              (baked literal)
//   files          fallbackText="IRS EXPAT DEADLINE: 15 June 2027"        (baked literal, no math)
//
// So the same product had TWO temporal truths: a rule the scheduler recomputed every day, and a
// string frozen at generate time. On 16 June 2027 the scheduler would move to 2028-06-15 while
// every page still said "15 June 2027" — and the gate page would additionally log
// "[TEMPORAL] expired deadline suppressed" on every single load, the "channel trained to be
// ignored" failure the Phase 0 comment in generate-success-pages.ts warns about.
//
// Worse, the obvious fix on its own makes it fail harder: clearing `deadline.isoDate` (so no stale
// date is stored) leaves productClaimsADate() returning true for a fixed rule while nothing can
// produce a date, which is EXACTLY the FRCGW failure documented at generate-success-pages.ts:940.
// The missing piece was never the blanking — it was a display path that reads the rule.
//
// This is that path. One function, four callers, one label.
//
// ── WHAT ACTIVATES IT ────────────────────────────────────────────────────────────────────────
//
// A product whose `temporal` declares a PRODUCT-LEVEL computable rule (source "fixed"). Every
// other product — a stored isoDate, a per-customer rule, `none`, `unresolvable`, undeclared — is
// untouched and keeps byte-identical output. Today that is one product by design: the generators
// take this path only when `deadline.isoDate` is empty AND a fixed rule exists, so no shipped
// countdown changes underneath anyone.
//
// ── PURE, AND SAFE ON BOTH SIDES OF THE BOUNDARY ─────────────────────────────────────────────
//
// No I/O, no node built-ins, `now` is injectable. The gate page calls it on the server per render;
// DocStrip calls it in the browser. Same answer, because it is the same arithmetic the scheduler
// uses — lib/temporal-resolver.ts, not a second implementation that can disagree with it.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import { resolve as resolveTemporal } from "./temporal-resolver";
import { lookupTemporal } from "./temporal-registry";
import type { TemporalDeclaration } from "./temporal-types";

export interface DeadlineDisplay {
  /** The resolved CALENDAR date, YYYY-MM-DD in the declared timezone. */
  iso: string;
  /** Long form for prose and headings: "15 June 2027". */
  display: string;
  /** Pill form: "15 Jun 2027". */
  short: string;
  /** Whole days from today in the declared zone. Always >= 0 for a RESOLVED date. */
  daysAway: number;
  /** The declaration's own label, when it carries one. */
  label?: string;
  timezone: string;
}

/**
 * Format a YYYY-MM-DD calendar date without letting a timezone move it.
 *
 * `new Date("2027-06-15")` is midnight UTC, and formatting that in a western zone prints the 14th.
 * The date is a CALENDAR date by definition (see the resolver's header), so it is formatted in UTC
 * and the zone is irrelevant — which is the only way "15 June" cannot become "14 June" for a reader
 * in Los Angeles.
 */
function formatCalendarDate(iso: string, month: "long" | "short"): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", day: "numeric", month, year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "15 June 2027" */
export function formatDisplay(iso: string): string {
  return formatCalendarDate(iso, "long");
}

/** "15 Jun 2027" */
export function formatShort(iso: string): string {
  return formatCalendarDate(iso, "short");
}

/** Whole days between two calendar dates. Both are UTC-anchored, so no DST hour can round it off. */
function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** Today's calendar date in a zone. Mirrors the resolver's todayInZone, formatted. */
function todayIsoInZone(now: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(now);
  } catch {
    // An invalid zone is the declaration's problem, not this function's. Falling back to UTC here
    // only affects the day-count, and the resolver has already refused the date if it cared.
    return now.toISOString().slice(0, 10);
  }
}

/**
 * Turn a declaration into the label every surface shows, or null.
 *
 * NULL FOR EVERYTHING THAT IS NOT A RESOLVED FUTURE DATE — UNDECLARED, NONE, UNRESOLVABLE and
 * EXPIRED all return null, exactly like schedulableDate() does for the scheduler. A caller that
 * gets null must suppress its countdown, never print a zero or a stale string. That symmetry is
 * the point: the page and the email cannot disagree about whether this product has a date, because
 * they are asking the same function the same question.
 */
export function deadlineDisplayFor(
  declaration: TemporalDeclaration | null | undefined,
  now: Date = new Date(),
): DeadlineDisplay | null {
  const res = resolveTemporal(declaration, null, now);
  if (res.status !== "RESOLVED") return null;
  return {
    iso: res.date,
    display: formatDisplay(res.date),
    short: formatShort(res.date),
    daysAway: Math.max(0, daysBetween(todayIsoInZone(now, res.timezone), res.date)),
    label: res.label,
    timezone: res.timezone,
  };
}

/**
 * The same thing, looked up from the generated registry by product.
 *
 * This is what a generated page calls: it takes no config, so a page never re-states a date its
 * config could contradict. An unregistered product returns null and the page suppresses — the
 * "absence is never a fallback" rule from Step 6.3, applied to display.
 */
export function resolvedDeadlineFor(
  site: string,
  productId: string,
  now: Date = new Date(),
): DeadlineDisplay | null {
  return deadlineDisplayFor(lookupTemporal(site, productId), now);
}
