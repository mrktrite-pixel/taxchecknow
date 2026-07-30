// ─────────────────────────────────────────────────────────────────────────────
// CONFIG vs AUTHORITY DIFF — the runner. Supplies real data to compareProduct().
//
//   MODE A (one product):  npm run audit:authority -- <product-id | build-id>
//   MODE B (sweep, all):   npm run audit:authority -- --sweep
//                          npm run audit:authority -- --sweep --json
//
// Exported so mode B can be invoked on a schedule later. NO cron entry is added
// (Step 4 item 6 — the operator wants to see the output before it runs unattended).
//
// READ-ONLY against the database: SELECTs only, no writes anywhere.
// ─────────────────────────────────────────────────────────────────────────────
import * as fs from "node:fs";
import * as path from "node:path";
import {
  compareProduct, extractAuthorityFigures, extractSourceLastUpdated,
  type ProductDiff, type FigureState,
} from "./config-authority-diff";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CONFIG_DIR = path.join(REPO_ROOT, "cole", "config");

// ── env ──────────────────────────────────────────────────────────────────────
function loadEnv(): { url: string; key: string } {
  const p = path.join(REPO_ROOT, ".env.local");
  if (!fs.existsSync(p)) throw new Error(`[authority-diff] .env.local missing at ${p} — refusing to report a vacuous sweep`);
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim(); if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("="); if (i < 0) continue;
    const k = t.slice(0, i).trim();
    if (!(k in env)) env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("[authority-diff] Supabase URL/service key absent from .env.local");
  return { url, key };
}

async function select(rel: string): Promise<any[]> {
  const { url, key } = loadEnv();
  const r = await fetch(`${url}/rest/v1/${rel}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const j = await r.json().catch(() => null);
  if (!Array.isArray(j)) throw new Error(`[authority-diff] ${rel.slice(0, 70)} → HTTP ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

// ── config resolution ────────────────────────────────────────────────────────
// TRAP (dispatch item 4): config ids and DB slugs disagree. Resolution order,
// most specific first, so a near-miss never silently reads as "no authority":
//   1. exact config filename
//   2. filename ending in -<slug leaf>   (handles au-16-... vs slug leaf
//      superannuation-...; also day-183-rule, australia-smsf-residency, nomad)
//   3. config whose exported id equals the slug leaf
// Anything still unresolved is reported as NO_CONFIG explicitly — never as a
// missing authority, because those are different problems with different fixes.
let CONFIG_FILES: string[] | null = null;
function configFiles(): string[] {
  if (!CONFIG_FILES) {
    if (!fs.existsSync(CONFIG_DIR)) throw new Error(`[authority-diff] config dir missing: ${CONFIG_DIR}`);
    CONFIG_FILES = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith(".ts")).map(f => f.replace(/\.ts$/, ""));
    if (CONFIG_FILES.length === 0) throw new Error("[authority-diff] no configs found");
  }
  return CONFIG_FILES;
}

export function resolveConfigFile(productId: string, slug?: string): string | null {
  const files = configFiles();
  if (files.includes(productId)) return productId;
  const leaf = String(slug ?? "").split("/").pop() ?? "";
  const stripped = productId.replace(/^[a-z]{2,6}-/, "");
  for (const candidate of [leaf, stripped].filter(Boolean)) {
    const hit = files.find(f => f === candidate || f.endsWith(`-${candidate}`));
    if (hit) return hit;
  }
  return null;
}

function readConfigText(file: string | null): string | null {
  if (!file) return null;
  const p = path.join(CONFIG_DIR, `${file}.ts`);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

// ── snapshot classification ──────────────────────────────────────────────────
// TRAP (dispatch item 4): authority_source_snapshots.topic mixes rule-watch
// topics with product topics in ONE namespace (measured: 20 product rows vs 9
// rule-watch rows across 29). Matching naively inflates coverage, so a snapshot
// counts for a product only when its topic actually resolves to that product.
export interface SnapshotState {
  usable: boolean;
  expired: boolean;
  detail: string;
  sourceUrl: string | null;
  fetchedAt: string | null;
}

export function classifySnapshots(rows: any[], now = Date.now()): SnapshotState {
  if (rows.length === 0) return { usable: false, expired: false, detail: "no snapshot rows for this product", sourceUrl: null, fetchedAt: null };
  let newestUsable: any = null, newestExpired: any = null, errored = 0;
  for (const s of rows) {
    if (s.fetch_error || !s.content_hash) { errored++; continue; }
    const until = s.validity_until ? Date.parse(s.validity_until) : NaN;
    const isExpired = Number.isNaN(until) || until < now;
    if (isExpired) { if (!newestExpired || s.fetched_at > newestExpired.fetched_at) newestExpired = s; }
    else if (!newestUsable || s.fetched_at > newestUsable.fetched_at) newestUsable = s;
  }
  if (newestUsable) return { usable: true, expired: false, detail: `snapshot in window (fetched ${String(newestUsable.fetched_at).slice(0, 10)})`, sourceUrl: newestUsable.source_url, fetchedAt: newestUsable.fetched_at };
  if (newestExpired) return { usable: false, expired: true, detail: `newest usable snapshot expired ${String(newestExpired.validity_until).slice(0, 10)} (fetched ${String(newestExpired.fetched_at).slice(0, 10)})`, sourceUrl: newestExpired.source_url, fetchedAt: newestExpired.fetched_at };
  return { usable: false, expired: false, detail: `${errored} snapshot row(s) exist but all carry a fetch error or no content hash`, sourceUrl: rows[0]?.source_url ?? null, fetchedAt: null };
}

// ── the two modes ────────────────────────────────────────────────────────────
export async function diffOneProduct(productKeyOrBuildId: string): Promise<ProductDiff> {
  const products = await select("products?select=id,product_id,slug&limit=500");
  const builds = await select("build_jobs?select=id,product_id,build_state,started_at,research_output&order=started_at.desc&limit=500");
  const snaps = await select("authority_source_snapshots?select=id,topic,source_url,fetch_error,content_hash,fetched_at,validity_until&limit=1000");

  let product = products.find(p => p.product_id === productKeyOrBuildId || String(p.slug ?? "").endsWith(`/${productKeyOrBuildId}`));
  let build = builds.find(b => String(b.id).startsWith(productKeyOrBuildId));
  if (build && !product) product = products.find(p => p.id === build.product_id);
  if (!product && !build) throw new Error(`[authority-diff] no product or build matches "${productKeyOrBuildId}"`);
  if (!build && product) build = builds.find(b => b.product_id === product.id);

  return buildDiff(product, build, snaps);
}

function buildDiff(product: any, build: any, allSnaps: any[]): ProductDiff {
  const productId = product?.product_id ?? `build:${build?.id}`;
  const configFile = product ? resolveConfigFile(product.product_id, product.slug) : null;
  const configText = readConfigText(configFile);

  const figures = build?.research_output ? extractAuthorityFigures(build.research_output) : [];
  const lastUpdated = build?.research_output ? extractSourceLastUpdated(build.research_output) : null;

  // Only snapshots whose topic resolves to THIS product (namespace trap).
  const leaf = String(product?.slug ?? "").split("/").pop() ?? "";
  const mine = allSnaps.filter(s => {
    const t = String(s.topic ?? "");
    return t === leaf || t === product?.product_id || resolveConfigFile(t, t) === configFile && configFile !== null;
  });
  const snap = classifySnapshots(mine);

  return compareProduct({
    productId,
    configFile,
    configText,
    figures,
    authoritySource: figures.length ? "build_figures" : snap.usable ? "snapshot" : "none",
    buildId: build?.id ?? null,
    sourceUrl: snap.sourceUrl,
    sourceLastUpdated: lastUpdated,
    expired: snap.expired,
    expiredDetail: snap.detail,
  });
}

export async function sweepAllProducts(): Promise<ProductDiff[]> {
  const products = await select("products?select=id,product_id,slug,retired&limit=500");
  const builds = await select("build_jobs?select=id,product_id,build_state,started_at,research_output&order=started_at.desc&limit=500");
  const snaps = await select("authority_source_snapshots?select=id,topic,source_url,fetch_error,content_hash,fetched_at,validity_until&limit=1000");
  const live = products.filter(p => !p.retired);
  const newestBuildFor = new Map<string, any>();
  for (const b of builds) if (!newestBuildFor.has(b.product_id)) newestBuildFor.set(b.product_id, b);
  return live.map(p => buildDiff(p, newestBuildFor.get(p.id), snaps));
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function tally(diffs: ProductDiff[]) {
  const overall: Record<string, number> = {};
  const fig: Record<FigureState, number> = { AGREES: 0, DISAGREES: 0, NO_AUTHORITY: 0, AUTHORITY_EXPIRED: 0 };
  for (const d of diffs) {
    overall[d.overall] = (overall[d.overall] ?? 0) + 1;
    for (const k of Object.keys(fig) as FigureState[]) fig[k] += d.counts[k];
  }
  return { overall, fig };
}

function printOne(d: ProductDiff) {
  console.log(`\n${"─".repeat(78)}`);
  console.log(`${d.productId}   [${d.overall}]`);
  console.log(`  config: ${d.configFile ?? "(none)"}   authority: ${d.authoritySource}${d.buildId ? `   build ${String(d.buildId).slice(0, 8)}` : ""}`);
  console.log(`  ${d.reason}`);
  for (const f of d.figures) {
    const mark = f.state === "AGREES" ? "OK  " : "DIFF";
    console.log(`   ${mark} ${f.id}`);
    console.log(`        authority: ${f.authorityValue} ${f.unit}${f.factRole ? ` (${f.factRole})` : ""}`);
    if (f.state === "DISAGREES") {
      if (f.configCandidates.length) {
        // CANDIDATES, not an answer. The heuristic (same magnitude + a shared
        // label word) does NOT reliably rank the true counterpart first: for the
        // medicare singles threshold the correct value 93,000 ranks 7th, behind
        // 100,000 which merely sits nearer the word "threshold". Presented as a
        // shortlist for a human to judge, because a confidently wrong "config
        // says" is worse than an honest shortlist.
        console.log(`        config candidates (heuristic, NOT authoritative):`);
        for (const c of f.configCandidates) console.log(`          ${c.value}   « ${c.context.slice(0, 92)} »`);
      } else console.log(`        config candidates: ${f.note}`);
      if (f.sourceLastUpdated) console.log(`        source last updated: ${f.sourceLastUpdated}`);
      if (f.sourceUrl) console.log(`        source: ${f.sourceUrl.slice(0, 96)}`);
      if (f.sourceQuote) console.log(`        quote: "${f.sourceQuote.slice(0, 96)}"`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const sweep = args.includes("--sweep");
  const target = args.find(a => !a.startsWith("--"));

  if (!sweep && !target) {
    console.error("Usage:\n  MODE A  npm run audit:authority -- <product-id|build-id>\n  MODE B  npm run audit:authority -- --sweep [--json]");
    process.exit(1);
  }

  if (sweep) {
    const diffs = await sweepAllProducts();
    if (asJson) { console.log(JSON.stringify(diffs, null, 2)); return; }
    const { overall, fig } = tally(diffs);
    console.log("=".repeat(78));
    console.log(`CONFIG vs AUTHORITY — SWEEP over ${diffs.length} live products`);
    console.log("=".repeat(78));
    console.log("\nPRODUCT-LEVEL STATE:");
    for (const [k, v] of Object.entries(overall).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`);
    console.log("\nFIGURE-LEVEL STATE:");
    for (const [k, v] of Object.entries(fig)) console.log(`  ${String(v).padStart(3)}  ${k}`);
    const compared = diffs.filter(d => d.overall === "COMPARED");
    console.log(`\nPRODUCTS WITH ANYTHING TO COMPARE: ${compared.length} of ${diffs.length}`);
    for (const d of compared) printOne(d);
    const disagreeing = compared.filter(d => d.counts.DISAGREES > 0);
    console.log(`\n${"=".repeat(78)}`);
    console.log(`PRODUCTS WITH AT LEAST ONE DISAGREEMENT: ${disagreeing.length}`);
    for (const d of disagreeing) console.log(`  ${d.counts.DISAGREES} disagree / ${d.counts.AGREES} agree   ${d.productId}`);
    return;
  }

  const d = await diffOneProduct(target!);
  if (asJson) console.log(JSON.stringify(d, null, 2));
  else printOne(d);
}

if (require.main === module) {
  main().catch(e => { console.error(`\n${e?.message ?? e}\n`); process.exit(1); });
}
