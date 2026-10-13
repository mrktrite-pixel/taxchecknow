// ONE-OFF (local, uncommitted) — backfill the 6 shorts into content_performance
// so the soverella /dashboard/analytics YouTube tab lights up. Sources the
// already-verified shorts_videos + latest shorts_performance snapshot. Idempotent
// on youtube_video_id. The durable bridge + metrics refresh come next.
//   node scripts/backfill-shorts-to-content-performance.mjs [--dry-run]
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
const DRY = process.argv.includes("--dry-run");
const dir = path.dirname(fileURLToPath(import.meta.url));
for (const l of fs.readFileSync(path.join(dir, "../.env.local"), "utf8").split("\n")) { const t = l.trim(); if (!t || t.startsWith("#")) continue; const i = t.indexOf("="); if (i < 0) continue; const k = t.slice(0, i).trim(); if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, ""); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: vids, error: vErr } = await sb.from("shorts_videos").select("video_id, product_slug, country, published_at, title").eq("status", "live");
  if (vErr) throw new Error(vErr.message);
  const { data: perf } = await sb.from("shorts_performance").select("video_id, snapshot_date, views, watch_time_hrs, impressions, impressions_ctr, subs_gained").order("snapshot_date", { ascending: false });
  const latest = new Map();
  for (const p of perf ?? []) if (!latest.has(p.video_id)) latest.set(p.video_id, p); // first = newest (desc order)

  const rows = [];
  for (const v of vids) {
    const p = latest.get(v.video_id) ?? {};
    rows.push({
      site: "taxchecknow",
      platform: "youtube",
      youtube_video_id: v.video_id,
      url: `https://www.youtube.com/watch?v=${v.video_id}`, // url is NOT-NULL (not in the spec) — watch URL is the natural value
      slug: v.product_slug,
      country: v.country,
      product_key: null,
      published_at: v.published_at ?? null,
      status: "published",
      views_30d: p.views ?? null,
      views_7d: null,
      watch_time_minutes: p.watch_time_hrs != null ? Math.round(p.watch_time_hrs * 60) : null,
      ctr: p.impressions_ctr != null ? p.impressions_ctr / 100 : null, // FRACTION (tab does ×100)
      impressions: p.impressions ?? null,
      subscribers_gained: p.subs_gained ?? null,
      likes: null, comments: null, shares: null,
      content_version: 1,
      format_type: "short",
      description: v.title ?? null,
    });
  }

  for (const r of rows) {
    if (DRY) { console.log("[dry]", JSON.stringify(r)); continue; }
    const { data: ex } = await sb.from("content_performance").select("id").eq("platform", "youtube").eq("youtube_video_id", r.youtube_video_id).maybeSingle();
    const res = ex ? await sb.from("content_performance").update(r).eq("id", ex.id) : await sb.from("content_performance").insert(r);
    console.log(res.error ? `ERR ${r.youtube_video_id}: ${res.error.message}` : `${ex ? "updated" : "inserted"} ${r.slug} (${r.youtube_video_id}) views_30d=${r.views_30d} pub=${r.published_at ?? "null"}`);
  }
  console.log(`\n${rows.length} rows ${DRY ? "(dry)" : "written"}.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
