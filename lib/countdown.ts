// lib/countdown.ts
// Server-side countdown calculation — runs on every request
// AI crawlers always see the correct number. Never hardcoded.

const VALUATION_DATE = new Date("2026-06-30T00:00:00.000+10:00"); // AEST
const WINDOW_OPEN = new Date("2026-03-10T00:00:00.000+10:00");    // Enactment date

export function getCountdownData() {
  const now = new Date();
  const msRemaining = VALUATION_DATE.getTime() - now.getTime();
  const days = Math.max(0, Math.floor(msRemaining / 86_400_000));
  const windowTotal = VALUATION_DATE.getTime() - WINDOW_OPEN.getTime();
  const elapsed = now.getTime() - WINDOW_OPEN.getTime();
  const pct = Math.min(100, Math.max(0, Math.round((elapsed / windowTotal) * 100)));
  const isExpired = days === 0;

  return { days, pct, isExpired };
}
