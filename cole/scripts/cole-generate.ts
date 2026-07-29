// ─────────────────────────────────────────────────────────────────────────────
// COLE — Main Generation Script
// Usage: npx ts-node --project cole/tsconfig.json cole/scripts/cole-generate.ts [product-id]
// Example: npx ts-node --project cole/tsconfig.json cole/scripts/cole-generate.ts uk-03
// ─────────────────────────────────────────────────────────────────────────────
import * as fs   from "fs";
import * as path from "path";
// Load .env.local automatically if it exists
const envPath = path.join(__dirname, "../../.env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}
import { generateGatePage,      getGatePagePath      } from "../generators/generate-gate-page";
import { generateCalculator,    getCalculatorPath     } from "../generators/generate-calculator";
import { generateSuccessAssess, getSuccessAssessPath,
         generateSuccessPlan,   getSuccessPlanPath   } from "../generators/generate-success-pages";
import { generateAllProductFiles                      } from "../generators/generate-product-files";
import { isGuardRefusal, rethrowIfGuardRefusal } from "../generators/guard-refusal";
import { generateRulesRoute,    getRulesRoutePath     } from "../generators/generate-rules-route";
import { generateTemporalRegistry, getTemporalRegistryPath } from "../generators/generate-temporal-registry";
import type { ProductConfig } from "../types/product-config";
import { createClient } from "@supabase/supabase-js";
import type { GeoBake } from "../generators/generate-gate-page";
// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const APP_ROOT        = path.join(__dirname, "../../app");
const CONFIG_DIR      = path.join(__dirname, "../config");
const CALCULATORS_DIR = path.join(__dirname, "../calculators"); // hand-built calculators live here
const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── GEO BAKE — fetch transcript + published-video facts at generate time ──────
// Best-effort: any miss (no DB env, no match, fetch error) returns nulls → the page
// generates unchanged. content_jobs product_key is <country>-<NN>-<slug>; config.id is the
// slug, so match product_key ending in `-<id>`. Transcript prefers the long script (rich,
// chapter-joined) over the short script (thin). Video = newest published youtube row with a
// resolved youtube_video_id (prefer long).
async function fetchGeoBake(config: ProductConfig): Promise<GeoBake> {
  const empty: GeoBake = { transcript: null, video: null };
  if (!SUPABASE_URL || !SUPABASE_KEY) return empty;
  const slug = config.id;
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const pick = <T extends { product_key?: string }>(rows: T[]): T | undefined =>
      rows.find((r) => typeof r.product_key === "string" && r.product_key.endsWith(`-${slug}`)) ?? rows[0];

    // transcript (+ title) from content_jobs
    const { data: cj } = await supabase
      .from("content_jobs").select("product_key, output_data").ilike("product_key", `%${slug}`);
    const od = (pick((cj ?? []) as Array<{ product_key: string; output_data: any }>)?.output_data) ?? {};
    let transcript: string | null = null;
    let title: string | undefined;
    if (od.ytl_script?.script_text) {
      const ch: Array<{ heading?: string; body?: string }> = Array.isArray(od.ytl_script.chapters) ? od.ytl_script.chapters : [];
      transcript = ch.length
        ? ch.map((c) => `${c.heading ? c.heading + "\n" : ""}${c.body ?? ""}`.trim()).filter(Boolean).join("\n\n")
        : String(od.ytl_script.script_text);
      title = od.ytl_script.chosen_title;
    } else if (od.youtube_short_script?.script_text) {
      transcript = String(od.youtube_short_script.script_text);
      title = od.youtube_short_script.title;
    }

    // published video from content_performance (prefer long)
    const { data: cp } = await supabase
      .from("content_performance").select("product_key, youtube_video_id, published_at, format_type")
      .eq("platform", "youtube").eq("status", "published").not("youtube_video_id", "is", null)
      .ilike("product_key", `%${slug}`).order("published_at", { ascending: false });
    const pubRows = ((cp ?? []) as Array<{ product_key: string; youtube_video_id: string; published_at: string; format_type: string }>)
      .filter((r) => r.product_key.endsWith(`-${slug}`));
    const vrow = pubRows.find((r) => r.format_type === "long") ?? pubRows[0];
    const video = vrow?.youtube_video_id
      ? { id: vrow.youtube_video_id, uploadDate: vrow.published_at, name: title ?? config.name, description: config.metaDescription }
      : null;

    return { transcript, video };
  } catch {
    return empty;
  }
}

// ── PASCAL HELPER (mirrors generate-calculator.ts) ────────────────────────────
function toPascal(str: string): string {
  return str.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function cole(productId: string, successOnly = false, evidenceOnly = false) {
  const startTime      = Date.now();
  const filesGenerated: string[] = [];
  const errors:         string[] = [];
  console.log(`\n🤖 COLE starting: ${productId}`);
  console.log(`   ${new Date().toISOString()}\n`);
  // ── STEP 1: Load config ───────────────────────────────────────────────────
  let config: ProductConfig;
  try {
    let configPath = path.join(CONFIG_DIR, `${productId}.ts`);
    if (!fs.existsSync(configPath)) {
      const allConfigs = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith(".ts"));
      // Resolve by filename prefix (au-19), OR by the slug TAIL (config files are
      // "<country>-<NN>-<slug>.ts", so the basename ends with the slug). The tail form lets the
      // update-emit mechanics pass the storefront slug tail (e.g. frcgw-clearance-certificate).
      const base = (f: string) => f.replace(/\.ts$/, "");
      const match      = allConfigs.find(f => f.startsWith(productId))
                      ?? allConfigs.find(f => base(f).endsWith(`-${productId}`) || base(f) === productId);
      if (match) {
        configPath = path.join(CONFIG_DIR, match);
        console.log(`   → Resolved to: ${match}`);
      } else {
        throw new Error(`Config not found: ${configPath}\n   Available: ${allConfigs.join(", ")}`);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(configPath);
    config    = mod.PRODUCT_CONFIG;
    if (!config) throw new Error("Config file must export PRODUCT_CONFIG");
    console.log(`   ✅ Config loaded: ${config.name}`);
    // ── VALIDATE: no JSX-breaking < > in string fields ────────────────────
    const jsxFields = [
      ...config.brackets.map(b => b.label),
      ...(config.calculatorInputs || []).flatMap(i =>
        "options" in i ? i.options.map((o: {label: string}) => o.label) : []
      ),
      ...config.workedExamples.map(e => e.status),
      ...config.workedExamples.map(e => e.income),
      config.geoBodyParagraph,
      config.h1,
    ];
    const jsxIssues = jsxFields.filter(s => s && (s.includes("<") || s.includes(">")));
    if (jsxIssues.length > 0) {
      console.warn(`   ⚠️  JSX WARNING: < or > found in ${jsxIssues.length} field(s):`);
      jsxIssues.forEach(s => console.warn(`      "${s?.slice(0, 60)}"`));
      console.warn(`   Replace < with "less than" and > with "over" / "exceeds"`);
    }
  } catch (err) {
    rethrowIfGuardRefusal(err);   // a guard refusal aborts the run; it is never collected
    console.error(`   ❌ Config error: ${err}`);
    process.exit(1);
  }

  // ── UPDATE/MIGRATION EMIT (--success-only) ────────────────────────────────
  // DOCTRINE: an update is a full new build that retains the URL — the emit delivers the
  // calculator AND regenerated success pages, never a partial transplant. emit-engine.ts writes
  // engine.json/figures.json only; this step regenerates the paid success pages with the SAME
  // generator the new build uses, so a migrated product's deliverable is never left legacy.
  // Runs ONLY success pages (not gate/calculator/files) so it cannot clobber the engine-native
  // calculator or gate. Gated by the R-A2/R-A3 tripwire inside buildSuccessPage().
  // TEMPORAL v1 Step 6 — EVIDENCE-ONLY. Re-derives the temporal registry and writes the gate
  // evidence WITHOUT regenerating a single page.
  //
  // Why this mode exists: declaring a product should not require re-emitting it. The
  // --success-only path is tripwired (buildSuccessPage throws unless
  // COLE_SUCCESS_TEMPLATE_RA2_RA3=1) and, for a product whose success pages predate the Phase 0
  // countdown block, regeneration would ALSO introduce a countdown keyed to config.deadline.
  // Neither belongs in "record this product's declaration". Evidence-only touches no page,
  // trips no wire, and changes no rendered output.
  if (evidenceOnly) {
    console.log(`   → --evidence-only: temporal registry + gate evidence for ${config.id} (NO page regenerated)\n`);
    emitTemporalRegistry(filesGenerated, errors);
    await writeTemporalEvidence(config, errors);
    const ok = errors.length === 0;
    console.log(`\n${"─".repeat(60)}`);
    console.log(ok ? `\n✅ Temporal evidence recorded: ${productId}` : `\n⚠️  Completed with ${errors.length} error(s):`);
    errors.forEach(e => console.log(`   • ${e}`));
    if (!ok) process.exitCode = 1;
    return;
  }

  if (successOnly) {
    console.log(`   → --success-only: regenerating success pages for ${config.id} (calculator/gate untouched)\n`);
    emitSuccessPages(config, filesGenerated, errors);
    // TEMPORAL v1 Step 6 — the registry is re-emitted on --success-only too. A
    // migration/update emit is exactly when a product's declaration is added or
    // changed, so skipping it here would let the registry go stale precisely on
    // the path the gate is meant to catch. Same for the gate evidence: the
    // UPDATE gate is the arm that clears the undeclared backlog, and --success-only
    // is the emit path a PANELBEAT update actually uses.
    emitTemporalRegistry(filesGenerated, errors);
    await writeTemporalEvidence(config, errors);
    const ok = errors.length === 0;
    console.log(`\n${"─".repeat(60)}`);
    console.log(ok
      ? `\n✅ Success pages regenerated: ${productId} (${filesGenerated.length} files)`
      : `\n⚠️  Success-only completed with ${errors.length} error(s):`);
    errors.forEach(e => console.log(`   • ${e}`));
    if (!ok) process.exitCode = 1;
    return;
  }

  // ── PER-SURFACE EMIT (--gate-only / --files-only) ─────────────────────────
  // An ENGINE-NATIVE product cannot take a full cole-generate: generate-calculator
  // refuses (R-A2 guard), and rightly so — a full run would otherwise overwrite the
  // EngineCalculator wrapper. But such a product still needs its gate page and its
  // eight delivered documents regenerated when its CONFIG changes. These two modes
  // are the supported way to do that: each touches exactly one surface and never
  // goes near the calculator.
  if (gateOnly) {
    console.log(`   → --gate-only: regenerating the gate page for ${config.id} (calculator/success/files untouched)\n`);
    await emitGatePage(config, filesGenerated, errors);
    const ok = errors.length === 0;
    console.log(`\n${"─".repeat(60)}`);
    console.log(ok ? `\n✅ Gate page regenerated: ${productId}` : `\n⚠️  Gate-only completed with ${errors.length} error(s):`);
    errors.forEach(e => console.log(`   • ${e}`));
    if (!ok) process.exitCode = 1;
    return;
  }

  if (filesOnly) {
    console.log(`   → --files-only: regenerating the ${config.files.length} product files for ${config.id} (calculator/gate/success untouched)\n`);
    emitProductFiles(config, filesGenerated, errors);
    const ok = errors.length === 0;
    console.log(`\n${"─".repeat(60)}`);
    console.log(ok ? `\n✅ Product files regenerated: ${productId}` : `\n⚠️  Files-only completed with ${errors.length} error(s):`);
    errors.forEach(e => console.log(`   • ${e}`));
    if (!ok) process.exitCode = 1;
    return;
  }

  // ── STEP 2: Generate gate page ────────────────────────────────────────────
  await emitGatePage(config, filesGenerated, errors);
  // ── STEP 3: Calculator ────────────────────────────────────────────────────
  // RULE: If a hand-built calculator exists in cole/calculators/, copy it.
  //       Never overwrite hand-built calculators with generated ones.
  //       If no hand-built version exists, generate from config as normal.
  try {
    const calculatorName = toPascal(config.id) + "Calculator";
    const handBuiltPath  = path.join(CALCULATORS_DIR, `${calculatorName}.tsx`);
    const outputPath     = getCalculatorPath(config, APP_ROOT);

    if (fs.existsSync(handBuiltPath)) {
      // Hand-built exists — copy it, do not generate
      const content = fs.readFileSync(handBuiltPath, "utf8");
      writeFile(outputPath, content);
      filesGenerated.push(outputPath);
      console.log(`   ✅ Calculator (hand-built ✋ — preserved from cole/calculators/)\n      → ${relativePath(outputPath)}`);
    } else {
      // No hand-built — generate from config
      writeFile(outputPath, generateCalculator(config));
      filesGenerated.push(outputPath);
      console.log(`   ✅ Calculator (generated 🤖)\n      → ${relativePath(outputPath)}`);
    }
  } catch (err) {
    rethrowIfGuardRefusal(err);   // a guard refusal aborts the run; it is never collected
    const msg = `Calculator: ${err}`;
    errors.push(msg);
    console.error(`   ❌ ${msg}`);
  }
  // ── STEP 4: Generate success pages ────────────────────────────────────────
  emitSuccessPages(config, filesGenerated, errors);
  // ── STEP 5: Generate product files ────────────────────────────────────────
  emitProductFiles(config, filesGenerated, errors);
  // ── STEP 6: Generate rules route ──────────────────────────────────────────
  try {
    const filePath = getRulesRoutePath(config, APP_ROOT);
    writeFile(filePath, generateRulesRoute(config));
    filesGenerated.push(filePath);
    console.log(`   ✅ Rules API route\n      → ${relativePath(filePath)}`);
  } catch (err) {
    rethrowIfGuardRefusal(err);   // a guard refusal aborts the run; it is never collected
    errors.push(`Rules route: ${err}`);
    console.error(`   ❌ Rules route: ${err}`);
  }
  // ── STEP 6b: Temporal registry (TEMPORAL v1 Step 6) ───────────────────────
  // Re-derived from every config on each build, so a product that gains or
  // changes a declaration lands in the runtime registry as a by-product of the
  // build already happening — never as a separate hand-edit.
  emitTemporalRegistry(filesGenerated, errors);
  await writeTemporalEvidence(config, errors);

  // ── STEP 7: Log to Supabase ───────────────────────────────────────────────
  const duration = Date.now() - startTime;
  const success  = errors.length === 0;
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cole_log`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "apikey":        SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer":        "return=minimal",
        },
        body: JSON.stringify({
          product_id:      productId,
          trigger:         "manual",
          files_generated: filesGenerated.map(relativePath),
          errors:          errors.length > 0 ? errors : null,
          duration_ms:     duration,
          success,
          notes:           "Generated by cole-generate.ts",
        }),
      });
      if (res.ok) {
        console.log(`   ✅ Logged to Supabase`);
      } else {
        console.log(`   ⚠️  Supabase log failed: ${res.status}`);
      }
    } catch (err) {
      rethrowIfGuardRefusal(err);   // a guard refusal aborts the run; it is never collected
    rethrowIfGuardRefusal(err);   // a guard refusal aborts the run; it is never collected
      console.log(`   ⚠️  Supabase log error: ${err}`);
    }
  } else {
    console.log(`   ⚠️  Supabase not configured — add keys to .env.local to enable logging`);
  }
  // ── STEP 8: Summary ───────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);
  if (!success) {
    console.log(`\n⚠️  COLE completed with ${errors.length} error(s):`);
    errors.forEach(e => console.log(`   • ${e}`));
  } else {
    console.log(`\n✅ COLE complete: ${productId}`);
    console.log(`   ${filesGenerated.length} files generated in ${duration}ms`);
  }
  console.log(`\n${"─".repeat(60)}`);
  console.log(`\n📋 NEXT STEPS:\n`);
  console.log(`1. Add to app/api/create-checkout-session/route.ts:`);
  console.log(`   if (key === "${config.tier1.productKey}") return process.env.${config.tier1.envVar};`);
  console.log(`   if (key === "${config.tier2.productKey}") return process.env.${config.tier2.envVar};\n`);
  console.log(`2. Add to Vercel environment variables:`);
  console.log(`   ${config.tier1.envVar} = price_live_...`);
  console.log(`   ${config.tier2.envVar} = price_live_...\n`);
  console.log(`3. Create Stripe products:`);
  console.log(`   Tier 1: ${config.tier1.name} — £${config.tier1.price}`);
  console.log(`   Tier 2: ${config.tier2.name} — £${config.tier2.price}\n`);
  console.log(`4. Add to changedetection.io monitoring:`);
  config.monitorUrls.forEach(url => console.log(`   ${url}`));
  console.log(`   Webhook: https://taxchecknow.com/api/cole/monitor\n`);
  console.log(`5. Push to Vercel:`);
  console.log(`   git add .`);
  console.log(`   git commit -m "feat: ${productId} — generated by COLE"`);
  console.log(`   git push\n`);
  // ── STEP 9: Output URLs ──────────────────────────────────────────────────
  const baseUrl = "https://taxchecknow.com";
  console.log(`${"─".repeat(60)}`);
  console.log(`\n🌐 URLS (live after push):\n`);
  console.log(`   Gate page:   ${baseUrl}/${config.slug}`);
  console.log(`   Rules JSON:  ${baseUrl}${config.apiRoute}`);
  console.log(`   Success T1:  ${baseUrl}/${config.slug}/success/${config.tier1.successPath}`);
  console.log(`   Success T2:  ${baseUrl}/${config.slug}/success/${config.tier2.successPath}`);
  console.log(`\n   Product files:`);
  config.files.forEach(f => {
    console.log(`   File ${f.num}:      ${baseUrl}/files/${config.country}/${config.id}/${f.slug}`);
  });
  console.log(`\n${"─".repeat(60)}\n`);
}
// ── HELPERS ───────────────────────────────────────────────────────────────────
// Success-page emit — the SAME generation the new-build flow runs (STEP 4). Extracted so the
// update/migration emit (--success-only) regenerates success pages IDENTICALLY, never a partial
// transplant. buildSuccessPage() carries the R-A2/R-A3 hard-rule tripwire, so a premature regen
// throws here (recorded as an error) until the template is upgraded + COLE_SUCCESS_TEMPLATE_RA2_RA3=1.
// TEMPORAL v1 Step 6 — re-emit lib/temporal-registry.ts from ALL configs.
// Whole-registry rather than per-product because the file is a single map: a
// per-product patch would need to parse and splice the existing output, and a
// full re-derive from the configs cannot drift from them.
// Non-fatal: a registry failure is recorded but must not fail a product build,
// or a temporal problem could block an unrelated emit. The gate is what stops
// an undeclared product shipping — this generator only reflects declarations.
function emitTemporalRegistry(filesGenerated: string[], errors: string[]): void {
  try {
    const entries = generateTemporalRegistry(CONFIG_DIR, path.dirname(APP_ROOT));
    const p = getTemporalRegistryPath(path.dirname(APP_ROOT));
    filesGenerated.push(p);
    console.log(`   ✅ Temporal registry (${entries.length} declared product${entries.length === 1 ? "" : "s"})\n      → ${relativePath(p)}`);
    // Step 7 — an entry may declare EITHER lane, so neither may be dereferenced
    // unconditionally. This line previously read `e.temporal.kind` and threw the
    // moment a nurture-only product appeared; cole/tsconfig.json sets
    // "strict": false, so the optional access was not a compile error and only
    // surfaced at run time. The registry file itself was written correctly —
    // the throw was in the logging that follows it.
    for (const e of entries) {
      const lanes = [
        e.temporal ? `temporal:${e.temporal.kind}` : null,
        e.nurture?.length ? `nurture:${e.nurture.map(t => `${t.track}@${t.anchor}[${t.milestones.join(",")}]`).join(" + ")}` : null,
      ].filter(Boolean).join("  ");
      console.log(`      · ${e.site}/${e.productId} → ${lanes}`);
    }
  } catch (err) {
    rethrowIfGuardRefusal(err);   // a guard refusal aborts the run; it is never collected
    errors.push(`Temporal registry: ${err}`);
    console.error(`   ❌ Temporal registry: ${err}`);
  }
}

// TEMPORAL v1 Step 6.4 / R3 — PERSIST THE DECLARATION AS GATE EVIDENCE.
// This is the cross-repo bridge from 6.6: the declaration is authored in the
// product's config here, and the soverella gate auto-ticks `temporal_declared`
// from what this writes. soverella cannot read this repo's files; the shared
// Supabase project is the only thing both sides can see.
//
// Writes TWO places, per the R3 ruling:
//   · build_jobs.temporal_declaration (jsonb) — the full declaration, alongside
//     research_output, exactly how law_correctness evidence already flows. The
//     gate is keyed by build_job_id, so this is what it reads.
//   · products.temporal_kind (text) — the resolved KIND only, mirrored for the
//     catalogue. NOT products.deadline: that column holds stored dates for 5 UK
//     rows and is the anti-pattern 6.1 forbids — it is reported as a separate
//     defect and deliberately left untouched.
//
// JOIN KEY is products.slug === config.slug (verified: "au/check/frcgw-clearance-
// certificate" matches exactly). Deliberately NOT products.config_path, which is
// NULL on every row, and NOT products.product_id, which holds the config FILENAME
// stem ("au-19-frcgw-clearance-certificate") rather than config.id.
//
// Non-fatal throughout: evidence is an observability/gating concern and must
// never fail a product build. A miss is logged loudly and leaves the gate item
// unticked — which correctly blocks the ship rather than silently passing it.
async function writeTemporalEvidence(config: ProductConfig, errors: string[]): Promise<void> {
  if (!config.temporal) {
    console.log(`   ⚠️  Temporal evidence SKIPPED — ${config.id} has no \`temporal\` declaration.`);
    console.log(`      The soverella gate item \`temporal_declared\` will stay UNTICKED and block the ship (Step 6.4).`);
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log(`   ⚠️  Temporal evidence SKIPPED — no Supabase env; the gate item will stay unticked.`);
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY) as any;

    const { data: products, error: pErr } = await sb
      .from("products").select("id, slug, site")
      .eq("site", config.site).eq("slug", config.slug).limit(1);
    if (pErr) throw new Error(`products lookup: ${pErr.message}`);
    const product = (products ?? [])[0];
    if (!product) {
      console.log(`   ⚠️  Temporal evidence — no products row for ${config.site}/${config.slug}; nothing to attach to.`);
      return;
    }

    // Mirror the KIND for the catalogue.
    const { error: mErr } = await sb.from("products")
      .update({ temporal_kind: config.temporal.kind }).eq("id", product.id);
    if (mErr) throw new Error(`products.temporal_kind: ${mErr.message}`);

    // Attach the full declaration to the build job the operator is gating.
    // RULE: the most recently updated build_job for this product. Today every
    // product has exactly one, so this is unambiguous; ordering explicitly keeps
    // it deterministic if that ever stops being true. A product with NO build
    // job (hand-built, never through the queen) simply gets no evidence — its
    // gate item stays unticked, which is the correct, safe outcome.
    const { data: jobs, error: jErr } = await sb
      .from("build_jobs").select("id, build_state")
      .eq("product_id", product.id).order("updated_at", { ascending: false }).limit(1);
    if (jErr) throw new Error(`build_jobs lookup: ${jErr.message}`);
    const job = (jobs ?? [])[0];
    if (!job) {
      console.log(`   ⚠️  Temporal evidence — products.temporal_kind set, but no build_job for ${config.slug} to attach the declaration to.`);
      return;
    }

    const { error: bErr } = await sb.from("build_jobs")
      .update({ temporal_declaration: config.temporal }).eq("id", job.id);
    if (bErr) throw new Error(`build_jobs.temporal_declaration: ${bErr.message}`);

    console.log(`   ✅ Temporal evidence written — kind "${config.temporal.kind}"`);
    console.log(`      products.temporal_kind → ${product.id}`);
    console.log(`      build_jobs.temporal_declaration → ${job.id} (${job.build_state})`);
  } catch (err) {
    rethrowIfGuardRefusal(err);   // a guard refusal aborts the run; it is never collected
    // Recorded, not thrown: see the non-fatal note above.
    errors.push(`Temporal evidence: ${err}`);
    console.error(`   ❌ Temporal evidence: ${err}`);
    console.error(`      Has the Step 6 DDL been run? (build_jobs.temporal_declaration, products.temporal_kind)`);
  }
}

async function emitGatePage(config: ProductConfig, filesGenerated: string[], errors: string[]): Promise<void> {
  try {
    const filePath = getGatePagePath(config, APP_ROOT);
    const geo = await fetchGeoBake(config); // transcript + published-video facts (best-effort; null if absent/no DB)
    writeFile(filePath, generateGatePage(config, geo));
    filesGenerated.push(filePath);
    console.log(`   ✅ Gate page\n      → ${relativePath(filePath)}`);
  } catch (err) {
    rethrowIfGuardRefusal(err);   // a guard refusal aborts the run; it is never collected
    const msg = `Gate page: ${err}`;
    errors.push(msg);
    console.error(`   ❌ ${msg}`);
  }
}

function emitProductFiles(config: ProductConfig, filesGenerated: string[], errors: string[]): void {
  try {
    const productFiles = generateAllProductFiles(config);
    for (const { path: filePath, content } of productFiles) {
      const fullPath = path.join(path.dirname(APP_ROOT), filePath);
      writeFile(fullPath, content);
      filesGenerated.push(fullPath);
    }
    console.log(`   ✅ Product files (${config.files.length} files)`);
    config.files.forEach(f => {
      console.log(`      → app/files/${config.country}/${config.id}/${f.slug}/page.tsx`);
    });
  } catch (err) {
    rethrowIfGuardRefusal(err);   // a guard refusal aborts the run; it is never collected
    errors.push(`Product files: ${err}`);
    console.error(`   ❌ Product files: ${err}`);
  }
}

function emitSuccessPages(config: ProductConfig, filesGenerated: string[], errors: string[]): void {
  try {
    const p = getSuccessAssessPath(config, APP_ROOT);
    writeFile(p, generateSuccessAssess(config));
    filesGenerated.push(p);
    console.log(`   ✅ Success page (tier 1 — ${config.tier1.successPath})\n      → ${relativePath(p)}`);
  } catch (err) {
    rethrowIfGuardRefusal(err);   // a guard refusal aborts the run; it is never collected
    errors.push(`Success assess: ${err}`);
    console.error(`   ❌ Success assess: ${err}`);
  }
  try {
    const p = getSuccessPlanPath(config, APP_ROOT);
    writeFile(p, generateSuccessPlan(config));
    filesGenerated.push(p);
    console.log(`   ✅ Success page (tier 2 — ${config.tier2.successPath})\n      → ${relativePath(p)}`);
  } catch (err) {
    rethrowIfGuardRefusal(err);   // a guard refusal aborts the run; it is never collected
    errors.push(`Success plan: ${err}`);
    console.error(`   ❌ Success plan: ${err}`);
  }
}
function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}
function relativePath(absolutePath: string): string {
  return absolutePath.replace(path.join(__dirname, "../../"), "");
}
// ── ENTRY POINT ───────────────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const successOnly  = args.includes("--success-only");
const evidenceOnly = args.includes("--evidence-only");   // TEMPORAL v1 Step 6
const gateOnly     = args.includes("--gate-only");       // R-A2 — per-surface emit
const filesOnly    = args.includes("--files-only");      // R-A2 — per-surface emit
const productId    = args.find(a => !a.startsWith("--"));
if (!productId) {
  console.error("\n❌ Usage: npx ts-node --project cole/tsconfig.json cole/scripts/cole-generate.ts [product-id] [mode]");
  console.error("   Full build:    cole-generate.ts uk-03");
  console.error("                  (REFUSED for an engineNative product — it would overwrite the");
  console.error("                   EngineCalculator wrapper. Use the per-surface modes below.)");
  console.error("   Evidence only: cole-generate.ts au-19-frcgw-clearance-certificate --evidence-only");
  console.error("                  (temporal registry + gate evidence ONLY — regenerates NO page)");
  console.error("   Update emit:   cole-generate.ts au-19-frcgw-clearance-certificate --success-only");
  console.error("                  (regenerates ONLY the success pages — for a migrated/engine-native product)");
  console.error("   Gate only:     cole-generate.ts au-16-superannuation-... --gate-only");
  console.error("                  (regenerates ONLY the gate page)");
  console.error("   Files only:    cole-generate.ts au-16-superannuation-... --files-only");
  console.error("                  (regenerates ONLY the 8 delivered product documents)\n");
  console.error("   Available configs:");
  try {
    fs.readdirSync(CONFIG_DIR)
      .filter(f => f.endsWith(".ts"))
      .forEach(f => console.error(`   · ${f.replace(".ts", "")}`));
  } catch { /* ignore */ }
  process.exit(1);
}
cole(productId, successOnly, evidenceOnly).catch(err => {
  if (isGuardRefusal(err)) {
    // ABORTED, not "completed with errors". Nothing further was written.
    console.error("");
    console.error("=".repeat(70));
    console.error(`🛑 ABORTED BY GUARD — ${err.guard}`);
    console.error("=".repeat(70));
    console.error("");
    console.error(err.message);
    console.error("");
    console.error("No further files were written. The run stopped AT the refusal rather than");
    console.error("collecting it and continuing — the steps AFTER a guard are the destructive");
    console.error("ones (calculator, product files, /api/rules corpus).");
    console.error("");
    process.exit(2);
  }
  console.error(`\n❌ COLE fatal error: ${err}\n`);
  process.exit(1);
});
