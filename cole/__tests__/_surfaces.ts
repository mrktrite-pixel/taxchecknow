// ─────────────────────────────────────────────────────────────────────────────
// COLE snapshot suite — the SURFACE MANIFEST.
//
// ONE source of truth for: which generated surfaces exist, which are currently
// snapshotted, which products are DELIBERATELY excluded from a surface, and what
// each snapshot file is called.
//
// Both the per-surface snapshot tests AND the orphan check import this. That is
// the whole point: if the expected-path list lived in the tests and the orphan
// check recomputed it, the two would drift and the check would start lying.
//
// WHY THE EXCLUSIONS ARE DATA AND NOT COMMENTS: two surfaces are legitimately
// ungenerated for some products, and a snapshot suite that cannot express that
// would either report them permanently missing or silently accept a snapshot of
// a surface the generator REFUSES to emit. Both are worse than useless.
//   · calculator   — an engineNative product's calculator is a HAND-BUILT
//                    EngineCalculator wrapper. generate-calculator throws a
//                    GuardRefusal for it. There is no generator output to lock.
//   · rules-route  — a product with corpusAuthored: "hand" owns its own corpus.
//                    generate-rules-route skips it. Same reasoning.
// For an excluded product the snapshot must be ABSENT, and its PRESENCE is a
// failure — it would mean someone snapshotted a refused surface.
// ─────────────────────────────────────────────────────────────────────────────
import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

// The generators import each other WITHOUT file extensions, which Node's native
// ESM loader rejects. Loading them through a CJS require (with ts-node
// registered, TS_NODE_PROJECT=cole/tsconfig.json) resolves the graph exactly as
// cole-generate.ts does. See cole/scripts/snap-tests.mjs.
export const req = createRequire(import.meta.url);

/** Directory of THIS file, usable on win32 (strips the leading slash off /C:/…). */
export const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
export const COLE_ROOT = path.join(HERE, "..");
export const CONFIG_DIR = path.join(COLE_ROOT, "config");
export const SNAP_DIR = path.join(HERE, "__snapshots__");

export interface LoadedConfig {
  file: string;   // "au-19-frcgw-clearance-certificate"
  id: string;     // config.id — the snapshot filename stem
  config: any;
}

/** Every product config, loaded once. Throws if the directory is missing rather
 *  than returning [] — an empty list would make every check vacuously pass. */
export function loadConfigs(): LoadedConfig[] {
  if (!fs.existsSync(CONFIG_DIR)) {
    throw new Error(`[snapshot suite] config dir missing: ${CONFIG_DIR} — refusing to report a vacuous pass`);
  }
  const files = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith(".ts"));
  if (files.length === 0) throw new Error(`[snapshot suite] no configs found in ${CONFIG_DIR}`);
  return files.map(f => {
    const mod = req(path.join(CONFIG_DIR, f));
    const config = mod.PRODUCT_CONFIG;
    if (!config?.id) throw new Error(`[snapshot suite] ${f} does not export PRODUCT_CONFIG.id`);
    return { file: f.replace(/\.ts$/, ""), id: config.id, config };
  });
}

export interface Surface {
  /** Snapshot filename segment: <product-id>.<key>.snap */
  key: string;
  /** Is this surface snapshotted YET? Sequencing ruling: success pages only for now. */
  enabled: boolean;
  /** True when this product legitimately has NO generated output for this surface. */
  excluded: (config: any) => boolean;
  /** Why, for the failure message when an excluded snapshot turns up anyway. */
  exclusionReason: string;
}

export const SURFACES: Surface[] = [
  {
    key: "gate",
    enabled: false,
    excluded: () => false,
    exclusionReason: "",
  },
  {
    key: "calculator",
    enabled: false,
    excluded: c => c.engineNative === true,
    exclusionReason: 'engineNative: the calculator is a hand-built EngineCalculator wrapper and generate-calculator refuses it (R-A2 guard)',
  },
  {
    key: "success-assess",
    enabled: true,
    excluded: () => false,
    exclusionReason: "",
  },
  {
    key: "success-plan",
    enabled: true,
    excluded: () => false,
    exclusionReason: "",
  },
  {
    key: "product-files",
    enabled: false,
    excluded: () => false,
    exclusionReason: "",
  },
  {
    key: "rules-route",
    enabled: false,
    excluded: c => c.corpusAuthored === "hand",
    exclusionReason: 'corpusAuthored: "hand" — the product owns its corpus and generate-rules-route skips it',
  },
];

export function snapshotPath(productId: string, surfaceKey: string): string {
  return path.join(SNAP_DIR, `${productId}.${surfaceKey}.snap`);
}

/** Store the generated page VERBATIM so the .snap is the .tsx a reviewer reads. */
export const verbatim = [(v: unknown) => String(v)];

export interface Expectation {
  productId: string;
  surface: string;
  file: string;      // basename
  /** "expected" = a snapshot must exist. "forbidden" = it must NOT exist. */
  state: "expected" | "forbidden";
  reason: string;
}

/**
 * The complete expected shape of __snapshots__/ for the CURRENTLY ENABLED
 * surfaces — including which files are forbidden.
 *
 * Disabled surfaces contribute NOTHING in either direction: not expected (they
 * are not generated yet) and not forbidden (so enabling one is a normal
 * additive change, not a hygiene failure).
 */
export function expectations(configs = loadConfigs()): Expectation[] {
  const out: Expectation[] = [];
  for (const s of SURFACES) {
    if (!s.enabled) continue;
    for (const c of configs) {
      const file = `${c.id}.${s.key}.snap`;
      if (s.excluded(c.config)) {
        out.push({ productId: c.id, surface: s.key, file, state: "forbidden", reason: s.exclusionReason });
      } else {
        out.push({ productId: c.id, surface: s.key, file, state: "expected", reason: "" });
      }
    }
  }
  return out;
}
