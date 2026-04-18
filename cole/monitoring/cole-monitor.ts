// ─────────────────────────────────────────────────────────────────────────────
// COLE — Monitoring Module
// Status: PLACEHOLDER — not yet built
// Receives webhooks from changedetection.io
// Maps changed URLs to affected products
// Logs to Supabase rule_changes table
// Sends alert via Resend
// ─────────────────────────────────────────────────────────────────────────────

// TODO: build this module
// The webhook receiver lives at:
// app/api/cole/monitor/route.ts

export function getAffectedProducts(url: string): string[] {
  // TODO: map GOV.UK URL to affected product IDs
  throw new Error("Monitor not yet built");
}
