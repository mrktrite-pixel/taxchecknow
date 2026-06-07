// Records a LIVE calculator (mobile 9:16) as a screen-demo clip for the GOAT
// Shorts demo template. playwright-core → webm → ffmpeg-static → mp4 (1080x1920).
// Clicks a dramatic answer path with human pacing, ending ON the verdict.
//
// PARAMETERIZED (v2): pick the product by CLI slug, looked up in CONFIGS below.
//   node scripts/record-calc-demo.mjs <slug>
//   node scripts/record-calc-demo.mjs frcgw-clearance-certificate
// Each config = { url, answers:[RegExp per step button], out, stepWaitMs?, dwellMs? }.
// Dark-canvas CSS + dsf-1 recording rules carry over for every product.
import { chromium } from "playwright-core";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, "..", "public", "shorts");
const TMP = join(DIR, "..", ".tmp-rec");
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

// ── Product registry ────────────────────────────────────────────────────────
const CONFIGS = {
  "183-day-rule": {
    url: "https://www.taxchecknow.com/nomad/check/183-day-rule",
    // UK sufficient-ties trap → "UK RESIDENT" verdict (6 steps).
    answers: [
      /United Kingdom/i, /16 to 45/i, /4\+ ties/i,
      /own or rent a property/i, /All in the country I am leaving/i, /just stopped filing/i,
    ],
    out: "calc-demo-183-v2.mp4",
    stepWaitMs: 2500,
    dwellMs: 3800,
  },
  "super-death-tax-trap": {
    url: "https://www.taxchecknow.com/au/check/super-death-tax-trap",
    // Max double-tax trap: adult kids inherit, >$5M, >90% taxable, age 75+ ->
    // death tax + Div 296 verdict. NB step 4 (partner-dies-first) is showIf
    // spouse/mixed only, so it's auto-skipped for adult_kids — 5 clicks.
    answers: [
      /Adult children/i,        // beneficiaries (17% tax)
      /Over \$5M/i,             // TSB band — full double tax
      /Over 90/i,               // taxable % — max exposure
      /75 or over/i,            // age (step 5; step 4 auto-skipped)
      /never been discussed/i,  // accountant aware: No
    ],
    out: "calc-demo-superdeath-v1.mp4",
    stepWaitMs: 2800,
    dwellMs: 6500,
  },
  "tax-treaty-navigator": {
    url: "https://www.taxchecknow.com/nomad/check/tax-treaty-navigator",
    // Dual UK/AU residency that exhausts all 4 tie-breaker tests → Test 5
    // "MUTUAL AGREEMENT PROCEDURE REQUIRED — MAP 2-3 years — HIGH". country_a +
    // country_b share option labels on step 1, so country_b uses nth:1.
    answers: [
      /United Kingdom/i,               // country_a (1st occurrence)
      { name: /Australia/i, nth: 1 },  // country_b (2nd occurrence)
      /Permanent home in BOTH/i,       // Test 1 — not resolved
      /Ties split/i,                   // Test 2 — not resolved
      /Roughly equal time/i,           // Test 3 — not resolved
      /National of BOTH/i,             // Test 4 (nationality) — not resolved
      /I know a treaty exists/i,       // step 6 treaty_status → Test 5 MAP verdict
    ],
    out: "calc-demo-treaty-v1.mp4",
    // 7 clicks — pace tighter so the verdict reveals before the demo template's
    // ~22s window (seek 2.5 + 19.5s scene).
    stepWaitMs: 2200,
    dwellMs: 6000,
  },
  "frcgw-clearance-certificate": {
    url: "https://www.taxchecknow.com/au/check/frcgw-clearance-certificate",
    // Most dramatic path → VERDICT 3 "CRITICAL: SETTLEMENT IN LESS THAN 28 DAYS":
    // $1.5M+ sale ($300k withheld), AU resident, not applied, <14 days (4 steps).
    answers: [
      /Over \$1\.5M/i,
      /Australian resident for tax/i,
      /Not applied yet/i,
      /Less than 14 days/i,
    ],
    out: "calc-demo-frcgw-v1.mp4",
    // 4 steps → pace slower so the clip lands ~22s (matches the demo template's
    // d2=19.5 + 2.5s seek). The verdict reveal must hold long enough to read.
    stepWaitMs: 3500,
    dwellMs: 6000,
  },
};

const slug = process.argv[2] || "frcgw-clearance-certificate";
const cfg = CONFIGS[slug];
if (!cfg) {
  console.error(`Unknown slug "${slug}". Known: ${Object.keys(CONFIGS).join(", ")}`);
  process.exit(1);
}

function ff(args) {
  return new Promise((res, rej) => {
    const p = spawn(ffmpegPath, args);
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", rej);
    p.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg exit " + c + ": " + err.slice(-300)))));
  });
}

async function launchBrowser() {
  const tries = [
    { headless: true, channel: "chrome" },
    { headless: true, executablePath: "C:/Users/MATTV/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe" },
    { headless: true, channel: "msedge" },
  ];
  for (const opts of tries) {
    try {
      return await chromium.launch(opts);
    } catch (e) {
      console.log("launch failed:", opts.channel ?? opts.executablePath, "—", String(e.message).slice(0, 80));
    }
  }
  throw new Error("no launchable browser");
}

async function main() {
  console.log(`recording ${slug} → ${cfg.out}`);
  const browser = await launchBrowser();
  // recordVideo size MUST equal the CSS viewport (dsf 1) — a deviceScaleFactor!=1
  // with a larger recordVideo size makes playwright composite the page in the top
  // portion + gray-pad the rest. Record clean 540x960, then ffmpeg upscales to 1080x1920.
  const ctx = await browser.newContext({
    viewport: { width: 540, height: 960 },
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: TMP, size: { width: 540, height: 960 } },
  });
  const page = await ctx.newPage();
  await page.goto(cfg.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1800); // settle hero
  // dismiss the cookie-consent bar so it doesn't sit in the demo frame
  await page.getByRole("button", { name: /^Accept/i }).first().click({ timeout: 4000 }).catch(() => {});
  // Dark canvas — paint the page bg the template's #0D0D0F and isolate the
  // calculator (hide marketing sections that don't contain #calculator) so the
  // card reads as a device shot floating on the goat-dark background.
  await page.addStyleTag({
    content: [
      "html,body{background:#0D0D0F !important;min-height:100vh !important}",
      "section:not(:has(#calculator)){display:none !important}",
    ].join("\n"),
  });
  await page.waitForTimeout(700);

  for (const a of cfg.answers) {
    // answer = RegExp (click first match) OR { name, nth } when a step has
    // duplicate labels (e.g. treaty's country_a + country_b share option lists).
    const name = a instanceof RegExp ? a : a.name;
    const nth = a instanceof RegExp ? 0 : (a.nth ?? 0);
    const btn = page.getByRole("button", { name }).nth(nth);
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await btn.click({ timeout: 8000 }).catch((e) => console.log("click miss:", String(name), e.message));
    await page.waitForTimeout(cfg.stepWaitMs); // human pacing + 300ms auto-advance
  }
  await page.waitForTimeout(cfg.dwellMs); // dwell on the verdict reveal

  const video = page.video();
  await ctx.close(); // finalizes the webm
  await browser.close();
  const webm = await video.path();

  const mp4 = join(OUT, cfg.out);
  await ff(["-y", "-i", webm, "-vf", "scale=1080:1920", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-an", "-movflags", "+faststart", mp4]);
  console.log("MP4 written:", mp4);
}
main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
