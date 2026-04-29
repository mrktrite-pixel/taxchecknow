// ─────────────────────────────────────────────────────────────────────────────
// Extract product summary from every cole/config/*.ts and write PRODUCTS.md
// Usage: npx ts-node --project cole/tsconfig.json cole/scripts/extract-products.ts
//
// Fear numbers are sourced from cole-marketing/CHARACTERS.md (canonical
// per-character "Fear Numbers (by product)" blocks) via the FEAR_OVERRIDES map
// below. Falls back to first $/£/€ amount in answerBody[0] if not in the map.
// ─────────────────────────────────────────────────────────────────────────────
import * as fs   from "fs";
import * as path from "path";
import type { ProductConfig } from "../types/product-config";

const CONFIG_DIR = path.join(__dirname, "../config");

const TARGETS = [
  path.join("C:/Users/MATTV/CitationGap/cole-marketing", "PRODUCTS.md"),
  path.join("C:/Users/MATTV/CitationGap/cole-marketing/.claude/skills/cole-products", "PRODUCTS.md"),
];

// ── CHARACTER ASSIGNMENT (by filename prefix) ────────────────────────────────
const SUPER_FILES = new Set([
  "au-11-bring-forward-window.ts",
  "au-12-super-death-tax-trap.ts",
  "au-13-div296-wealth-eraser.ts",
  "au-14-super-to-trust-exit.ts",
  "au-15-transfer-balance-cap.ts",
]);

function characterFor(filename: string): string {
  if (filename.startsWith("au-")) {
    return SUPER_FILES.has(filename) ? "Gary (Andrew Chen for super-specific framing)" : "Gary";
  }
  if (filename.startsWith("uk-"))    return "James";
  if (filename.startsWith("us-"))    return "Tyler";
  if (filename.startsWith("nz-"))    return "Aroha";
  if (filename.startsWith("can-"))   return "Fraser";
  if (filename.startsWith("nomad-")) return "Priya";
  return "Unknown";
}

// ── REGION GROUPING (by filename prefix) ─────────────────────────────────────
const REGION_ORDER = ["AUSTRALIA", "UNITED KINGDOM", "UNITED STATES", "CANADA", "NEW ZEALAND", "NOMAD"] as const;
type Region = typeof REGION_ORDER[number];

function regionFor(filename: string): Region {
  if (filename.startsWith("au-"))    return "AUSTRALIA";
  if (filename.startsWith("uk-"))    return "UNITED KINGDOM";
  if (filename.startsWith("us-"))    return "UNITED STATES";
  if (filename.startsWith("can-"))   return "CANADA";
  if (filename.startsWith("nz-"))    return "NEW ZEALAND";
  if (filename.startsWith("nomad-")) return "NOMAD";
  return "NOMAD";
}

// ── FEAR NUMBER OVERRIDES (sourced from cole-marketing/CHARACTERS.md) ────────
// Keyed by config filename without the .ts extension. These are the curated
// per-character fear numbers that appear in CHARACTERS.md under each
// character's "Fear Numbers (by product)" block.
const FEAR_OVERRIDES: Record<string, string> = {
  // ── AU (15) — Gary Mitchell ────────────────────────────────────────────────
  "au-01-cgt-main-residence-trap":              "$47,000",
  "au-02-division-7a-loan-trap":                  "$28,000",
  "au-03-fbt-hidden-exposure":                     "$14,500",
  "au-04-cgt-discount-timing-sniper":               "$9,200",
  "au-05-negative-gearing-illusion":                  "$3,800/year",
  "au-06-small-business-cgt-concessions":              "$130,000",
  "au-07-instant-asset-write-off":                       "$18,700",
  "au-08-gst-registration-trap":                            "$22,000",
  "au-09-rental-property-deduction-audit":                    "$6,400/year",
  "au-10-medicare-levy-surcharge-trap":                          "$3,200/year",
  "au-11-bring-forward-window":                                    "$110,000",
  "au-12-super-death-tax-trap":                                       "$84,000",
  "au-13-div296-wealth-eraser":                                          "$47,000/year",
  "au-14-super-to-trust-exit":                                              "$220,000",
  "au-15-transfer-balance-cap":                                                "$36,000",

  // ── UK (6) — James Hartley ─────────────────────────────────────────────────
  "uk-01-mtd-scorecard":            "£400/quarter",
  "uk-02-allowance-sniper":          "£6,750",
  "uk-03-digital-link-auditor":       "£200/quarter",
  "uk-04-side-hustle-checker":          "£3,400",
  "uk-05-dividend-trap":                  "£8,200/year",
  "uk-06-pension-iht-trap":                 "£240,000",

  // ── US (5) — Tyler Brooks ──────────────────────────────────────────────────
  "us-01-section-174-auditor":   "$340,000",
  "us-02-feie-nomad-auditor":     "$42,000",
  "us-03-qsbs-exit-auditor":       "$180,000",
  "us-04-iso-amt-sniper":            "$67,000",
  "us-05-wayfair-nexus-sniper":       "$94,000",

  // ── CAN (5) — Fraser MacDonald ─────────────────────────────────────────────
  "can-01-departure-tax-trap":                  "$67,000 CAD",
  "can-02-non-resident-landlord-withholding":    "$8,400 CAD/year",
  "can-03-property-flipping-tax-trap":             "$38,000 CAD",
  "can-04-amt-shock-auditor":                        "$34,000 CAD",
  "can-05-eot-exit-optimizer":                         "$180,000 CAD",

  // ── NZ (5) — Aroha Tane ────────────────────────────────────────────────────
  "nz-01-bright-line-auditor":             "$49,500 NZD",
  "nz-02-app-tax-gst-sniper":                "$8,400 NZD/year",
  "nz-03-interest-reinstatement-engine":      "$14,200 NZD/year",
  "nz-04-trust-tax-splitter":                    "$18,600 NZD/year",
  "nz-05-investment-boost-auditor":                "$22,000 NZD",

  // ── NOMAD (10) — Priya Sharma ──────────────────────────────────────────────
  // Some are qualitative (no $) — CHARACTERS.md uses tax-position descriptions.
  "nomad-01-residency-risk-index":          "Tax resident in 2 countries",
  "nomad-02-tax-treaty-navigator":            "$34,000 AUD",
  "nomad-03-183-day-rule":                     "47 days + 4 UK ties = UK resident",
  "nomad-04-exit-tax-trap":                      "$28,000 AUD",
  "nomad-05-uk-residency":                         "16 days + 5 UK ties = UK resident",
  "nomad-06-uk-nrls":                                "£8,400 GBP",
  "nomad-07-au-expat-cgt":                             "$41,000 AUD",
  "nomad-08-us-expat-tax":                                "$23,000 USD",
  "nomad-09-au-smsf-residency":                              "45% tax on full SMSF balance",
  "nomad-10-spain-beckham-eligibility":                         "24% flat vs 47% top rate",
};

// ── FALLBACK: extract from answerBody[0] ─────────────────────────────────────
function extractFearFromAnswerBody(answerBody: string[] | undefined): string {
  if (!answerBody || answerBody.length === 0) return "";
  const first = answerBody[0];
  const re = /[$£€][\d][\d,]*(?:\.\d+)?(?:\s+(?:million|billion|thousand|k|m|M|K))?/;
  const m = first.match(re);
  return m ? m[0] : "";
}

// ── DESCRIPTION ──────────────────────────────────────────────────────────────
function extractDescription(cfg: ProductConfig): string {
  if (cfg.answerHeadline && cfg.answerHeadline.trim().length > 0) {
    return cfg.answerHeadline.trim();
  }
  const body = cfg.answerBody?.[0] ?? "";
  const firstSentence = body.split(/\.\s/)[0];
  return firstSentence ? firstSentence.trim() + "." : "";
}

function extractUrl(cfg: ProductConfig): string {
  const slug = cfg.slug ?? `${cfg.country}/check/${cfg.id}`;
  return slug.startsWith("/") ? slug : `/${slug}`;
}

function extractProductKey(cfg: ProductConfig, filename: string): string {
  return cfg.tier1?.productKey ?? filename.replace(/\.ts$/, "");
}

// ── ROW MODEL ────────────────────────────────────────────────────────────────
interface Row {
  filename:    string;
  productKey:  string;
  name:        string;
  fearNumber:  string;
  fearSource:  "CHARACTERS.md" | "answerBody[0]" | "missing";
  description: string;
  url:         string;
  authority:   string;
  country:     string;
  character:   string;
  region:      Region;
  missing:     string[];
}

function processConfig(filename: string): Row {
  const filepath = path.join(CONFIG_DIR, filename);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(filepath);
  const cfg: ProductConfig = mod.PRODUCT_CONFIG;
  const missing: string[] = [];

  const stem = filename.replace(/\.ts$/, "");

  const productKey = extractProductKey(cfg, filename);
  const name       = cfg.name ?? "";
  if (!name) missing.push("name");

  let fearNumber = "";
  let fearSource: Row["fearSource"] = "missing";
  if (FEAR_OVERRIDES[stem]) {
    fearNumber = FEAR_OVERRIDES[stem];
    fearSource = "CHARACTERS.md";
  } else {
    const fromBody = extractFearFromAnswerBody(cfg.answerBody);
    if (fromBody) {
      fearNumber = fromBody;
      fearSource = "answerBody[0]";
    } else {
      missing.push("fear_number (no override + no $/£/€ in answerBody[0])");
    }
  }

  const description = extractDescription(cfg);
  if (!description) missing.push("description");

  const url = extractUrl(cfg);
  if (!cfg.slug) missing.push("slug");

  const authority = cfg.lawBarBadges?.[0] ?? cfg.authority ?? "";
  if (!authority) missing.push("authority/lawBarBadges[0]");

  const country = cfg.market ?? "";
  if (!country) missing.push("market");

  return {
    filename,
    productKey,
    name,
    fearNumber,
    fearSource,
    description,
    url,
    authority,
    country,
    character: characterFor(filename),
    region:    regionFor(filename),
    missing,
  };
}

function formatRow(r: Row): string {
  return [
    `### ${r.productKey} | ${r.name}`,
    `  Fear: ${r.fearNumber} — ${r.description}`,
    `  URL:  ${r.url}`,
    `  Auth: ${r.authority}`,
    `  Char: ${r.character}`,
  ].join("\n");
}

function main() {
  const files = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith(".ts")).sort();
  const rows: Row[] = [];
  const errors: { filename: string; error: string }[] = [];

  for (const f of files) {
    try {
      rows.push(processConfig(f));
    } catch (err) {
      errors.push({ filename: f, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Group by filename-prefix region
  const groups: Record<Region, Row[]> = {
    "AUSTRALIA": [], "UNITED KINGDOM": [], "UNITED STATES": [],
    "CANADA":     [], "NEW ZEALAND":      [], "NOMAD":            [],
  };
  for (const r of rows) groups[r.region].push(r);

  // Markdown
  const lines: string[] = [];
  lines.push(`# COLE Products`);
  lines.push(``);
  lines.push(`Generated from cole/config/*.ts on ${new Date().toISOString().split("T")[0]}.`);
  lines.push(`Total products: ${rows.length}`);
  lines.push(`Fear numbers sourced from cole-marketing/CHARACTERS.md.`);
  lines.push(``);

  for (const region of REGION_ORDER) {
    const g = groups[region];
    if (g.length === 0) continue;
    lines.push(`---`);
    lines.push(``);
    lines.push(`## ${region} (${g.length})`);
    lines.push(``);
    for (const r of g) {
      lines.push(formatRow(r));
      lines.push(``);
    }
  }

  const withMissing = rows.filter(r => r.missing.length > 0);
  if (withMissing.length > 0 || errors.length > 0) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`## Issues`);
    lines.push(``);
    if (withMissing.length > 0) {
      lines.push(`### Configs missing required fields`);
      lines.push(``);
      for (const r of withMissing) {
        lines.push(`- **${r.filename}** — ${r.missing.join("; ")}`);
      }
      lines.push(``);
    }
    if (errors.length > 0) {
      lines.push(`### Configs that failed to parse`);
      lines.push(``);
      for (const e of errors) {
        lines.push(`- **${e.filename}** — ${e.error}`);
      }
      lines.push(``);
    }
  }

  const md = lines.join("\n");

  for (const target of TARGETS) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, md, "utf8");
    console.log(`Wrote ${target} (${md.length} bytes)`);
  }

  // Console summary
  const fearFromCharacters = rows.filter(r => r.fearSource === "CHARACTERS.md").length;
  const fearFromBody       = rows.filter(r => r.fearSource === "answerBody[0]").length;
  const fearMissing         = rows.filter(r => r.fearSource === "missing").length;

  console.log(`\nSummary:`);
  console.log(`  Total products:           ${rows.length}`);
  console.log(`  Failed to parse:           ${errors.length}`);
  console.log(`  Fear from CHARACTERS.md:    ${fearFromCharacters}`);
  console.log(`  Fear from answerBody[0]:     ${fearFromBody}`);
  console.log(`  Fear missing:                 ${fearMissing}`);
  console.log(`  Configs with any missing field: ${withMissing.length}`);

  console.log(`\nBy region:`);
  for (const region of REGION_ORDER) {
    console.log(`  ${region.padEnd(18)} ${groups[region].length}`);
  }
}

main();
