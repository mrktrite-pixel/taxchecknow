// Competitor Monitor writer.
// Reads JSON array from stdin, validates, inserts into competitors,
// writes one agent_log row, prints summary JSON.
//
// Usage:
//   echo '[{"name":"...","url":"https://...","country":"AU","weakness":"...","our_advantage":"..."}]' \
//     | npx ts-node --project cole/tsconfig.json scripts/cole-insert-competitors.ts
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import * as fs   from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
) as any;

type Competitor = {
  name: string;
  url: string;
  country: "AU" | "UK" | "US" | "NZ" | "CAN" | "Nomad";
  weakness: string;
  our_advantage: string;
};

const REQUIRED: (keyof Competitor)[] = ["name", "url", "country", "weakness", "our_advantage"];
const COUNTRIES = new Set(["AU", "UK", "US", "NZ", "CAN", "Nomad"]);

function validate(c: any, idx: number): string | null {
  for (const k of REQUIRED) {
    if (c[k] === undefined || c[k] === null || c[k] === "") {
      return `competitor[${idx}] missing required field: ${String(k)}`;
    }
  }
  if (!COUNTRIES.has(c.country)) {
    return `competitor[${idx}] country must be AU|UK|US|NZ|CAN|Nomad (got: ${c.country})`;
  }
  if (!/^https?:\/\//.test(c.url)) {
    return `competitor[${idx}] url must start with http(s):// (got: ${c.url})`;
  }
  if (c.weakness.length < 10 || c.our_advantage.length < 10) {
    return `competitor[${idx}] weakness/our_advantage too short (must be a real sentence)`;
  }
  return null;
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (buf += c));
    process.stdin.on("end", () => resolve(buf));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) { console.error("ERROR: no JSON received on stdin"); process.exit(2); }

  let comps: any[];
  try {
    const clean = raw.replace(/^﻿/, "").trim();
    comps = JSON.parse(clean);
  } catch (e: any) {
    console.error(`ERROR: stdin is not valid JSON: ${e.message}`);
    process.exit(2);
  }
  if (!Array.isArray(comps)) {
    console.error("ERROR: stdin must be a JSON array of competitor objects");
    process.exit(2);
  }
  for (let i = 0; i < comps.length; i++) {
    const err = validate(comps[i], i);
    if (err) { console.error(`ERROR: ${err}`); process.exit(2); }
  }

  // dedupe by url against existing rows (a single tool can serve multiple countries; use url as identity)
  const urls = Array.from(new Set(comps.map((c) => c.url.toLowerCase())));
  const { data: existing } = await sb
    .from("competitors")
    .select("url");
  const seen = new Set<string>(
    (existing ?? []).map((r: any) => r.url.toLowerCase()),
  );
  const fresh: Competitor[] = [];
  const skipped: Competitor[] = [];
  for (const c of comps as Competitor[]) {
    const key = c.url.toLowerCase();
    if (seen.has(key)) skipped.push(c); else { fresh.push(c); seen.add(key); }
  }

  if (fresh.length === 0) {
    console.log(JSON.stringify({ inserted: 0, skipped_dupes: skipped.length, ids: [] }, null, 2));
    return;
  }

  const { data: inserted, error } = await sb
    .from("competitors")
    .insert(fresh)
    .select("id, name, url, country");
  if (error) {
    console.error(`ERROR inserting competitors: ${error.message}`);
    process.exit(3);
  }

  const byCountry: Record<string, number> = {};
  for (const c of fresh) byCountry[c.country] = (byCountry[c.country] ?? 0) + 1;

  const { error: logErr } = await sb.from("agent_log").insert({
    bee_name: "competitor-monitor",
    action: "competitor_scan",
    result: `${inserted?.length ?? 0} competitors found (${Object.entries(byCountry).map(([k, v]) => `${k}:${v}`).join(", ")})`,
    cost_usd: 0.005,
    model_used: "claude-haiku-4-5",
  });
  if (logErr) console.error(`WARN: agent_log write failed: ${logErr.message}`);

  console.log(JSON.stringify({
    inserted: inserted?.length ?? 0,
    skipped_dupes: skipped.length,
    ids: (inserted ?? []).map((r: any) => r.id),
    by_country: byCountry,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
