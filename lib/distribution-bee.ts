// ── DISTRIBUTION BEE ─────────────────────────────────────────────────────────
// Single-call notifier for newly-published content:
//   1. IndexNow ping (Bing, Yandex, Seznam — instant indexing)
//   2. Google Indexing API (optional — only if service account configured)
//   3. Log to Supabase content_performance table
//
// Designed for fire-and-forget use after publishing a story, question, or
// product page. All steps are independent — a failure in one does not abort
// the others. Returns a structured result indicating which steps succeeded.

import { createClient } from "@supabase/supabase-js";

const INDEXNOW_HOST     = "www.taxchecknow.com";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const GOOGLE_INDEXING   = "https://indexing.googleapis.com/v3/urlNotifications:publish";

export type PageType = "story" | "question" | "product" | "gpt" | "other";

export interface DistributionInput {
  url:          string;     // absolute URL to ping (e.g. https://www.taxchecknow.com/stories/gary-cgt-...)
  pageType:     PageType;
  slug:         string;     // e.g. "gary-cgt-main-residence-trap"
  productKey?:  string;     // e.g. "au_67_cgt_main_residence_trap" (when pageType === "product")
  country?:     string;     // ISO-style: "AU" | "UK" | "US" | "CAN" | "NZ" | "NOMAD"
  description?: string;     // one-liner, used in the perf log
}

export interface DistributionResult {
  url:              string;
  indexnow_pinged:  boolean;
  google_pinged:    boolean;
  logged:           boolean;
  errors:           string[];
}

// ── STEP 1: IndexNow ─────────────────────────────────────────────────────────
async function pingIndexNow(url: string, errors: string[]): Promise<boolean> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    errors.push("indexnow: INDEXNOW_KEY not set");
    return false;
  }
  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:     JSON.stringify({
        host:    INDEXNOW_HOST,
        key,
        urlList: [url],
      }),
    });
    // IndexNow returns 200 or 202 on success
    if (res.status === 200 || res.status === 202) return true;
    errors.push(`indexnow: HTTP ${res.status}`);
    return false;
  } catch (err) {
    errors.push(`indexnow: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// ── STEP 2: Google Indexing API (optional) ───────────────────────────────────
// Requires a Google service account JSON in GOOGLE_INDEXING_SERVICE_ACCOUNT.
// If unset, this step is skipped silently (returns false).
async function pingGoogle(url: string, errors: string[]): Promise<boolean> {
  const sa = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT;
  if (!sa) return false;

  try {
    const accessToken = await getGoogleAccessToken(sa);
    if (!accessToken) {
      errors.push("google: failed to obtain access token");
      return false;
    }
    const res = await fetch(GOOGLE_INDEXING, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ url, type: "URL_UPDATED" }),
    });
    if (res.ok) return true;
    const body = await res.text().catch(() => "");
    errors.push(`google: HTTP ${res.status} ${body.slice(0, 200)}`);
    return false;
  } catch (err) {
    errors.push(`google: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// Mint a Google OAuth access token from a service account JSON using JWT bearer flow.
// Service account JSON must have client_email and private_key.
async function getGoogleAccessToken(saJson: string): Promise<string | null> {
  let sa: { client_email?: string; private_key?: string };
  try {
    sa = JSON.parse(saJson);
  } catch {
    return null;
  }
  if (!sa.client_email || !sa.private_key) return null;

  const now    = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim  = {
    iss:   sa.client_email,
    scope: "https://www.googleapis.com/auth/indexing",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  };

  const enc = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${enc(header)}.${enc(claim)}`;

  // Sign with the service account's private key
  const { createSign } = await import("crypto");
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(sa.private_key).toString("base64url");
  const jwt = `${unsigned}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:     new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }).toString(),
  });
  if (!tokenRes.ok) return null;
  const data = await tokenRes.json() as { access_token?: string };
  return data.access_token ?? null;
}

// ── STEP 3: Log to Supabase content_performance ──────────────────────────────
async function logToSupabase(input: DistributionInput, errors: string[]): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    errors.push("supabase: missing credentials");
    return false;
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = await sb.from("content_performance").insert({
      url:           input.url,
      page_type:      input.pageType,
      slug:            input.slug,
      product_key:      input.productKey ?? null,
      country:           input.country    ?? null,
      description:        input.description ?? null,
      published_at:        new Date().toISOString(),
    });
    if (error) {
      errors.push(`supabase: ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    errors.push(`supabase: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// ── PUBLIC ───────────────────────────────────────────────────────────────────
export async function distributionBee(input: DistributionInput): Promise<DistributionResult> {
  const errors: string[] = [];

  const [indexnowResult, googleResult, logResult] = await Promise.all([
    pingIndexNow(input.url, errors),
    pingGoogle(input.url,    errors),
    logToSupabase(input,      errors),
  ]);

  return {
    url:              input.url,
    indexnow_pinged:  indexnowResult,
    google_pinged:    googleResult,
    logged:           logResult,
    errors,
  };
}
