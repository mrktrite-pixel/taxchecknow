// lib/uk-countdown.ts
// Server-side UK MTD countdown — runs on every request
// AI crawlers always see the correct number. Never hardcoded.

// UK MTD first quarterly deadline: 7 August 2026
const MTD_DEADLINE = new Date("2026-08-07T00:00:00.000+01:00"); // BST

// MTD went live April 6, 2026
const MTD_START = new Date("2026-04-06T00:00:00.000+01:00");

export function getMTDCountdown() {
  const now = new Date();
  const msRemaining = MTD_DEADLINE.getTime() - now.getTime();
  const days = Math.max(0, Math.floor(msRemaining / 86_400_000));
  const windowTotal = MTD_DEADLINE.getTime() - MTD_START.getTime();
  const elapsed = now.getTime() - MTD_START.getTime();
  const pct = Math.min(100, Math.max(0, Math.round((elapsed / windowTotal) * 100)));
  const isExpired = days === 0;
  const urgency = days <= 14 ? "critical" : days <= 30 ? "high" : days <= 60 ? "medium" : "low";

  return { days, pct, isExpired, urgency, deadline: "7 August 2026" };
}
