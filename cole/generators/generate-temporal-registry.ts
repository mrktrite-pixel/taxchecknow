// ── TEMPORAL REGISTRY GENERATOR (TEMPORAL v1 · Step 6.1/6.2) ─────────────
// Emits lib/temporal-registry.ts from the `temporal` field of every product
// config in cole/config/.
//
// THIS IS THE MECHANISM THAT RETIRES HAND-AUTHORING.
// lib/product-deadlines.ts was a central list maintained by hand, separately
// from the products it described — so it drifted, and held dates that had
// passed. Its replacement is DERIVED: each product states its own behaviour in
// its own config, and this generator collects those statements. The output is
// build artefact, never edited.
//
// It also enforces 6.3 structurally rather than by convention: a config with no
// `temporal` field simply produces no registry entry, so the resolver sees
// UNDECLARED and the product is silent. There is no shape in which a
// non-declaring product can acquire a date from somewhere else.
//
// cole/ is excluded from the app tsconfig, so the app cannot import configs
// directly. This generator is the bridge: configs (build-time) → registry
// (runtime lib).

import * as fs   from "fs";
import * as path from "path";
import type { ProductConfig } from "../types/product-config";
import type { TemporalDeclaration } from "../../lib/temporal-types";

export interface RegistryEntry {
  site:      string;
  productId: string;
  temporal:  TemporalDeclaration;
}

/** Load every config and keep only those that actually declare. */
export function collectDeclarations(configDir: string): RegistryEntry[] {
  // MUST be absolute: require() resolves a relative specifier against THIS
  // module's directory, not the cwd. Passing "./cole/config" silently failed
  // every load and produced an empty registry — which would have unscheduled
  // every declared product without a single error. Resolve, always.
  const dir   = path.resolve(configDir);
  const out: RegistryEntry[] = [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".ts")).sort();
  const failed: string[] = [];

  for (const file of files) {
    let mod: { PRODUCT_CONFIG?: ProductConfig };
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require(path.join(dir, file));
    } catch (err) {
      // One unloadable config is a build problem, not a temporal one — record
      // and carry on so it cannot empty the whole registry.
      failed.push(file);
      console.warn(`[temporal-registry] SKIPPED ${file} — could not load: ${err}`);
      continue;
    }
    const cfg = mod.PRODUCT_CONFIG;
    if (!cfg) continue;
    if (!cfg.temporal) continue;   // UNDECLARED → no entry → silent (6.3)
    out.push({ site: cfg.site, productId: cfg.id, temporal: cfg.temporal });
  }

  // FAIL LOUD ON A TOTAL WIPEOUT. Skipping one config is tolerable; failing to
  // load ANY of them means the loader itself is broken, and emitting an empty
  // registry on that basis would silence every declared product with no error.
  // Refuse to produce a registry we have no evidence for.
  if (files.length > 0 && failed.length === files.length) {
    throw new Error(
      `[temporal-registry] ALL ${files.length} configs failed to load from ${dir} — ` +
      `refusing to emit an empty registry (that would unschedule every declared product). ` +
      `First failure: ${failed[0]}`,
    );
  }
  return out;
}

export function renderRegistry(entries: RegistryEntry[]): string {
  const bySite = new Map<string, RegistryEntry[]>();
  for (const e of entries) {
    const list = bySite.get(e.site) ?? [];
    list.push(e);
    bySite.set(e.site, list);
  }

  const body = [...bySite.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([site, list]) => {
      const inner = list
        .sort((a, b) => a.productId.localeCompare(b.productId))
        .map(e => `    ${JSON.stringify(e.productId)}: ${JSON.stringify(e.temporal, null, 6).replace(/\n/g, "\n    ")},`)
        .join("\n");
      return `  ${JSON.stringify(site)}: {\n${inner}\n  },`;
    })
    .join("\n");

  const declaredCount = entries.length;

  return `// ── TEMPORAL REGISTRY — GENERATED FILE, DO NOT EDIT ──────────────────────
//
// Emitted by cole/generators/generate-temporal-registry.ts from the \`temporal\`
// field of each product config. Hand edits are overwritten on the next
// generator run — change the PRODUCT'S CONFIG, not this file.
//
// A product absent from this registry is UNDECLARED, and an undeclared product
// is SILENT (Step 6.3). Absence is never a fallback to another date; there is
// no code path from "not listed here" to "use some other date".
//
// Declared products: ${declaredCount}
// (Deliberately NOT backfilled from the retired lib/product-deadlines.ts or
// from the deadline-shape survey — ruling 3.5: a declaration is made by the
// product's own build at gate time, never inferred. Each product joins this
// list when it next ships through the \`temporal_declared\` gate item.)

import type { TemporalDeclaration } from "./temporal-types";

export const TEMPORAL_REGISTRY: Record<string, Record<string, TemporalDeclaration>> = {
${body}
};

/** The declaration for a product, or null when undeclared (→ silent). */
export function lookupTemporal(site: string, productId: string): TemporalDeclaration | null {
  return TEMPORAL_REGISTRY[site]?.[productId] ?? null;
}

/** Every declared (site, productId) pair — used by the gate evidence writer. */
export function declaredProducts(): Array<{ site: string; productId: string }> {
  return Object.entries(TEMPORAL_REGISTRY).flatMap(([site, products]) =>
    Object.keys(products).map(productId => ({ site, productId })),
  );
}
`;
}

export function getTemporalRegistryPath(appRoot: string): string {
  return path.join(appRoot, "lib", "temporal-registry.ts");
}

/** Full emit. Returns the entries written so the caller can log/report them. */
export function generateTemporalRegistry(configDir: string, appRoot: string): RegistryEntry[] {
  const entries = collectDeclarations(configDir);
  const target  = getTemporalRegistryPath(appRoot);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, renderRegistry(entries), "utf8");
  return entries;
}
