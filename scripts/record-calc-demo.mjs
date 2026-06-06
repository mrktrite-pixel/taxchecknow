// Records the LIVE 183-day calculator (mobile 9:16) as a screen-demo clip for the
// GOAT Shorts demo template. playwright-core → webm → ffmpeg-static → mp4 (1080x1920).
// Clicks the UK "still resident" trap path with human pacing, ending on the verdict.
// Output: public/shorts/calc-demo-183.mp4 . Run: node scripts/record-calc-demo.mjs
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

const URL = "https://www.taxchecknow.com/nomad/check/183-day-rule";
// UK sufficient-ties trap → "UK RESIDENT" verdict (dramatic, on-message).
const ANSWERS = [
  /United Kingdom/i,
  /16 to 45/i,
  /4\+ ties/i,
  /own or rent a property/i,
  /All in the country I am leaving/i,
  /just stopped filing/i,
];

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
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1800); // settle hero
  // dismiss the cookie-consent bar so it doesn't sit in the demo frame
  await page.getByRole("button", { name: /^Accept/i }).first().click({ timeout: 4000 }).catch(() => {});
  // Fix A: dark canvas — the calculator content is shorter than the viewport at most
  // steps, so the page bg below it showed gray. Paint it the template's #0D0D0F so the
  // card reads as a device shot floating on the goat-dark background.
  await page.addStyleTag({
    content: [
      "html,body{background:#0D0D0F !important;min-height:100vh !important}",
      // isolate the calculator: hide marketing sections that don't contain it,
      // so the area below the card is the dark canvas, not light page panels.
      "section:not(:has(#calculator)){display:none !important}",
    ].join("\n"),
  });
  await page.waitForTimeout(700);

  for (const a of ANSWERS) {
    const btn = page.getByRole("button", { name: a }).first();
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await btn.click({ timeout: 8000 }).catch((e) => console.log("click miss:", String(a), e.message));
    await page.waitForTimeout(2500); // human pacing + 300ms auto-advance
  }
  await page.waitForTimeout(3800); // dwell on the verdict reveal

  const video = page.video();
  await ctx.close(); // finalizes the webm
  await browser.close();
  const webm = await video.path();

  const mp4 = join(OUT, "calc-demo-183-v2.mp4"); // new filename — never reuse a cached asset URL
  await ff(["-y", "-i", webm, "-vf", "scale=1080:1920", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-an", "-movflags", "+faststart", mp4]);
  console.log("MP4 written:", mp4);
}
main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
