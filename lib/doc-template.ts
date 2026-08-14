// lib/doc-template.ts
//
// R1 — the deliverable-document template engine.
//
// WHY THIS EXISTS. Until now every file body in cole/config/<product>.ts was a raw HTML
// string pushed straight through dangerouslySetInnerHTML. That is why File 01 of FRCGW
// shipped "$900,000 sale = $135,000 withheld" to a buyer who never told us their sale
// price: there was no mechanism by which a document could say anything about the person
// reading it, so every document asserted the same worked example as if it were their number.
//
// This module adds the missing mechanism and nothing else. It is PURE (no React, no DOM,
// no I/O) so it can run at build time, on the server, or in the client, and so it is
// unit-testable. Every product inherits it the moment its bodies use the syntax; a body
// with no markers renders byte-identically to before, which is why introducing this is
// a no-op for the other 43 products.
//
// ── SYNTAX ────────────────────────────────────────────────────────────────────────────
//
//   {{bind:key}}                      value, or the DEFAULT honest line if unbound
//   {{bind:key|we don't have this}}   value, or this explicit fallback if unbound
//   {{#if flag}}…{{/if}}              block kept when `flag` is present
//   {{#unless flag}}…{{/unless}}      block kept when `flag` is absent
//
// Blocks nest. Conditionals are resolved before binds, so a bind inside a dropped block is
// never evaluated (and so never emits a fallback line into content nobody sees).
//
// ── THE RULE THAT MATTERS ─────────────────────────────────────────────────────────────
// AN UNBOUND VALUE NEVER RENDERS A NUMBER. It renders an honest generic line. There is no
// "default sale price", no placeholder that looks like data. That is the entire point of
// the exercise: a document may say "we don't have your sale price — here is the method",
// but it may never say "$900,000" to someone who did not say $900,000.

/** A value that is present but empty is treated as unbound — same as missing. */
export interface DocTemplateContext {
  /** bind key → the buyer's actual value. Missing/empty ⇒ the fallback line is used. */
  values?: Record<string, string | number | null | undefined>;
  /** Flags available to {{#if}} / {{#unless}} — engine flags, terminal id, tier, etc. */
  flags?: Iterable<string>;
}

/**
 * The honest line used when a bind has no value and the author supplied no fallback.
 * Deliberately not a number and not a blank: a silent blank reads as "nothing to say here",
 * which is a different (and also wrong) claim from "you didn't tell us this".
 */
export const DEFAULT_UNBOUND_LINE = "(you didn't give us this — see the method below)";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Bound values are ESCAPED. They originate in customer answers, so treating them as HTML
 * would be an injection vector on a page we serve to that same customer. Author-written
 * fallbacks are NOT escaped — they are part of the template, same trust level as the body.
 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function isBound(v: unknown): v is string | number {
  if (v === null || v === undefined) return false;
  if (typeof v === "number") return Number.isFinite(v);
  return typeof v === "string" && v.trim().length > 0;
}

// ── conditional blocks ────────────────────────────────────────────────────────────────
// Hand-written scanner rather than a regex: `{{#if a}}x{{#if b}}y{{/if}}z{{/if}}` cannot be
// matched by a non-recursive regex, and a greedy/lazy approximation silently mis-pairs the
// closers — which would drop or duplicate legal content in a paid document.

interface BlockToken {
  kind: "if" | "unless";
  flag: string;
  start: number; // index of the opening tag
  bodyStart: number; // index just after the opening tag
}

const OPEN_RE = /\{\{#(if|unless)\s+([a-zA-Z0-9_.:-]+)\s*\}\}/g;
const CLOSE_RE = /\{\{\/(if|unless)\s*\}\}/g;

export function applyConditionals(src: string, flags: Set<string>): string {
  let out = "";
  let cursor = 0;
  const stack: BlockToken[] = [];

  // One left-to-right pass. On a closer we splice the block out of the source and recurse
  // into its body, so nesting is handled by construction rather than by counting.
  const tagRe = /\{\{#(if|unless)\s+([a-zA-Z0-9_.:-]+)\s*\}\}|\{\{\/(?:if|unless)\s*\}\}/g;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(src)) !== null) {
    const isOpen = m[1] !== undefined;
    if (isOpen) {
      if (stack.length === 0) out += src.slice(cursor, m.index);
      stack.push({
        kind: m[1] as "if" | "unless",
        flag: m[2],
        start: m.index,
        bodyStart: m.index + m[0].length,
      });
      continue;
    }

    // a closer
    const open = stack.pop();
    if (!open) {
      // Unmatched {{/if}} — keep it visible rather than swallowing it, so a template bug
      // shows up in review instead of silently deleting the rest of the document.
      if (stack.length === 0) {
        out += src.slice(cursor, m.index + m[0].length);
        cursor = m.index + m[0].length;
      }
      continue;
    }

    if (stack.length === 0) {
      const body = src.slice(open.bodyStart, m.index);
      const keep = open.kind === "if" ? flags.has(open.flag) : !flags.has(open.flag);
      if (keep) out += applyConditionals(body, flags);
      cursor = m.index + m[0].length;
    }
  }

  // An unclosed {{#if}} keeps its raw text for the same reason as above.
  out += src.slice(cursor);
  return out;
}

// ── binds ─────────────────────────────────────────────────────────────────────────────

const BIND_RE = /\{\{bind:([a-zA-Z0-9_.-]+)(?:\|([^}]*))?\}\}/g;

export function applyBinds(
  src: string,
  values: Record<string, string | number | null | undefined>,
): string {
  return src.replace(BIND_RE, (_full, key: string, fallback?: string) => {
    const v = values[key];
    if (isBound(v)) return escapeHtml(String(v));
    return fallback !== undefined ? fallback : DEFAULT_UNBOUND_LINE;
  });
}

/**
 * Render a document body against a buyer context.
 * Conditionals first, then binds — see the note above on why the order is load-bearing.
 */
export function renderDocTemplate(src: string, ctx: DocTemplateContext = {}): string {
  const flags = new Set(ctx.flags ?? []);
  const conditioned = applyConditionals(src, flags);
  return applyBinds(conditioned, ctx.values ?? {});
}

/** True when a body uses any template marker — lets callers skip work on legacy bodies. */
export function isTemplated(src: string): boolean {
  OPEN_RE.lastIndex = 0;
  CLOSE_RE.lastIndex = 0;
  BIND_RE.lastIndex = 0;
  return OPEN_RE.test(src) || BIND_RE.test(src);
}

/** Every bind key a body references — used by the snapshot test to catch typo'd keys. */
export function bindKeys(src: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(BIND_RE.source, "g");
  while ((m = re.exec(src)) !== null) out.add(m[1]);
  return [...out].sort();
}

/** Every flag a body branches on — same purpose as bindKeys(). */
export function conditionalFlags(src: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(OPEN_RE.source, "g");
  while ((m = re.exec(src)) !== null) out.add(m[2]);
  return [...out].sort();
}
