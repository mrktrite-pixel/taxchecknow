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
import type { NurtureLane } from "../../lib/nurture-types";
import { validateNurtureLane } from "../../lib/nurture-types";
import { NURTURE_MILESTONES_WITH_COPY } from "../../lib/email-templates/index";

export interface RegistryEntry {
  site:      string;
  productId: string;
  /** Step 6 — absent when the product declares only a nurture lane. */
  temporal?: TemporalDeclaration;
  /** Step 7 — absent when the product declares no nurture track. A LIST: one track per anchor. */
  nurture?:  NurtureLane;
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
    // A product earns an entry by declaring EITHER lane. Declaring neither means
    // UNDECLARED on both, which means silent on both (6.3 / 7.1) — there is no
    // default track and no default deadline.
    if (!cfg.temporal && !cfg.nurture) continue;

    // Step 7.3 — validate the cadence at EMIT, where a human is watching, rather
    // than at send time where a bad milestone becomes a queued row that can never
    // render. Shape first (canonical), then copy availability (site-side, because
    // the templates live here).
    if (cfg.nurture) {
      // List-level rules first (one track per anchor, unique names), then each
      // track's own shape — validateNurtureLane does both.
      const problems = validateNurtureLane(cfg.nurture);
      // Copy availability is PER TRACK, so a product can have one valid track and
      // one invalid one and be told exactly which.
      cfg.nurture.forEach((t, i) => {
        const missingCopy = (t.milestones ?? []).filter(m => !NURTURE_MILESTONES_WITH_COPY.includes(m));
        if (missingCopy.length > 0) {
          problems.push(
            `track[${i}] (${t.track}): no copy for milestone(s) ${missingCopy.join(", ")} — templates exist for ` +
            `${NURTURE_MILESTONES_WITH_COPY.join(", ")}. Write the copy first (separate work); ` +
            `queueing a milestone with no template would create a row that can never render.`,
          );
        }
      });
      if (problems.length > 0) {
        throw new Error(
          `[temporal-registry] INVALID nurture declaration in ${file} (${cfg.id}):\n` +
          problems.map(p => `    · ${p}`).join("\n"),
        );
      }
    }

    out.push({
      site: cfg.site, productId: cfg.id,
      ...(cfg.temporal ? { temporal: cfg.temporal } : {}),
      ...(cfg.nurture  ? { nurture:  cfg.nurture  } : {}),
    });
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
        .map(e => {
          const body = {
            ...(e.temporal ? { temporal: e.temporal } : {}),
            ...(e.nurture  ? { nurture:  e.nurture  } : {}),
          };
          return `    ${JSON.stringify(e.productId)}: ${JSON.stringify(body, null, 6).replace(/\n/g, "\n    ")},`;
        })
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
import type { NurtureLane, NurtureAnchor } from "./nurture-types";
import { tracksForAnchor } from "./nurture-types";

/** Both lanes for a product. Either may be absent; absent = silent on that lane. */
export interface ProductDeclarations {
  temporal?: TemporalDeclaration;
  /** A LIST of tracks — at most one per anchor (enforced at emit). */
  nurture?:  NurtureLane;
}

export const TEMPORAL_REGISTRY: Record<string, Record<string, ProductDeclarations>> = {
${body}
};

/** The temporal declaration for a product, or null when undeclared (→ silent). */
export function lookupTemporal(site: string, productId: string): TemporalDeclaration | null {
  return TEMPORAL_REGISTRY[site]?.[productId]?.temporal ?? null;
}

/** Every nurture track for a product ([] when it declares none → no nurture). */
export function lookupNurture(site: string, productId: string): NurtureLane {
  return TEMPORAL_REGISTRY[site]?.[productId]?.nurture ?? [];
}

/**
 * The tracks a given path owns. THIS is what makes double-firing impossible:
 * /api/leads asks for "lead" and the webhook asks for "purchase", so neither can
 * queue the other's track no matter what a product declares.
 */
export function nurtureTracksFor(site: string, productId: string, anchor: NurtureAnchor): NurtureLane {
  return tracksForAnchor(lookupNurture(site, productId), anchor);
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
