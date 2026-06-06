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
  const ctx = await browser.newContext({
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: TMP, size: { width: 1080, height: 1920 } },
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1800); // settle hero
  // dismiss the cookie-consent bar so it doesn't sit in the demo frame
  await page.getByRole("button", { name: /^Accept/i }).first().click({ timeout: 4000 }).catch(() => {});
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

  const mp4 = join(OUT, "calc-demo-183.mp4");
  await ff(["-y", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-an", "-movflags", "+faststart", mp4]);
  console.log("MP4 written:", mp4);
}
main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
