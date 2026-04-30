// ── K10 Site Health Bee — GA4 ingestor ───────────────────────────────────────
// Pulls the last 7 days of `page_not_found` events from GA4 Data API,
// upserts into Supabase `site_health`, scores priority, logs to agent_log.
//
// Usage: npx ts-node --project cole/tsconfig.json scripts/ingest-site-health.ts
//
// Required env (read from .env.local locally; set in Vercel for cron):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (always)
//   GA4_PROPERTY_ID                    (numeric, e.g. 123456789)
//   GA4_SERVICE_ACCOUNT_KEY            (full JSON string of service-account key)
//
// Required Supabase schema beyond the base CREATE TABLE:
//   CREATE UNIQUE INDEX site_health_site_url_uniq
//     ON site_health(site, url_broken) WHERE url_broken IS NOT NULL;
//   (Without this, the UPSERT's onConflict fails.)

import * as fs   from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { createSign }   from "crypto";

// ── load .env.local ──────────────────────────────────────────────────────────
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const SITE       = "taxchecknow";
const SUPA_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROP_ID    = process.env.GA4_PROPERTY_ID;
const SA_JSON    = process.env.GA4_SERVICE_ACCOUNT_KEY;

if (!SUPA_URL || !SUPA_KEY) {
  console.error("ERROR: Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}
if (!PROP_ID) {
  console.error("ERROR: Missing GA4_PROPERTY_ID env var. Find it in GA4 Admin → Property Settings (numeric, not the G-XXXX measurement ID).");
  process.exit(2);
}
if (!SA_JSON) {
  console.error("ERROR: Missing GA4_SERVICE_ACCOUNT_KEY env var. Create a service account in Google Cloud Console, grant Viewer to the GA4 property, paste the JSON key value.");
  process.exit(3);
}

const sb = createClient(SUPA_URL, SUPA_KEY) as any;

// ── GA4 service-account JWT → access token ───────────────────────────────────
async function getGoogleAccessToken(saJson: string): Promise<string> {
  const sa: { client_email: string; private_key: string } = JSON.parse(saJson);
  const now    = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim  = {
    iss:   sa.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  };
  const enc      = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const signer   = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(sa.private_key).toString("base64url");
  const jwt       = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:     new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:   jwt,
    }).toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token exchange failed: HTTP ${res.status} — ${body.slice(0, 300)}`);
  }
  const { access_token } = (await res.json()) as { access_token: string };
  return access_token;
}

// ── GA4 Data API: runReport for page_not_found in last 7 days ────────────────
interface GaRow { pagePath: string; pageReferrer: string; eventCount: number; }

async function fetchPageNotFoundEvents(token: string): Promise<GaRow[]> {
  const url  = `https://analyticsdata.googleapis.com/v1beta/properties/${PROP_ID}:runReport`;
  const body = {
    dateRanges:       [{ startDate: "7daysAgo", endDate: "today" }],
    dimensions:        [{ name: "pagePath" }, { name: "pageReferrer" }],
    metrics:            [{ name: "eventCount" }],
    dimensionFilter:     {
      filter: {
        fieldName:    "eventName",
        stringFilter:  { value: "page_not_found", matchType: "EXACT" },
      },
    },
    limit: "10000",
  };
  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:     JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GA4 Data API failed: HTTP ${res.status} — ${errBody.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
  };
  return (data.rows ?? []).map(r => ({
    pagePath:      r.dimensionValues[0]?.value ?? "",
    pageReferrer:   r.dimensionValues[1]?.value ?? "",
    eventCount:      Number(r.metricValues[0]?.value ?? "0"),
  }));
}

// ── Priority scoring ─────────────────────────────────────────────────────────
function scorePriority(hitCount: number): "RED" | "AMBER" | "GREEN" {
  if (hitCount > 10) return "RED";
  if (hitCount >= 3) return "AMBER";
  return "GREEN";
}

// ── Suggested fix heuristic ──────────────────────────────────────────────────
function suggestFix(urlBroken: string): string {
  if (!urlBroken) return "Investigate manually — empty path";
  if (urlBroken.endsWith("/")) return `Try ${urlBroken.slice(0, -1)} (no trailing slash)`;
  if (/[A-Z]/.test(urlBroken))  return `Try lowercase: ${urlBroken.toLowerCase()}`;
  if (urlBroken.includes("//")) return `Double slash detected — collapse to single`;
  if (urlBroken.startsWith("/au/check/") || urlBroken.startsWith("/uk/check/") ||
      urlBroken.startsWith("/us/check/") || urlBroken.startsWith("/nz/check/") ||
      urlBroken.startsWith("/can/check/") || urlBroken.startsWith("/nomad/check/")) {
    return "Check sitemap.ts PRODUCT_PATHS — slug may be missing or renamed";
  }
  if (urlBroken.startsWith("/questions/")) return "Check sitemap.ts QUESTION_SLUGS — slug may not be published";
  if (urlBroken.startsWith("/stories/"))   return "Check sitemap.ts STORY_SLUGS — slug may not be published";
  if (urlBroken.startsWith("/gpt/"))        return "Check app/gpt/<slug>/page.tsx exists";
  return "Investigate referrer — likely external broken inbound link";
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`[K10 ingestor] Fetching GA4 page_not_found events for last 7 days from property ${PROP_ID}...`);
  const token = await getGoogleAccessToken(SA_JSON!);
  const rows  = await fetchPageNotFoundEvents(token);
  console.log(`[K10 ingestor] GA4 returned ${rows.length} page+referrer rows.`);

  if (rows.length === 0) {
    await sb.from("agent_log").insert({
      bee_name:    "site-health-ingestor",
      action:       "ingest_404s",
      result:        `0 404s in last 7 days. Site healthy or GA4 not yet receiving page_not_found events.`,
      cost_usd:        0,
      model_used:       "n/a",
    });
    console.log(`[K10 ingestor] No 404s in window. agent_log written. Exiting clean.`);
    return;
  }

  // Aggregate by url_broken (sum eventCount across referrers — referrer
  // becomes "(multiple)" when there's more than one source).
  const byUrl = new Map<string, { hitCount: number; referrers: Set<string> }>();
  for (const r of rows) {
    const key = r.pagePath || "(unknown)";
    const ent = byUrl.get(key) ?? { hitCount: 0, referrers: new Set() };
    ent.hitCount += r.eventCount;
    if (r.pageReferrer) ent.referrers.add(r.pageReferrer);
    byUrl.set(key, ent);
  }

  let red = 0, amber = 0, green = 0, errors = 0;

  for (const [urlBroken, ent] of byUrl) {
    const priority = scorePriority(ent.hitCount);
    if (priority === "RED")  red++;
    else if (priority === "AMBER") amber++;
    else green++;

    const referrer =
      ent.referrers.size === 0 ? "(direct)" :
      ent.referrers.size === 1 ? Array.from(ent.referrers)[0]! :
      "(multiple)";

    const { error } = await sb.from("site_health").upsert(
      {
        site:           SITE,
        check_type:      "404",
        url_broken:       urlBroken,
        url_expected:      null,
        referrer,
        hit_count:           ent.hitCount,
        http_status:           404,
        priority,
        suggested_fix:           suggestFix(urlBroken),
        resolved:                  false,
        detected_at:                 new Date().toISOString(),
      },
      { onConflict: "site,url_broken" },
    );
    if (error) {
      errors++;
      console.error(`[K10 ingestor] upsert failed for ${urlBroken}: ${error.message}`);
    }
  }

  const total = byUrl.size;
  console.log(`[K10 ingestor] Ingested ${total} unique broken URLs. ${red} RED · ${amber} AMBER · ${green} GREEN · ${errors} errors.`);

  await sb.from("agent_log").insert({
    bee_name:    "site-health-ingestor",
    action:       "ingest_404s",
    result:        `${total} 404s ingested. ${red} RED. ${amber} AMBER. ${green} GREEN.${errors > 0 ? ` ${errors} upsert errors.` : ""}`,
    cost_usd:        0,
    model_used:       "n/a",
  });
})().catch((e) => {
  console.error(`[K10 ingestor] FAILED:`, e);
  process.exit(1);
});
