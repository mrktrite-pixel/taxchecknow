// Assets-as-code for the GOAT Shorts template "goat-dark-v1".
// SVG -> PNG via sharp, written to /public/shorts/ (live on taxchecknow.com).
// Flat UI, exact hexes; the only gradients are the two ruled glows
// (hook radial amber + danger vignette). Regenerate: node scripts/gen-shorts-assets.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "shorts");
mkdirSync(OUT, { recursive: true });

const W = 1080, H = 1920;
const BASE = "#0D0D0F", AMBER = "#F5A623", CARD = "#1A1A20", RED = "#E0241B", NAVY = "#0F1A2E", WHITE = "#FFFFFF";

const svg = (inner, opts = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${
    opts.base ? `<rect width="${W}" height="${H}" fill="${opts.base}"/>` : ""
  }${inner}</svg>`;

const assets = {
  // 1. Hook scene background — base + radial amber bloom (glow #1)
  "hook-glow-bg": svg(
    `<defs><radialGradient id="g" cx="50%" cy="33%" r="58%">
       <stop offset="0%" stop-color="${AMBER}" stop-opacity="0.55"/>
       <stop offset="50%" stop-color="${AMBER}" stop-opacity="0.13"/>
       <stop offset="100%" stop-color="${BASE}" stop-opacity="0"/>
     </radialGradient></defs>
     <rect width="${W}" height="${H}" fill="url(#g)"/>`,
    { base: BASE },
  ),

  // 2. Myth card — panel + red MYTH badge + the fixed wrong-belief header (transparent bg)
  "myth-card": svg(
    `<text x="${W / 2}" y="512" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="44" fill="${WHITE}">AI tools and Google get this wrong:</text>
     <rect x="110" y="600" width="860" height="760" rx="28" fill="${CARD}"/>
     <rect x="150" y="560" width="230" height="92" rx="22" fill="${RED}"/>
     <text x="265" y="624" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="56" fill="${WHITE}" letter-spacing="8">MYTH</text>`,
  ),

  // 3. Red diagonal slash overlay (transparent)
  "slash-overlay": svg(
    `<line x1="150" y1="1320" x2="970" y2="600" stroke="${RED}" stroke-width="34" stroke-linecap="round" opacity="0.92"/>`,
  ),

  // 4. Official document card — navy header bar + monospace area (transparent)
  "doc-card": svg(
    `<rect x="120" y="620" width="840" height="700" rx="22" fill="#15151B" stroke="#2A2A33" stroke-width="2"/>
     <path d="M120 642 a22 22 0 0 1 22 -22 h796 a22 22 0 0 1 22 22 v98 h-840 z" fill="${NAVY}"/>
     <text x="160" y="700" font-family="monospace" font-weight="700" font-size="34" fill="#7FA8D8">// OFFICIAL SOURCE</text>
     <rect x="160" y="800" width="760" height="3" fill="#2A2A33"/>
     <rect x="160" y="880" width="640" height="3" fill="#2A2A33"/>
     <rect x="160" y="960" width="700" height="3" fill="#2A2A33"/>`,
  ),

  // 5. Danger consequence background — base + red vignette (glow #2)
  "danger-vignette-bg": svg(
    `<defs><radialGradient id="v" cx="50%" cy="50%" r="72%">
       <stop offset="0%" stop-color="${BASE}" stop-opacity="0"/>
       <stop offset="60%" stop-color="${BASE}" stop-opacity="0"/>
       <stop offset="100%" stop-color="${RED}" stop-opacity="0.42"/>
     </radialGradient></defs>
     <rect width="${W}" height="${H}" fill="url(#v)"/>`,
    { base: BASE },
  ),

  // 6. Amber warning triangle with ! (transparent)
  "warning-triangle": svg(
    `<path d="M540 720 L832 1196 a26 26 0 0 1 -22 40 H252 a26 26 0 0 1 -22 -40 Z" fill="${AMBER}"/>
     <text x="540" y="1150" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="240" fill="${BASE}">!</text>`,
  ),

  // 7. CTA card — dark panel with amber border (transparent)
  "cta-card": svg(
    `<rect x="130" y="720" width="820" height="480" rx="32" fill="${CARD}" stroke="${AMBER}" stroke-width="6"/>`,
  ),
};

const main = async () => {
  for (const [name, body] of Object.entries(assets)) {
    const file = join(OUT, `${name}.png`);
    await sharp(Buffer.from(body)).png().toFile(file);
    console.log(`wrote ${name}.png`);
  }
  console.log("done →", OUT);
};
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
