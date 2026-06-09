// COLE shorts CSV ingest (manual MVP) — YouTube Studio "Table data.csv".
// Maps the export columns to a shorts_performance snapshot, backfills
// shorts_videos (duration_s, title), and upserts on (video_id, snapshot_date).
//
//   node scripts/cole-shorts-ingest.mjs "<path/to/Table data.csv>" [--dry-run]
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from ../.env.local).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const csvPath = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!csvPath) { console.error('usage: cole-shorts-ingest.mjs "<Table data.csv>" [--dry-run]'); process.exit(1); }

// Locked mapping from the real export.
const COL = {
  video_id:        "Content",
  views:           "Views",
  watch_time_hrs:  "Watch time (hours)",
  impressions:     "Impressions",
  impressions_ctr: "Impressions click-through rate (%)",
  subs_gained:     "Subscribers",
  duration_s:      "Duration",                 // SECONDS — backfilled + used for retention
  title:           "Video title",
};
// Known new videos the export revealed but that aren't registered yet.
const REGISTER = [
  { video_id: "klS6M_tW9-Y", product_slug: "183-day-rule", country: "nomad", utm_content: "183-day-rule-yt1", variant_n: 1, status: "live" },
];

const dir = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(dir, "../.env.local"), "utf8").split("\n")) {
  const t = line.trim(); if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("="); if (i < 0) continue;
  const k = t.slice(0, i).trim(); if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}
const sb = DRY ? null : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// RFC-4180-ish CSV parse: handles quoted fields with commas + escaped quotes + BOM.
function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const rows = []; let field = "", row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = (rows[0] ?? []).map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, (r[idx] ?? "").trim()])));
}
const toInt = (s) => { if (s == null || s === "") return null; const n = parseInt(String(s).replace(/[, ]/g, ""), 10); return Number.isFinite(n) ? n : null; };
const toNum = (s) => { if (s == null || s === "") return null; const n = parseFloat(String(s).replace(/[, ]/g, "")); return Number.isFinite(n) ? n : null; };
const round = (n, d = 2) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  // 1 — register known-new videos (idempotent)
  for (const v of REGISTER) {
    if (DRY) { console.log(`[dry] would ensure shorts_videos ${v.video_id} (${v.product_slug})`); continue; }
    const { data: ex } = await sb.from("shorts_videos").select("video_id").eq("video_id", v.video_id).maybeSingle();
    if (!ex) { const { error } = await sb.from("shorts_videos").insert(v); console.log(error ? `register ${v.video_id} ERR ${error.message}` : `registered ${v.video_id} (${v.product_slug})`); }
    else console.log(`already registered ${v.video_id}`);
  }

  // 2 — parse + ingest
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  let ingested = 0, skipped = 0, unmatched = 0;
  for (const r of rows) {
    const video_id = (r[COL.video_id] ?? "").trim();
    if (!video_id || video_id.toLowerCase() === "total") { skipped++; continue; }

    const views = toInt(r[COL.views]);
    const watch_time_hrs = toNum(r[COL.watch_time_hrs]);
    const duration_s = toNum(r[COL.duration_s]);
    const title = (r[COL.title] ?? "") || null;
    const avg_view_dur_s = views && views > 0 && watch_time_hrs != null ? (watch_time_hrs * 3600) / views : null;
    const avg_view_pct = duration_s && duration_s > 0 && avg_view_dur_s != null ? (avg_view_dur_s / duration_s) * 100 : null;

    const perf = {
      video_id, snapshot_date: today, source: "csv_manual",
      views, watch_time_hrs,
      impressions: toInt(r[COL.impressions]),
      impressions_ctr: toNum(r[COL.impressions_ctr]),   // 0-100 as-is
      subs_gained: toInt(r[COL.subs_gained]),             // blank → null
      avg_view_dur_s: round(avg_view_dur_s, 2),
      avg_view_pct: round(avg_view_pct, 2),
      likes: null, comments: null, shares: null,
    };

    if (DRY) { console.log(`[dry] ${video_id} dur=${duration_s}s ret=${perf.avg_view_pct}% ctr=${perf.impressions_ctr}% views=${views} -> backfill title="${title}"`); ingested++; continue; }

    const { data: vid } = await sb.from("shorts_videos").select("video_id").eq("video_id", video_id).maybeSingle();
    if (!vid) { console.log(`UNMATCHED video_id ${video_id} — skipped (register it first)`); unmatched++; continue; }

    await sb.from("shorts_videos").update({ duration_s: duration_s ?? null, title }).eq("video_id", video_id);

    const { data: existing } = await sb.from("shorts_performance").select("id").eq("video_id", video_id).eq("snapshot_date", today).maybeSingle();
    const res = existing
      ? await sb.from("shorts_performance").update(perf).eq("id", existing.id)
      : await sb.from("shorts_performance").insert(perf);
    if (res.error) { console.log(`${video_id} upsert ERR ${res.error.message}`); continue; }
    console.log(`${existing ? "updated" : "inserted"} ${video_id}  ret=${perf.avg_view_pct}% ctr=${perf.impressions_ctr}% views=${views}`);
    ingested++;
  }
  console.log(`\nDONE — ${ingested} ingested, ${skipped} skipped (Total/blank), ${unmatched} unmatched. snapshot_date=${today} source=csv_manual${DRY ? " [DRY-RUN, no writes]" : ""}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
