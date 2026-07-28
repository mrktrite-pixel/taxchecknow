// ── CRON STALENESS (TEMPORAL v1 · Step 4.8) ──────────────────────────────
// "Is this cron still running?" — answered from the schedule itself.
//
// WHY THIS EXISTS
// Step 4.7 recorded every run in email_cron_runs and returned an `ageMinutes`
// per route, but nothing ever COMPARED that age to anything: ok was
// `health.alerts.length === 0 && errors.length === 0`, and neither input could
// be produced by run age. A cron that had been dead for a week — or had never
// run at all — still reported ok:true. Worse, the 4.6 alerts are dispatched
// from INSIDE send-emails, so a dead send-emails silences its own alarm.
//
// This module supplies the missing comparison. It is pure-ish: one SELECT per
// route against email_cron_runs, no writes, and it needs NO new columns —
// email_cron_runs.route + started_at already carry everything required.

/* eslint-disable @typescript-eslint/no-explicit-any */

import vercelConfig from "@/vercel.json";
import type { Sb } from "@/lib/email-observability";

// ── THE SCHEDULE IS THE SOURCE OF TRUTH ──────────────────────────────────
// Imported from vercel.json — the SAME file Vercel reads to decide when to
// fire. Per the 4.8a requirement, the expected interval is DERIVED from that
// expression, never hardcoded here. Change "0 9 * * *" to "0 */6 * * *" and the
// staleness bound follows automatically on the next deploy; there is no second
// place to remember to update, so cadence and check cannot silently diverge.
interface VercelCron { path: string; schedule: string }
const CRONS: VercelCron[] = ((vercelConfig as { crons?: VercelCron[] }).crons ?? []);

export function scheduleForRoute(route: string): string | null {
  return CRONS.find(c => c.path === route)?.schedule ?? null;
}

export function scheduledRoutes(): string[] {
  return CRONS.map(c => c.path);
}

// ── CRON EXPRESSION → EXPECTED INTERVAL ──────────────────────────────────
// Deliberately NOT a general cron parser. It handles the shapes this project
// plausibly uses and returns null for anything else — and null is LOUD (see
// `schedule_unparsed` below), never a silent pass. An unparseable schedule is
// exactly the case where we must not claim to know the cron is healthy.
//
// Returns the LONGEST expected wait between consecutive firings, in minutes,
// because that is the number a staleness bound must be built on. For an hour
// list like "0 8,9 * * *" the longest gap is 23h (09:00 → 08:00 next day), not
// the 1h gap — using the short gap would alert every single day.
export function deriveIntervalMinutes(expr: string): number | null {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) return null;
  const [minF, hourF, domF, monF, dowF] = f;

  // Any day-of-month / month / day-of-week restriction changes the cadence in
  // ways this function does not model (e.g. "last weekday of the month").
  // Refuse rather than guess.
  if (domF !== "*" || monF !== "*" || dowF !== "*") return null;

  // "*/N * * * *" — every N minutes.
  if (/^\*\/\d+$/.test(minF) && hourF === "*") {
    const n = Number(minF.slice(2));
    return n > 0 && n <= 59 ? n : null;
  }
  // Minute must be a single fixed value from here on.
  if (!/^\d{1,2}$/.test(minF)) return null;
  const minute = Number(minF);
  if (minute > 59) return null;

  // "M * * * *" — hourly.
  if (hourF === "*") return 60;

  // "M */N * * *" — every N hours.
  if (/^\*\/\d+$/.test(hourF)) {
    const n = Number(hourF.slice(2));
    return n > 0 && n <= 23 ? n * 60 : null;
  }

  // "M H * * *" or "M H1,H2,… * * *" — fixed hour(s) each day.
  if (/^\d{1,2}(,\d{1,2})*$/.test(hourF)) {
    const hours = [...new Set(hourF.split(",").map(Number))].sort((a, b) => a - b);
    if (hours.some(h => h > 23)) return null;
    if (hours.length === 1) return 1440;
    // Longest gap between consecutive firings, wrapping midnight.
    let longest = 0;
    for (let i = 0; i < hours.length; i++) {
      const next = hours[(i + 1) % hours.length];
      const gap  = i === hours.length - 1 ? (24 - hours[i] + next) : (next - hours[i]);
      if (gap > longest) longest = gap;
    }
    return longest * 60;
  }

  return null;
}

// ── GRACE MARGIN ─────────────────────────────────────────────────────────
// Vercel does not guarantee a cron fires at the exact scheduled instant — a
// scheduled run can be delayed. So the bound must be interval + slack, or a
// healthy-but-late run would alert.
//
// grace = 25% of the interval, clamped to [15 min, 120 min].
//   · daily  (1440) → 360 clamped to 120 → threshold 26h. One missed daily run
//     surfaces ~2h after its slot; an ordinary delay never does.
//   · hourly (60)   → 15               → threshold 75 min.
//   · every 5 min   → 15 (floor)       → threshold 20 min, so a single skipped
//     firing on a fast cadence does not flap.
// The floor exists because a percentage of a short interval is smaller than
// Vercel's own scheduling jitter; the ceiling exists so a slow cadence cannot
// push detection out by days.
export function graceMinutes(intervalMinutes: number): number {
  return Math.min(Math.max(Math.round(intervalMinutes * 0.25), 15), 120);
}

export type CronState =
  | "current"            // ran within interval + grace
  | "stale"              // has run before, but not recently enough
  | "never_ran"          // no email_cron_runs row at all — see 4.8b
  | "schedule_unparsed"  // in vercel.json but the expression is not modelled
  | "not_scheduled"      // asked about a route vercel.json does not schedule
  | "unknown";           // the lookup itself failed

export interface CronStaleness {
  route:                   string;
  schedule:                string | null;
  expectedIntervalMinutes: number | null;
  graceMinutes:            number | null;
  thresholdMinutes:        number | null;
  lastRunAt:               string | null;
  lastRunId:               string | null;
  lastRunOk:               boolean | null;
  ageMinutes:              number | null;
  state:                   CronState;
  alert:                   string | null;   // null = nothing to say
}

// ── THE CHECK ────────────────────────────────────────────────────────────
export async function collectCronStaleness(
  sb: Sb,
  routes?: string[],
  nowMs: number = Date.now(),
): Promise<CronStaleness[]> {
  const targets = routes && routes.length > 0 ? routes : scheduledRoutes();
  const out: CronStaleness[] = [];

  for (const route of targets) {
    const schedule = scheduleForRoute(route);

    const base: CronStaleness = {
      route, schedule,
      expectedIntervalMinutes: null, graceMinutes: null, thresholdMinutes: null,
      lastRunAt: null, lastRunId: null, lastRunOk: null, ageMinutes: null,
      state: "unknown", alert: null,
    };

    if (!schedule) {
      // A route we are asked to watch but that vercel.json does not schedule.
      // Silent-drift class: someone removed the cron entry and the watcher would
      // otherwise just stop watching. Say so.
      out.push({ ...base, state: "not_scheduled",
        alert: `cron_not_scheduled:${route} — no entry in vercel.json; nothing will ever run it` });
      continue;
    }

    const interval = deriveIntervalMinutes(schedule);
    if (interval === null) {
      out.push({ ...base, state: "schedule_unparsed",
        alert: `cron_schedule_unparsed:${route}:"${schedule}" — staleness cannot be evaluated; this check is BLIND for this route` });
      continue;
    }
    const grace     = graceMinutes(interval);
    const threshold = interval + grace;

    let row: Record<string, unknown> | undefined;
    try {
      const { data, error } = await sb
        .from("email_cron_runs")
        .select("run_id, started_at, ok")
        .eq("route", route)
        .order("started_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      row = ((data ?? []) as Record<string, unknown>[])[0];
    } catch (err) {
      out.push({
        ...base, expectedIntervalMinutes: interval, graceMinutes: grace, thresholdMinutes: threshold,
        state: "unknown",
        alert: `cron_staleness_check_failed:${route} — ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    // ── 4.8b — NULL IS NOT HEALTHY ────────────────────────────────────────
    // No row means email_cron_runs has never recorded this route. Nothing
    // inside the data can distinguish "deployed 5 minutes ago, first run not
    // due yet" from "this cron has been dead since it shipped" — both are an
    // empty table. Absence of evidence is not evidence of health, so the safe
    // reading is UNPROVEN, and unproven is not ok.
    //
    // Cost of this choice: a bounded alert window after any deploy that first
    // introduces a cron, lasting until its first run. That is a FEATURE — it
    // forces positive confirmation that a newly-shipped cron actually fires,
    // which is exactly the confirmation Step 4 lacked. It self-clears on the
    // first recorded run and can never recur for that route.
    // (Both current routes already have rows, so this does not fire today.)
    if (!row) {
      out.push({
        ...base, expectedIntervalMinutes: interval, graceMinutes: grace, thresholdMinutes: threshold,
        state: "never_ran",
        alert: `cron_never_ran:${route} — no run ever recorded; unproven, not healthy`,
      });
      continue;
    }

    const startedAt  = String(row.started_at);
    const ageMinutes = Math.round((nowMs - Date.parse(startedAt)) / 60_000);
    const stale      = ageMinutes > threshold;

    out.push({
      route, schedule,
      expectedIntervalMinutes: interval, graceMinutes: grace, thresholdMinutes: threshold,
      lastRunAt: startedAt,
      lastRunId: (row.run_id as string) ?? null,
      lastRunOk: typeof row.ok === "boolean" ? row.ok : null,
      ageMinutes,
      state: stale ? "stale" : "current",
      alert: stale
        ? `cron_stale:${route}:${ageMinutes} — last run ${startedAt}, ` +
          `${ageMinutes}m ago, exceeds ${threshold}m (schedule "${schedule}" = ${interval}m + ${grace}m grace)`
        : null,
    });
  }

  return out;
}

export function cronStalenessAlerts(rows: CronStaleness[]): string[] {
  return rows.map(r => r.alert).filter((a): a is string => Boolean(a));
}

// ── 4.8c — MUTUAL WATCH ──────────────────────────────────────────────────
// Which routes should cron X evaluate? Every scheduled route EXCEPT itself.
//
// A cron checking its OWN staleness is worthless: it only runs when it runs, so
// at the moment of the check its own age is ~0 and it can never observe itself
// dead. The alarm has to live outside the thing it watches. With two daily
// crons an hour apart, each watching the other, either one dying is reported by
// the survivor within a day — without adding any new scheduled job.
export function peerRoutes(selfRoute: string): string[] {
  return scheduledRoutes().filter(r => r !== selfRoute);
}
