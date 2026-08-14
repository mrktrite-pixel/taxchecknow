// ─────────────────────────────────────────────────────────────────────────────
// BEHAVIOUR tests for the FRCGW rebuild (E1/E2/E3/E6, R1/R2/R3).
//
// The other files in this directory are SNAPSHOT tests: they lock generator output so a
// change is visible in review. They cannot tell you whether the new behaviour is CORRECT —
// a wrong answer snapshots just as happily as a right one. These are assertions about
// behaviour, so the claims in the rebuild report are checked rather than asserted.
//
//   RUN: npm run test:snap -- --test-name-pattern frcgw-rebuild
//
// Everything imported here is the real shipped module. The ONE exception is matchExpr,
// mirrored below because its home (app/_components/EngineCalculator.tsx) is a .tsx using
// the "@/" path alias, which this CommonJS ts-node project does not resolve. The mirror is
// six lines and is asserted against the real engine.json, so a divergence in the routing
// SEMANTICS would still show up as a wrong terminal here.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import * as path from "node:path";
import * as fs from "node:fs";
import { req, COLE_ROOT } from "./_surfaces.ts";

const REPO = path.join(COLE_ROOT, "..");

const { renderDocTemplate, bindKeys, conditionalFlags } =
  req(path.join(REPO, "lib", "doc-template.ts"));
const { buildBuyerContext, detectConflicts, addDaysIso, formatIsoDate } =
  req(path.join(REPO, "lib", "buyer-context.ts"));
const { getTerminalPresentation, resolveCalendar, resolveSpine } =
  req(path.join(REPO, "lib", "terminal-presentation.ts"));
const { PRODUCT_ASSESSMENT_FIELDS, resolveDisplayFields } =
  req(path.join(REPO, "lib", "assessment-fields.ts"));

const PRODUCT = "frcgw-clearance-certificate";
const engine = JSON.parse(
  fs.readFileSync(path.join(REPO, "app", "au", "check", PRODUCT, "engine.json"), "utf8"),
);
const docs = JSON.parse(
  fs.readFileSync(path.join(REPO, "app", "au", "check", PRODUCT, "docs.json"), "utf8"),
);

// ── mirror of EngineCalculator.matchExpr / computeFlags (see header) ─────────
interface Expr { all?: string[]; any?: string[]; none?: string[] }
const matchExpr = (e: Expr | undefined, f: Set<string>): boolean => {
  if (!e) return true;
  if (e.all && !e.all.every((x) => f.has(x))) return false;
  if (e.any && e.any.length > 0 && !e.any.some((x) => f.has(x))) return false;
  if (e.none && e.none.some((x) => f.has(x))) return false;
  return true;
};

/** Walk the engine with a scripted set of option VALUES; return the terminal + hedge state. */
function walk(answers: Record<string, string>): { terminal: string | null; anyUnsure: boolean } {
  const flags = new Set<string>();
  const answered = new Set<string>();
  let anyUnsure = false;

  for (let guard = 0; guard < engine.questions.length + 2; guard++) {
    const q = engine.questions.find(
      (x: any) => matchExpr(x.showIf, flags) && !answered.has(x.id),
    );
    if (!q) break;
    const given = answers[q.id];
    if (given === undefined) break;

    if (q.type === "date") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(given)) {
        for (const fl of q.dateFlags ?? []) flags.add(fl);
      } else {
        for (const fl of q.skip?.flags ?? []) flags.add(fl);
        if (q.skip?.unsure) anyUnsure = true;
      }
    } else {
      const o = q.options.find((x: any) => x.value === given);
      if (!o) break;
      for (const fl of o.flags ?? []) flags.add(fl);
      // E1 — mirrors isHedgeOption(): an explicit boolean wins in BOTH directions;
      // only an unmarked option falls through to the label/value text matcher.
      const hedged = typeof o.unsure === "boolean"
        ? o.unsure
        : /unsure|not[_ ]sure/i.test(o.value) || /\b(not sure|unsure|don'?t know)\b/i.test(o.label);
      if (hedged) anyUnsure = true;
    }
    answered.add(q.id);
  }

  const t = engine.terminals.find((x: any) => matchExpr(x.when, flags));
  return { terminal: t?.id ?? null, anyUnsure };
}

// ── E1 ───────────────────────────────────────────────────────────────────────
test("frcgw-rebuild · E1 · every genuinely-unsure option is marked, and none relies on the flag prefix", (t) => {
  const hedges: string[] = [];
  for (const q of engine.questions) {
    for (const o of q.options ?? []) {
      // The OLD detector was flag.startsWith("unsure:"). Assert no option would satisfy it,
      // so this test documents the bug it exists to prevent, not just the fix.
      t.assert.ok(
        !(o.flags ?? []).some((f: string) => f.startsWith("unsure:")),
        `${q.id}:${o.value} — flags DO use the unsure: prefix; the original detector would have worked`,
      );
      // An option whose VALUE says unsure is a real hedge and must be marked true.
      if (/unsure|not[_ ]sure/i.test(o.value)) {
        hedges.push(`${q.id}:${o.value}`);
        t.assert.strictEqual(o.unsure, true, `${q.id}:${o.value} is a hedge but is not marked unsure:true`);
      }
      // An option whose LABEL merely contains hedge WORDS but is decisive must be marked
      // false explicitly, or the text matcher would downgrade its confidence wrongly.
      const labelLooksHedgy = /\b(not sure|unsure|don'?t know)\b/i.test(o.label);
      if (labelLooksHedgy && !/unsure|not[_ ]sure/i.test(o.value)) {
        t.assert.strictEqual(
          o.unsure, false,
          `${q.id}:${o.value} — label contains hedge words but the answer is decisive; it needs unsure:false`,
        );
      }
    }
  }
  t.assert.ok(hedges.length >= 5, `expected several hedge options, found ${hedges.length}`);
});

test("frcgw-rebuild · E1 · the explainer path keeps HIGH confidence despite saying 'I don't know'", (t) => {
  const r = walk({ q1_scope: "in_scope", q2_knowledge: "need_explainer" });
  t.assert.strictEqual(r.terminal, "what-is-clearance-certificate");
  t.assert.strictEqual(r.anyUnsure, false, "not knowing what a certificate IS is not doubt about the facts");
});

test("frcgw-rebuild · E1 · unsure-tax-residency-status is no longer HIGH confidence", (t) => {
  const r = walk({ q1_scope: "in_scope", q2_knowledge: "timing", q3_timing: "sole", q4_residency: "unsure_residency" });
  t.assert.strictEqual(r.terminal, "unsure-tax-residency-status");
  t.assert.strictEqual(r.anyUnsure, true, "the defining answer was 'I'm not sure' — confidence must be MEDIUM");
});

// ── E2 ───────────────────────────────────────────────────────────────────────
test("frcgw-rebuild · E2 · both 147 paths ask residency and split three ways", (t) => {
  const cases: Array<[string, string, string]> = [
    ["pending", "resident", "certificate-pending-resident"],
    ["pending", "non_resident", "certificate-pending-non-resident"],
    ["pending", "unsure_residency", "certificate-pending-unsure-residency"],
    ["no_cert", "resident", "no-certificate-resident"],
    ["no_cert", "non_resident", "no-certificate-non-resident"],
    ["no_cert", "unsure_residency", "no-certificate-unsure-residency"],
  ];
  for (const [stage, residency, expected] of cases) {
    const key = stage === "pending" ? "q2a_pending_residency" : "q2b_nocert_residency";
    const r = walk({ q1_scope: "in_scope", q2_knowledge: stage, [key]: residency, q6_settlement_date: "not_scheduled" });
    t.assert.strictEqual(r.terminal, expected, `${stage}+${residency}`);
  }
});

test("frcgw-rebuild · E2 · the six variants keep tier 147 and criticality critical", (t) => {
  const ids = [
    "certificate-pending-resident", "certificate-pending-non-resident", "certificate-pending-unsure-residency",
    "no-certificate-resident", "no-certificate-non-resident", "no-certificate-unsure-residency",
  ];
  for (const id of ids) {
    const term = engine.terminals.find((x: any) => x.id === id);
    t.assert.ok(term, `${id} missing from engine.json`);
    t.assert.strictEqual(term.tier, 147, `${id} tier`);
    t.assert.strictEqual(term.criticality, "critical", `${id} criticality`);
  }
  // Severity per the M map: pending amber, no-certificate red.
  for (const id of ids.slice(0, 3)) {
    t.assert.strictEqual(engine.terminals.find((x: any) => x.id === id).severity, "amber", id);
  }
  for (const id of ids.slice(3)) {
    t.assert.strictEqual(engine.terminals.find((x: any) => x.id === id).severity, "red", id);
  }
});

test("frcgw-rebuild · E2 · q4_residency:non_resident now reaches a real terminal", (t) => {
  const r = walk({ q1_scope: "in_scope", q2_knowledge: "timing", q3_timing: "sole", q4_residency: "non_resident", q6_settlement_date: "not_scheduled" });
  t.assert.strictEqual(r.terminal, "foreign-resident-variation-required");
});

test("frcgw-rebuild · E2 · every option flag is referenced by some terminal or showIf", (t) => {
  const referenced = new Set<string>();
  const collect = (e: Expr | undefined) => {
    for (const f of [...(e?.all ?? []), ...(e?.any ?? []), ...(e?.none ?? [])]) referenced.add(f);
  };
  for (const q of engine.questions) collect(q.showIf);
  for (const term of engine.terminals) collect(term.when);

  const orphans: string[] = [];
  for (const q of engine.questions) {
    for (const o of q.options ?? []) {
      for (const f of o.flags ?? []) if (!referenced.has(f)) orphans.push(f);
    }
  }
  // q1_scope:in_scope is a gate for q2 only, which IS a showIf — so it is referenced.
  // Anything else unreferenced is the class of bug q4_residency:non_resident was.
  t.assert.deepStrictEqual(orphans, [], `option flags no terminal or showIf reads: ${orphans.join(", ")}`);
});

// ── E3 ───────────────────────────────────────────────────────────────────────
test("frcgw-rebuild · E3 · the date question is asked only where settlement is ahead", (t) => {
  const dateQ = engine.questions.find((q: any) => q.id === "q6_settlement_date");
  t.assert.ok(dateQ, "q6_settlement_date missing");
  t.assert.strictEqual(dateQ.type, "date");
  t.assert.ok(dateQ.skip, "the date question must be skippable");

  const asked = (answers: Record<string, string>): boolean => {
    const flags = new Set<string>();
    const answered = new Set<string>();
    for (let g = 0; g < 8; g++) {
      const q = engine.questions.find((x: any) => matchExpr(x.showIf, flags) && !answered.has(x.id));
      if (!q) break;
      if (q.id === "q6_settlement_date") return true;
      const o = (q.options ?? []).find((x: any) => x.value === answers[q.id]);
      if (!o) break;
      for (const fl of o.flags ?? []) flags.add(fl);
      answered.add(q.id);
    }
    return false;
  };

  // Settlement AHEAD → asked.
  t.assert.ok(asked({ q1_scope: "in_scope", q2_knowledge: "pending", q2a_pending_residency: "resident" }), "pending");
  t.assert.ok(asked({ q1_scope: "in_scope", q2_knowledge: "timing", q3_timing: "co_owners" }), "co-owners");
  t.assert.ok(asked({ q1_scope: "in_scope", q2_knowledge: "timing", q3_timing: "sole", q4_residency: "resident", q5_contract_length: "standard_contract" }), "when-to-apply");
  // Settlement BEHIND, or no sale → never asked.
  t.assert.ok(!asked({ q1_scope: "in_scope", q2_knowledge: "no_cert", q2b_nocert_residency: "resident" }), "settlement passed");
  t.assert.ok(!asked({ q1_scope: "in_scope", q2_knowledge: "provided" }), "certificate already provided");
  t.assert.ok(!asked({ q1_scope: "out_of_scope" }), "not selling");
});

test("frcgw-rebuild · E3 · a real date yields lodge-by = date − 28 and a countdown; skipping yields neither", (t) => {
  const withDate = buildBuyerContext({
    productId: PRODUCT,
    rawAnswers: { q1_scope: "in_scope", q2_knowledge: "timing", q6_settlement_date: "2026-12-01" },
    terminalId: "when-to-apply-timeline",
    tier: 1,
  });
  t.assert.strictEqual(withDate.values.settlement_date_iso, "2026-12-01");
  t.assert.strictEqual(withDate.values.lodge_by_date_iso, addDaysIso("2026-12-01", -28));
  t.assert.strictEqual(withDate.values.lodge_by_date, formatIsoDate("2026-11-03"));
  t.assert.ok(withDate.flags.includes("has:settlement_date"));

  const skipped = buildBuyerContext({
    productId: PRODUCT,
    rawAnswers: { q1_scope: "in_scope", q2_knowledge: "timing", q6_settlement_date: "not_scheduled" },
    terminalId: "when-to-apply-timeline",
    tier: 1,
  });
  t.assert.strictEqual(skipped.values.settlement_date_iso, undefined, "no date must mean NO date, not a default");
  t.assert.strictEqual(skipped.values.lodge_by_date, undefined);
  t.assert.ok(!skipped.flags.includes("has:settlement_date"));
});

test("frcgw-rebuild · E3 · the temporal declaration keeps the v1 shape and stays unresolvable without an answer", (t) => {
  const { PRODUCT_CONFIG } = req(path.join(COLE_ROOT, "config", "au-19-frcgw-clearance-certificate.ts"));
  const { resolve } = req(path.join(REPO, "lib", "temporal-resolver.ts"));

  t.assert.strictEqual(PRODUCT_CONFIG.temporal.kind, "deadline");
  t.assert.strictEqual(PRODUCT_CONFIG.temporal.rule.source, "user_supplied");
  t.assert.strictEqual(PRODUCT_CONFIG.temporal.rule.field, "q6_settlement_date");
  t.assert.strictEqual(PRODUCT_CONFIG.temporal.rule.offset.days, -28);
  // config.deadline.isoDate must STAY empty — a stored date is the bug TEMPORAL v1 exists to kill.
  t.assert.strictEqual(PRODUCT_CONFIG.deadline.isoDate, "");

  const now = new Date("2026-08-14T00:00:00Z");
  // The webhook passes answers: null. That path must be byte-identically silent.
  t.assert.strictEqual(resolve(PRODUCT_CONFIG.temporal, null, now).status, "UNRESOLVABLE");
  // A customer who skipped is equally silent.
  t.assert.strictEqual(resolve(PRODUCT_CONFIG.temporal, { q6_settlement_date: "not_scheduled" }, now).status, "UNRESOLVABLE");
  // A customer who answered resolves to settlement − 28 days.
  const r = resolve(PRODUCT_CONFIG.temporal, { q6_settlement_date: "2026-12-01" }, now);
  t.assert.strictEqual(r.status, "RESOLVED");
  t.assert.strictEqual(r.date, "2026-11-03");
});

// ── E6 ───────────────────────────────────────────────────────────────────────
test("frcgw-rebuild · E6 · the live 384f32be contradiction is detected", (t) => {
  // Verbatim from decision_sessions 384f32be-1218-4431-b0ba-c10a6fe56ced (2026-08-14).
  const maze = {
    "What best describes where you are in the clearance certificate process?":
      "I know what it is, but I haven't applied yet and want to know when to apply",
  };
  const qual = { "How close is settlement?": "Already settled" };
  const conflicts = detectConflicts(PRODUCT, maze, qual);
  t.assert.strictEqual(conflicts.length, 1);
  t.assert.strictEqual(conflicts[0].id, "not_yet_applied_vs_already_settled");
  t.assert.match(conflicts[0].authoritative, /haven't applied yet/);
  t.assert.match(conflicts[0].contradicting, /Already settled/);
});

test("frcgw-rebuild · E6 · agreeing answers produce no conflict", (t) => {
  const conflicts = detectConflicts(
    PRODUCT,
    { "What best describes where you are in the clearance certificate process?": "I know what it is, but I haven't applied yet and want to know when to apply" },
    { "How close is settlement?": "Within 3 months" },
  );
  t.assert.deepStrictEqual(conflicts, []);
});

// ── R1 ───────────────────────────────────────────────────────────────────────
test("frcgw-rebuild · R1 · an unbound value never renders a number", (t) => {
  const body = docs["frcgw-01"].content;
  const out = renderDocTemplate(body, { values: {}, flags: [] });
  t.assert.ok(!/\{\{/.test(out), "unresolved template markers left in the output");
  // The buyer gave no sale price, so the honest line must appear and no figure may be
  // presented as theirs. The worked-example table is explicitly labelled and is allowed.
  t.assert.match(out, /did not ask for your sale price/i);
  t.assert.match(out, /illustrations, not your numbers/i);
});

test("frcgw-rebuild · R1 · a bound value renders, and is HTML-escaped", (t) => {
  const out = renderDocTemplate("<p>{{bind:settlement_date|not given}}</p>", {
    values: { settlement_date: "1 December 2026" },
  });
  t.assert.strictEqual(out, "<p>1 December 2026</p>");

  const escaped = renderDocTemplate("<p>{{bind:x}}</p>", { values: { x: "<script>alert(1)</script>" } });
  t.assert.ok(!escaped.includes("<script>"), "customer value reached the markup unescaped");
  t.assert.match(escaped, /&lt;script&gt;/);
});

test("frcgw-rebuild · R1 · conditionals keep, drop and nest correctly", (t) => {
  const src = "A{{#if x}}B{{#if y}}C{{/if}}D{{/if}}E{{#unless z}}F{{/unless}}";
  t.assert.strictEqual(renderDocTemplate(src, { flags: ["x", "y"] }), "ABCDEF");
  t.assert.strictEqual(renderDocTemplate(src, { flags: ["x"] }), "ABDEF");
  t.assert.strictEqual(renderDocTemplate(src, { flags: [] }), "AEF");
  t.assert.strictEqual(renderDocTemplate(src, { flags: ["x", "y", "z"] }), "ABCDE");
});

test("frcgw-rebuild · R1 · a body with no markers is passed through byte-identically", (t) => {
  const plain = '<h2>Nothing templated</h2><p>Just HTML &amp; entities.</p>';
  t.assert.strictEqual(renderDocTemplate(plain, { values: { a: "1" }, flags: ["b"] }), plain);
});

test("frcgw-rebuild · R1 · every flag the documents branch on is produced by something", (t) => {
  const produced = new Set<string>();
  for (const q of engine.questions) {
    for (const o of q.options ?? []) for (const f of o.flags ?? []) produced.add(f);
    for (const f of q.dateFlags ?? []) produced.add(f);
    for (const f of q.skip?.flags ?? []) produced.add(f);
  }
  for (const term of engine.terminals) {
    produced.add(`terminal:${term.id}`);
    for (const f of getTerminalPresentation(PRODUCT, term.id, { headline: "", fileSlugs: [] }).docFlags) produced.add(f);
  }
  for (const f of ["has:settlement_date", "tier:1", "tier:2", "settlement:past", "settlement:inside_28", "settlement:outside_28"]) produced.add(f);

  const unknown: string[] = [];
  for (const slug of Object.keys(docs)) {
    for (const f of conditionalFlags(docs[slug].content)) if (!produced.has(f)) unknown.push(`${slug}:${f}`);
  }
  t.assert.deepStrictEqual(unknown, [], `documents branch on flags nothing emits: ${unknown.join(", ")}`);
});

test("frcgw-rebuild · R1 · every bind key a document uses is one the context can supply", (t) => {
  const supplied = new Set([
    "settlement_date", "settlement_date_iso", "lodge_by_date", "lodge_by_date_iso",
    "days_to_settlement", "sale_price",
  ]);
  const unknown: string[] = [];
  for (const slug of Object.keys(docs)) {
    for (const k of bindKeys(docs[slug].content)) {
      if (!supplied.has(k) && !k.startsWith("answer.")) unknown.push(`${slug}:${k}`);
    }
  }
  // sale_price is deliberately NEVER supplied — it is the key whose whole job is to prove
  // the fallback works. It is listed as "suppliable" only so a typo like sale_pric is caught.
  t.assert.deepStrictEqual(unknown, [], `documents bind keys nothing produces: ${unknown.join(", ")}`);
});

// ── R2 ───────────────────────────────────────────────────────────────────────
test("frcgw-rebuild · R2 · every terminal has its own strip, and they are not all the same", (t) => {
  const seen = new Map<string, string>();
  for (const term of engine.terminals) {
    const p = getTerminalPresentation(PRODUCT, term.id, { headline: "FALLBACK", fileSlugs: [] });
    t.assert.notStrictEqual(p.strip.headline, "FALLBACK", `${term.id} has no map entry`);
    seen.set(term.id, `${p.strip.tone}|${p.strip.headline}`);
  }
  t.assert.ok(new Set(seen.values()).size >= 10, "strips are barely differentiated");
});

test("frcgw-rebuild · R2 · the M map tones are as ruled", (t) => {
  const tone = (id: string) => getTerminalPresentation(PRODUCT, id, { headline: "", fileSlugs: [] }).strip.tone;
  t.assert.strictEqual(tone("certificate-provided-no-withholding"), "green", "M4 provided → GREEN");
  t.assert.strictEqual(tone("no-certificate-resident"), "red", "M5 no_cert → RED");
  t.assert.strictEqual(tone("what-is-clearance-certificate"), "amber", "M1");
  t.assert.strictEqual(tone("certificate-pending-resident"), "amber", "M3");
});

test("frcgw-rebuild · R2 · no apply-now copy survives on the settled paths", (t) => {
  for (const id of ["no-certificate-resident", "no-certificate-non-resident", "no-certificate-unsure-residency"]) {
    const p = getTerminalPresentation(PRODUCT, id, { headline: "", fileSlugs: [] });
    t.assert.ok(p.docFlags.includes("suppress:apply_now"), `${id} must suppress apply-now`);
    t.assert.ok(p.docFlags.includes("suppress:28_day"), `${id} must suppress the 28-day copy (M5)`);
    for (const e of p.calendar) {
      t.assert.ok(!/apply/i.test(e.summary), `${id} calendar still says "${e.summary}"`);
    }
  }
  // And the pending paths must not tell someone who has already lodged to lodge.
  for (const id of ["certificate-pending-resident", "certificate-pending-non-resident", "certificate-pending-unsure-residency"]) {
    const p = getTerminalPresentation(PRODUCT, id, { headline: "", fileSlugs: [] });
    t.assert.ok(p.docFlags.includes("suppress:apply_now"), `${id} must suppress apply-now (M3: ZERO apply-now copy)`);
  }
});

test("frcgw-rebuild · R2 · settlement-anchored events are dropped, never defaulted, with no date", (t) => {
  const p = getTerminalPresentation(PRODUCT, "when-to-apply-timeline", { headline: "", fileSlugs: [] });
  const empty = { terminalId: "when-to-apply-timeline", tier: 1, flags: [], values: {}, conflicts: [] };
  const withDate = { ...empty, values: { settlement_date_iso: "2026-12-01" } };

  const noDate = resolveCalendar(p.calendar, empty as any, new Date("2026-08-14T00:00:00Z"));
  const dated = resolveCalendar(p.calendar, withDate as any, new Date("2026-08-14T00:00:00Z"));

  t.assert.ok(noDate.length < dated.length, "the undated calendar must be SHORTER, not padded out");
  t.assert.ok(noDate.every((e: any) => e.isoDate !== null), "today-anchored events still carry a real date");
  for (const e of noDate) {
    t.assert.ok(!/SET TO YOUR ACTUAL/i.test(e.summary), "the placeholder settlement event is back");
  }
  const settlement = dated.find((e: any) => e.uid === "frcgw-settlement");
  t.assert.strictEqual(settlement?.isoDate, "2026-12-01");
  t.assert.strictEqual(dated.find((e: any) => e.uid === "frcgw-lodge-by")?.isoDate, "2026-11-03");
});

// ── R3 ───────────────────────────────────────────────────────────────────────
test("frcgw-rebuild · R3 · tier 1 sees five documents, tier 2 sees eight", (t) => {
  const t1 = Object.keys(docs).filter((s) => docs[s].tier <= 1);
  const t2 = Object.keys(docs).filter((s) => docs[s].tier <= 2);
  t.assert.strictEqual(t1.length, 5);
  t.assert.strictEqual(t2.length, 8);
});

test("frcgw-rebuild · R3 · START HERE follows the terminal and is always a file the buyer owns", (t) => {
  const t1 = Object.keys(docs).filter((s) => docs[s].tier <= 1);
  const starts = new Set<string>();
  for (const term of engine.terminals) {
    const p = getTerminalPresentation(PRODUCT, term.id, { headline: "", fileSlugs: t1 });
    const { order, startHere } = resolveSpine(p, t1);
    t.assert.ok(t1.includes(startHere), `${term.id} starts at ${startHere}, which tier 1 does not own`);
    t.assert.strictEqual(order.length, t1.length, `${term.id} spine lost or duplicated a file`);
    t.assert.strictEqual(new Set(order).size, order.length, `${term.id} spine has duplicates`);
    starts.add(startHere);
  }
  t.assert.ok(starts.size > 1, "START HERE is still effectively hardcoded — every terminal picked the same file");
});

test("frcgw-rebuild · R3 · the foreign-resident terminals lead with the variation document", (t) => {
  const t2 = Object.keys(docs).filter((s) => docs[s].tier <= 2);
  for (const id of ["foreign-resident-variation-required", "certificate-pending-non-resident"]) {
    const p = getTerminalPresentation(PRODUCT, id, { headline: "", fileSlugs: t2 });
    t.assert.strictEqual(resolveSpine(p, t2).startHere, "frcgw-08", `${id} must lead with File 08 (M)`);
  }
});

// ── C8 ───────────────────────────────────────────────────────────────────────
test("frcgw-rebuild · C8 · config, page fields and the webhook registry agree exactly", (t) => {
  const { PRODUCT_CONFIG } = req(path.join(COLE_ROOT, "config", "au-19-frcgw-clearance-certificate.ts"));
  const registry = PRODUCT_ASSESSMENT_FIELDS[PRODUCT];
  t.assert.ok(registry, "FRCGW is not registered — the webhook would fall back to GENERIC_FIELDS");
  t.assert.deepStrictEqual(registry.tier1, PRODUCT_CONFIG.tier1AssessmentFields);
  t.assert.deepStrictEqual(registry.tier2, PRODUCT_CONFIG.tier2AssessmentFields);

  // and the two emitted success pages POST exactly those lists.
  for (const [tierDir, expected] of [["assess", registry.tier1], ["plan", registry.tier2]] as const) {
    const src = fs.readFileSync(path.join(REPO, "app", "au", "check", PRODUCT, "success", tierDir, "page.tsx"), "utf8");
    const m = /const FIELDS = \[([\s\S]*?)\];/.exec(src);
    t.assert.ok(m, `${tierDir} page has no FIELDS array`);
    const posted = [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    t.assert.deepStrictEqual(posted, expected, `${tierDir} page POSTs a different list`);
  }
});

test("frcgw-rebuild · C8 · a legacy generic-key assessment still renders for the five existing buyers", (t) => {
  // Verbatim key set from stored assessment 545ccc5c (tier 1, 2026-07-25).
  const legacy = {
    status: "…", keyFinding: "…", firstAction: "…", exposureAmount: "…",
    confidenceLevel: "…", mainRiskTrigger: "…", recommendedAction: "…",
  };
  const shown = resolveDisplayFields(legacy, PRODUCT, 67);
  t.assert.ok(shown.length > 0, "the position block would render EMPTY — the original defect");
  t.assert.ok(shown.includes("status") && shown.includes("keyFinding"));

  // A new per-product assessment must still win.
  const modern = { salePrice: "…", withholdingExposure: "…", status: "should not be used" };
  const shownModern = resolveDisplayFields(modern, PRODUCT, 67);
  t.assert.ok(shownModern.includes("salePrice"));
  t.assert.ok(!shownModern.includes("status"), "generic keys leaked into a per-product assessment");
});

// ── C1–C5 fact corrections ───────────────────────────────────────────────────
test("frcgw-rebuild · C1-C5 · the corrected facts hold across every document", (t) => {
  const all = Object.values(docs).map((d: any) => d.content).join("\n") + "\n"
    + engine.terminals.map((x: any) => `${x.heading} ${x.result_copy}`).join("\n");

  const banned: Array<[RegExp, string]> = [
    [/1[-–]4 weeks/i, "C5: 'processing takes 1-4 weeks'"],
    [/variation certificate/i, "C3: it is a variation NOTICE"],
    [/cannot be obtained after settlement/i, "C5: 'cannot apply after settlement'"],
    [/the ATO needs 28 days/i, "C5: 'the ATO needs 28 days'"],
    [/6[-–]18 months/i, "C2: the wait is ~15 months, not 6-18"],
    [/non-negotiable/i, "C4: 'non-negotiable'"],
  ];
  for (const [re, why] of banned) {
    t.assert.ok(!re.test(all), `${why} — still present`);
  }

  // "trust account" may appear ONLY inside a sentence denying it — the myth is worth
  // rebutting by name. Checked per sentence rather than by lookahead, because the negation
  // ("it is not sitting in anybody's trust account") comes BEFORE the phrase, not after.
  for (const sentence of all.split(/(?<=[.!?])\s+|<\/p>|<br\s*\/?>/i)) {
    if (!/trust account/i.test(sentence)) continue;
    t.assert.match(
      sentence,
      /\b(not|never|nor|no)\b/i,
      `C2: "trust account" asserted rather than denied — "${sentence.replace(/<[^>]+>/g, "").trim().slice(0, 120)}"`,
    );
  }

  // and the corrected statements are actually made somewhere.
  t.assert.match(all, /issue within days/i, "C5: 'most issue within days'");
  t.assert.match(all, /remits? (it|the withheld amount) to the ATO|remitted (it|to the ATO)/i, "C2: remitted to the ATO");
  t.assert.match(all, /income year the CONTRACT was signed/i, "C2: contract-year return");
  t.assert.match(all, /0% (and|to) 14\.99%|0–14\.99%/i, "C3: variation rate range");
  t.assert.match(all, /maximum sale price|stated maximum/i, "C3: the max-sale-price trap");
  t.assert.match(all, /valid for 12 months/i, "C5: free, valid 12 months");
  t.assert.match(all, /ato\.gov\.au\/clearancecertificate/i, "C4: the application link");
});

test("frcgw-rebuild · C6 · the FRCGW documents cite an Australian adviser", (t) => {
  for (const slug of Object.keys(docs)) {
    const src = fs.readFileSync(path.join(REPO, "app", "files", "au", PRODUCT, slug, "page.tsx"), "utf8");
    t.assert.match(src, /qualified Australian tax adviser/, `${slug} disclaimer`);
    t.assert.ok(!/qualified UK tax adviser/.test(src), `${slug} still cites a UK adviser while citing the ATO`);
  }
});

test("frcgw-rebuild · C7 · no page can produce the doubled possessive", (t) => {
  for (const tierDir of ["assess", "plan"]) {
    const src = fs.readFileSync(path.join(REPO, "app", "au", "check", PRODUCT, "success", tierDir, "page.tsx"), "utf8");
    const m = /const PACK_NAME = "([^"]+)"/.exec(src);
    t.assert.ok(m, `${tierDir}: no PACK_NAME`);
    t.assert.ok(!/^Your\s/i.test(m![1]), `${tierDir}: PACK_NAME "${m![1]}" is possessive; the hero prefix adds "your" → "your Your"`);
    t.assert.ok(!/Start with File 02/.test(src), `${tierDir}: the hardcoded File-02 START HERE copy is back`);
  }
});
