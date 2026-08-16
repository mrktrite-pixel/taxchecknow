// lib/terminal-presentation.ts
//
// R2 + R3 — what the paid pack SHOWS, decided by the terminal the buyer actually reached.
//
// WHY. Every surface on the FRCGW success pages was unconditional: one hardcoded red strip,
// one hardcoded calendar, one hardcoded file order, one hardcoded "Start with File 02".
// Measured consequence: a buyer whose settlement had already passed without a certificate
// was told "Lodge ≥28 days out" and handed a calendar event saying "apply now" — advice that
// is not merely unhelpful but wrong for their position, on a page they paid for.
//
// The MECHANISM here is generic and every product inherits it. The MAP is per-product data.
// A product with no entry resolves to `defaultPresentation()`, which reproduces exactly the
// current unconditional behaviour — so adding this file changes nothing for the other 43
// products until someone writes their map.

import type { BuyerContext } from "./buyer-context";
import { formatIsoDate, addDaysIso, LODGE_LEAD_DAYS } from "./buyer-context";

export type StripTone = "green" | "amber" | "red" | "blue";

export interface TerminalStrip {
  tone: StripTone;
  /** Left-hand sentence. The buyer's actual next obligation, in their situation. */
  headline: string;
  /** Right-hand short chip. Empty string renders no chip. */
  badge: string;
}

/**
 * A calendar entry whose date is computed at render time.
 *   anchor "today"      — offsetDays from the day they bought
 *   anchor "settlement" — offsetDays from the buyer's real settlement date
 *   anchor "lodgeBy"    — settlement minus the corpus lead time, then offsetDays
 * Anything anchored to `settlement`/`lodgeBy` is DROPPED when no real date was captured,
 * rather than falling back to a fabricated one.
 */
export interface PackCalendarEvent {
  uid: string;
  summary: string;
  description: string;
  anchor: "today" | "settlement" | "lodgeBy";
  offsetDays: number;
  /** Chip shown in the on-page list when the event has no real date. */
  relativeLabel: string;
}

export interface TerminalPresentation {
  strip: TerminalStrip;
  calendar: PackCalendarEvent[];
  /** File slugs in display order. Filtered to the tier's files at render time. */
  spine: string[];
  /** Slug to badge START HERE. Falls back to the first available file in the spine. */
  startHere: string;
  /**
   * Extra flags handed to document templates for {{#if}} sections.
   *
   * TWO KINDS OF FLAG LIVE HERE, AND CONFLATING THEM CAUSED REAL DEFECTS (W1/W5):
   *
   *   `state:*`    — WHERE THE BUYER IS. Mutually exclusive facts about their sale:
   *                  state:pending (an application is lodged and outstanding),
   *                  state:settled (settlement has already happened),
   *                  state:have_cert (a certificate is in hand).
   *   `section:*`  — WHICH CONTENT to include. Several can be true at once.
   *   `suppress:*` — which content to REMOVE. Deliberately coarse.
   *
   * A document branching on a `suppress:` flag to decide WHAT TO SAY is the bug this
   * distinction exists to prevent. `suppress:apply_now` is true for pending, provided AND
   * settled buyers — correct as "do not print apply-now steps", useless as "they have
   * already lodged", because two of those three never lodged anything. Files 02 and 06 did
   * exactly that and told a buyer whose settlement had passed without a certificate to go
   * and check the status of an application they never made.
   *
   * Rule: to say something POSITIVE about the buyer's situation, branch on `state:*` (or a
   * specific `section:*`). Reserve `suppress:*` for omission.
   */
  docFlags: string[];
}

// ── the neutral default ───────────────────────────────────────────────────────────────
// Byte-equivalent to what an unmapped product renders today.
export function defaultPresentation(opts: {
  headline: string;
  badge?: string;
  fileSlugs: string[];
}): TerminalPresentation {
  return {
    strip: { tone: "amber", headline: opts.headline, badge: opts.badge ?? "" },
    calendar: [],
    spine: opts.fileSlugs,
    startHere: opts.fileSlugs[0] ?? "",
    docFlags: [],
  };
}

// ── FRCGW map (M) ─────────────────────────────────────────────────────────────────────
// Slugs: frcgw-01 exposure · 02 application process · 03 buyer instruction ·
//        04 details to have ready · 05 accountant brief ·
//        06 execution plan (t2) · 07 recovery (t2) · 08 variation (t2)

const APPLY_NOW: PackCalendarEvent = {
  uid: "frcgw-apply",
  summary: "FRCGW — apply for your ATO clearance certificate",
  description:
    "Most certificates issue within days; allow up to 28. Apply online at " +
    "ato.gov.au/clearancecertificate. It is free and valid for 12 months, and there is no " +
    "obligation to use it — so apply as soon as you are thinking of selling.",
  anchor: "today",
  offsetDays: 0,
  relativeLabel: "Today",
};

const CONFIRM_ARRIVAL: PackCalendarEvent = {
  uid: "frcgw-confirm",
  summary: "FRCGW — confirm the purchaser's side has your certificate",
  description:
    "Check the certificate has reached the purchaser or their conveyancer, and that the name " +
    "on it matches the name on the title exactly. Do not assume.",
  anchor: "settlement",
  offsetDays: -7,
  relativeLabel: "1 week before settlement",
};

const SETTLEMENT_DAY: PackCalendarEvent = {
  uid: "frcgw-settlement",
  summary: "FRCGW — settlement",
  description:
    "Your clearance certificate must be with the purchaser's side before settlement. Without " +
    "it the purchaser must withhold 15% of the price and remit it to the ATO.",
  anchor: "settlement",
  offsetDays: 0,
  relativeLabel: "Your settlement date",
};

const LODGE_BY: PackCalendarEvent = {
  uid: "frcgw-lodge-by",
  summary: "FRCGW — lodge by this date to be comfortably clear of settlement",
  description:
    `Allowing the full ${LODGE_LEAD_DAYS} days the ATO states as the outer processing time. ` +
    "Most certificates issue within days, so lodging by this date leaves margin, not a deadline.",
  anchor: "lodgeBy",
  offsetDays: 0,
  relativeLabel: `${LODGE_LEAD_DAYS} days before settlement`,
};

const MONITOR_PENDING: PackCalendarEvent = {
  uid: "frcgw-monitor",
  summary: "FRCGW — check your pending clearance certificate application",
  description:
    "Check the status of the application you have already lodged. Most issue within days. If " +
    "it is still pending close to settlement, tell the purchaser's conveyancer in writing.",
  anchor: "today",
  offsetDays: 1,
  relativeLabel: "Daily until it issues",
};

const NOTIFY_PENDING: PackCalendarEvent = {
  uid: "frcgw-notify-pending",
  summary: "FRCGW — put the purchaser's conveyancer on notice that the certificate is pending",
  description:
    "Send the pending-notice template (File 03) so the purchaser's side knows a certificate is " +
    "coming and does not default to withholding without asking.",
  anchor: "today",
  offsetDays: 0,
  relativeLabel: "Today",
};

const VERIFY_NAME: PackCalendarEvent = {
  uid: "frcgw-verify-name",
  summary: "FRCGW — verify the certificate name matches the title exactly",
  description:
    "A certificate in a different form of your name (middle name, maiden name, trustee " +
    "capacity) can be rejected at settlement. Check it against the title now, not on the day.",
  anchor: "today",
  offsetDays: 0,
  relativeLabel: "Today",
};

const LODGE_RETURN: PackCalendarEvent = {
  uid: "frcgw-lodge-return",
  summary: "FRCGW — lodge the tax return for the year the CONTRACT was signed",
  description:
    "The withheld 15% was remitted to the ATO and is credited to you. You claim it by lodging " +
    "the return for the income year the contract was signed — not the year of settlement.",
  anchor: "today",
  offsetDays: 0,
  relativeLabel: "At the next return",
};

const T1 = ["frcgw-01", "frcgw-02", "frcgw-03", "frcgw-04", "frcgw-05"];
const ALL = [...T1, "frcgw-06", "frcgw-07", "frcgw-08"];

/** Order `preferred` first, then everything else in canonical order. */
function spineOf(preferred: string[]): string[] {
  return [...preferred, ...ALL.filter((s) => !preferred.includes(s))];
}

const FRCGW: Record<string, TerminalPresentation> = {
  // ── 1 · explainer ──
  "what-is-clearance-certificate": {
    strip: {
      tone: "amber",
      headline: "Apply early — the certificate is free, valid 12 months, and you are not obliged to use it",
      badge: "Apply when you list",
    },
    calendar: [APPLY_NOW, LODGE_BY, CONFIRM_ARRIVAL, SETTLEMENT_DAY],
    spine: spineOf(["frcgw-02", "frcgw-01", "frcgw-04", "frcgw-03", "frcgw-05"]),
    startHere: "frcgw-02",
    docFlags: ["section:explainer"],
  },

  // ── 2 · timing ──
  "when-to-apply-timeline": {
    strip: {
      tone: "amber",
      headline: "Apply now — most certificates issue within days, and yours stays valid for 12 months",
      badge: "Allow up to 28 days",
    },
    calendar: [APPLY_NOW, LODGE_BY, CONFIRM_ARRIVAL, SETTLEMENT_DAY],
    spine: spineOf(["frcgw-02", "frcgw-01", "frcgw-04", "frcgw-03", "frcgw-05"]),
    startHere: "frcgw-02",
    docFlags: ["section:timeline", "section:validity_12_months"],
  },

  // ── 3 · pending (+ residency variants) · ZERO apply-now copy ──
  "certificate-pending-resident": {
    strip: {
      tone: "amber",
      headline: "Your application is in — now make sure it reaches the purchaser before settlement",
      badge: "Confirm arrival",
    },
    calendar: [MONITOR_PENDING, NOTIFY_PENDING, CONFIRM_ARRIVAL, SETTLEMENT_DAY],
    spine: spineOf(["frcgw-03", "frcgw-01", "frcgw-05", "frcgw-02", "frcgw-04"]),
    startHere: "frcgw-03",
    docFlags: ["state:pending", "section:pending_monitoring", "section:pending_notice", "suppress:apply_now"],
  },
  "certificate-pending-non-resident": {
    strip: {
      tone: "amber",
      headline: "A pending clearance certificate will not help if you are a foreign resident — you need a variation notice",
      badge: "Variation, not clearance",
    },
    calendar: [MONITOR_PENDING, NOTIFY_PENDING, CONFIRM_ARRIVAL, SETTLEMENT_DAY],
    spine: spineOf(["frcgw-08", "frcgw-03", "frcgw-01", "frcgw-05", "frcgw-02"]),
    startHere: "frcgw-08",
    docFlags: ["state:pending", "section:pending_monitoring", "section:pending_notice", "section:variation", "suppress:apply_now"],
  },
  "certificate-pending-unsure-residency": {
    strip: {
      tone: "amber",
      headline: "Settle your residency question first — it decides whether your pending application is even the right one",
      badge: "Residency first",
    },
    calendar: [MONITOR_PENDING, NOTIFY_PENDING, CONFIRM_ARRIVAL, SETTLEMENT_DAY],
    spine: spineOf(["frcgw-04", "frcgw-03", "frcgw-01", "frcgw-05", "frcgw-02"]),
    startHere: "frcgw-04",
    docFlags: ["state:pending", "section:pending_monitoring", "section:pending_notice", "section:residency_first", "suppress:apply_now"],
  },

  // ── 4 · provided · GREEN ──
  "certificate-provided-no-withholding": {
    strip: {
      tone: "green",
      headline: "No withholding is due — check the name on the certificate matches the name on the title",
      badge: "Verify the name",
    },
    calendar: [VERIFY_NAME, CONFIRM_ARRIVAL, SETTLEMENT_DAY],
    spine: spineOf(["frcgw-03", "frcgw-01", "frcgw-05", "frcgw-04", "frcgw-02"]),
    startHere: "frcgw-03",
    docFlags: ["state:settled", "state:have_cert", "section:name_match", "section:keep_a_copy", "suppress:apply_now", "suppress:28_day"],
  },

  // ── 5 · no certificate (+ residency variants) · RED · no 28-day copy ──
  "no-certificate-resident": {
    strip: {
      tone: "red",
      headline: "Lodge the return for the year the contract was signed — the withheld 15% is credited back to you",
      badge: "Recover it at lodgement",
    },
    calendar: [LODGE_RETURN],
    spine: spineOf(["frcgw-07", "frcgw-01", "frcgw-05"]),
    startHere: "frcgw-07",
    docFlags: ["state:settled", "section:recovery", "suppress:apply_now", "suppress:28_day"],
  },
  "no-certificate-non-resident": {
    strip: {
      tone: "red",
      headline: "As a foreign resident the withheld amount is credited against your actual CGT — lodge the return for the contract year",
      badge: "Credited, not lost",
    },
    calendar: [LODGE_RETURN],
    spine: spineOf(["frcgw-07", "frcgw-08", "frcgw-01", "frcgw-05"]),
    startHere: "frcgw-07",
    docFlags: ["state:settled", "section:recovery", "section:variation", "suppress:apply_now", "suppress:28_day"],
  },
  "no-certificate-unsure-residency": {
    strip: {
      tone: "red",
      headline: "Your residency decides how much of the withheld 15% comes back — settle that, then lodge the contract-year return",
      badge: "Residency first",
    },
    calendar: [LODGE_RETURN],
    spine: spineOf(["frcgw-07", "frcgw-04", "frcgw-01", "frcgw-05"]),
    startHere: "frcgw-07",
    docFlags: ["state:settled", "section:recovery", "section:residency_first", "suppress:apply_now", "suppress:28_day"],
  },

  // ── 6 · co-owners ──
  "co-owners-separate-certificates": {
    strip: {
      tone: "amber",
      headline: "Every owner on the title needs their own certificate — one missing certificate withholds on that owner's share",
      badge: "One each",
    },
    calendar: [APPLY_NOW, LODGE_BY, CONFIRM_ARRIVAL, SETTLEMENT_DAY],
    spine: spineOf(["frcgw-01", "frcgw-02", "frcgw-04", "frcgw-03", "frcgw-05"]),
    startHere: "frcgw-01",
    docFlags: ["section:per_vendor", "section:validity_12_months"],
  },

  // ── 7 · long contract / expiry ──
  "certificate-expired-long-contract": {
    strip: {
      tone: "amber",
      headline: "A certificate lasts 12 months — on a longer contract, time your application to still be valid at settlement",
      badge: "Valid 12 months",
    },
    calendar: [LODGE_BY, CONFIRM_ARRIVAL, SETTLEMENT_DAY],
    spine: spineOf(["frcgw-02", "frcgw-01", "frcgw-04", "frcgw-03", "frcgw-05"]),
    startHere: "frcgw-02",
    docFlags: ["section:validity_12_months", "section:reapplication"],
  },

  // ── 8 · residency unknown ──
  "unsure-tax-residency-status": {
    strip: {
      tone: "amber",
      headline: "Your tax residency decides which form you need — settle that before you apply",
      badge: "Residency first",
    },
    calendar: [APPLY_NOW, LODGE_BY, CONFIRM_ARRIVAL, SETTLEMENT_DAY],
    spine: spineOf(["frcgw-04", "frcgw-02", "frcgw-01", "frcgw-03", "frcgw-05"]),
    startHere: "frcgw-04",
    docFlags: ["section:residency_first"],
  },

  // ── E2 · foreign resident, variation-led ──
  "foreign-resident-variation-required": {
    strip: {
      tone: "amber",
      headline: "A clearance certificate is not available to foreign residents — apply for a variation notice instead",
      badge: "Variation notice",
    },
    calendar: [
      {
        ...APPLY_NOW,
        uid: "frcgw-apply-variation",
        summary: "FRCGW — apply for a variation notice",
        description:
          "Foreign residents cannot get a clearance certificate. Apply for a variation notice, " +
          "which can reduce the withholding rate to anywhere between 0% and 14.99% where you have " +
          "real grounds. Apply as soon as the contract is signed.",
      },
      LODGE_BY,
      CONFIRM_ARRIVAL,
      SETTLEMENT_DAY,
    ],
    spine: spineOf(["frcgw-08", "frcgw-04", "frcgw-02", "frcgw-01", "frcgw-03", "frcgw-05"]),
    startHere: "frcgw-08",
    docFlags: ["section:variation", "suppress:clearance_eligible"],
  },

  // ── 9/10 · escapes — unchanged ──
  none_fit: {
    strip: {
      tone: "blue",
      headline: "On your answers, foreign resident capital gains withholding may not apply to you",
      badge: "",
    },
    calendar: [],
    spine: spineOf(["frcgw-02", "frcgw-01"]),
    startHere: "frcgw-02",
    docFlags: ["section:explainer"],
  },
  insufficient_information: {
    strip: {
      tone: "amber",
      headline: "One detail is still open — this pack covers both ways it can go",
      badge: "",
    },
    calendar: [APPLY_NOW],
    spine: spineOf(["frcgw-02", "frcgw-01", "frcgw-04", "frcgw-03", "frcgw-05"]),
    startHere: "frcgw-02",
    docFlags: ["section:explainer"],
  },
};

export const TERMINAL_PRESENTATION: Record<string, Record<string, TerminalPresentation>> = {
  "frcgw-clearance-certificate": FRCGW,
};

/**
 * The presentation for a terminal. Unmapped product OR unmapped terminal → the neutral
 * default built from the caller's own copy, i.e. exactly today's behaviour.
 */
export function getTerminalPresentation(
  productId: string,
  terminalId: string | null | undefined,
  fallback: { headline: string; badge?: string; fileSlugs: string[] },
): TerminalPresentation {
  const product = TERMINAL_PRESENTATION[productId];
  const hit = terminalId ? product?.[terminalId] : undefined;
  return hit ?? defaultPresentation(fallback);
}

// ── rendering helpers ─────────────────────────────────────────────────────────────────

export interface ResolvedCalendarEvent {
  uid: string;
  summary: string;
  description: string;
  /** YYYY-MM-DD when a real date could be computed; null when only relative. */
  isoDate: string | null;
  /** What to show in the chip — a real date if we have one, else the relative phrase. */
  chip: string;
}

function todayIso(now?: Date): string {
  const d = now ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Turn the map's anchored events into dated ones.
 *
 * NO SETTLEMENT DATE ⇒ every settlement/lodgeBy-anchored event is DROPPED, not defaulted.
 * That is the whole reason the old tier-2 calendar shipped an event literally titled
 * "SET TO YOUR ACTUAL SETTLEMENT DATE" 28 days out: it had nothing to anchor to and
 * invented an anchor anyway.
 */
export function resolveCalendar(
  events: PackCalendarEvent[],
  ctx: BuyerContext,
  now?: Date,
): ResolvedCalendarEvent[] {
  const settlementIso = ctx.values.settlement_date_iso ?? null;
  const out: ResolvedCalendarEvent[] = [];

  for (const e of events) {
    if (e.anchor === "today") {
      const iso = addDaysIso(todayIso(now), e.offsetDays);
      out.push({
        uid: e.uid,
        summary: e.summary,
        description: e.description,
        isoDate: iso,
        chip: e.relativeLabel,
      });
      continue;
    }

    if (!settlementIso) continue; // nothing real to anchor to → omit entirely

    const base = e.anchor === "lodgeBy" ? addDaysIso(settlementIso, -LODGE_LEAD_DAYS) : settlementIso;
    if (!base) continue;
    const iso = addDaysIso(base, e.offsetDays);
    if (!iso) continue;
    out.push({
      uid: e.uid,
      summary: e.summary,
      description: e.description,
      isoDate: iso,
      chip: formatIsoDate(iso),
    });
  }

  return out;
}

/** The spine filtered to the files this tier actually bought, START HERE resolved. */
export function resolveSpine(
  presentation: TerminalPresentation,
  availableSlugs: string[],
): { order: string[]; startHere: string } {
  const available = new Set(availableSlugs);
  const order = presentation.spine.filter((s) => available.has(s));
  for (const s of availableSlugs) if (!order.includes(s)) order.push(s);
  const startHere = available.has(presentation.startHere) ? presentation.startHere : order[0] ?? "";
  return { order, startHere };
}
