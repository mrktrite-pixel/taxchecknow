// Probe — count rows in gap_queue and confirm MOS tables exist.
import * as fs   from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb  = createClient(url, key) as any;

const tables = [
  "gap_queue", "research_questions", "psychology_insights",
  "competitors", "agent_log", "content_jobs", "content_performance",
  "hook_matrix", "chaos_angles", "campaign_calendar",
  "li_research", "yt_research", "ig_research", "x_research", "tt_research",
  "li_queue", "yt_queue", "ig_queue", "x_queue",
];

async function main() {
  console.log(`Supabase URL: ${url.replace(/https:\/\/([^.]+)\..*/, "https://$1.supabase.co")}`);
  console.log(`---`);
  for (const t of tables) {
    const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`${t.padEnd(22)} ERROR: ${error.message}`);
    } else {
      console.log(`${t.padEnd(22)} ${count ?? 0} rows`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
