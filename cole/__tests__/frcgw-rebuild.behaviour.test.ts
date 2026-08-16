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

// ═════════════════════════════════════════════════════════════════════════════
// WALK-B defect fixes (W1–W5). Added 2026-08-16.
// ═════════════════════════════════════════════════════════════════════════════

/** Render every document for a terminal, exactly as the pack renders it. */
function renderPack(terminalId: string, extraValues: Record<string, string> = {}): Record<string, string> {
  const p = getTerminalPresentation(PRODUCT, terminalId, { headline: "", fileSlugs: [] });
  const out: Record<string, string> = {};
  for (const slug of Object.keys(docs)) {
    out[slug] = renderDocTemplate(docs[slug].content, {
      values: extraValues,
      flags: [...p.docFlags, `terminal:${terminalId}`, ...Object.keys(extraValues).map((k) => `has:${k}`)],
    });
  }
  return out;
}

// ── W1 · the pending strings must not reach a buyer who never lodged ─────────
test("frcgw-rebuild · W1 · no_cert+resident never sees pending or apply-now copy", (t) => {
  const pack = renderPack("no-certificate-resident");

  const BANNED: Array<[RegExp, string]> = [
    [/You have already lodged/i, "File 02's pending banner"],
    [/application you have already lodged/i, "File 06's phase-1 pending step"],
    [/while your application is pending/i, "pending cross-reference"],
    [/Send the pending-notice/i, "pending-notice instruction"],
    [/Check daily as settlement approaches/i, "pending monitoring loop"],
    [/There is nothing further to apply for\./i, "the pending phrasing of 'nothing to apply for'"],
  ];
  for (const slug of Object.keys(pack)) {
    for (const [re, why] of BANNED) {
      t.assert.ok(!re.test(pack[slug]), `${slug}: ${why} rendered for a buyer who never lodged`);
    }
  }

  t.assert.match(pack["frcgw-02"], /nothing to apply for on this sale; File 07 is your route/i,
    "File 02 is missing the settled variant");
  t.assert.match(pack["frcgw-06"], /nothing to apply for on this sale; File 07 is your route/i,
    "File 06 is missing the settled variant");
});

test("frcgw-rebuild · W1 · the pending banner still fires on every pending terminal", (t) => {
  for (const id of ["certificate-pending-resident", "certificate-pending-non-resident", "certificate-pending-unsure-residency"]) {
    const pack = renderPack(id);
    t.assert.match(pack["frcgw-02"], /You have already lodged/i, `${id}: File 02 lost its pending banner`);
    t.assert.match(pack["frcgw-06"], /application you have already lodged/i, `${id}: File 06 lost its pending step`);
    t.assert.ok(!/nothing to apply for on this sale; File 07/i.test(pack["frcgw-02"]),
      `${id}: File 02 shows the SETTLED variant to a pending buyer`);
  }
});

test("frcgw-rebuild · W1 · exactly one Phase 1 renders on every terminal", (t) => {
  for (const term of engine.terminals) {
    const pack = renderPack(term.id);
    const n = (pack["frcgw-06"].match(/<h2>Phase 1 —/g) ?? []).length;
    t.assert.strictEqual(n, 1, `${term.id}: File 06 rendered ${n} "Phase 1" headings`);
  }
});

test("frcgw-rebuild · W1 · certificate-provided is told it holds a certificate, not that it lodged", (t) => {
  const pack = renderPack("certificate-provided-no-withholding");
  t.assert.match(pack["frcgw-02"], /You already hold a certificate and provided it/i);
  t.assert.ok(!/You have already lodged/i.test(pack["frcgw-02"]),
    "a buyer who HAS a certificate is told they 'already lodged'");
  t.assert.ok(!/File 07 is your route/i.test(pack["frcgw-02"]),
    "a buyer with no withholding is pointed at the recovery file");
});

// ── W5 · "Your dates" must not survive settlement ────────────────────────────
test("frcgw-rebuild · W5 · File 01 drops the lodge-by dates once settlement has happened", (t) => {
  for (const id of ["no-certificate-resident", "no-certificate-non-resident",
    "no-certificate-unsure-residency", "certificate-provided-no-withholding"]) {
    const f1 = renderPack(id)["frcgw-01"];
    t.assert.ok(!/count back 28 days/i.test(f1), `${id}: still tells a settled buyer to count back 28 days`);
    t.assert.ok(!/Lodge by:/i.test(f1), `${id}: still prints a lodge-by date`);
    t.assert.match(f1, /settlement has already happened/i, `${id}: missing the settled dates variant`);
  }
  const ahead = renderPack("when-to-apply-timeline");
  t.assert.match(ahead["frcgw-01"], /count back 28 days/i, "a pre-settlement buyer lost their dates guidance");
});

test("frcgw-rebuild · W5 · a settled buyer with a captured date still gets no lodge-by", (t) => {
  // state:settled must win over has:settlement_date — the date is real, the deadline is gone.
  const f1 = renderPack("no-certificate-resident",
    { settlement_date: "1 December 2026", lodge_by_date: "3 November 2026" })["frcgw-01"];
  t.assert.ok(!/Lodge by:/i.test(f1), "a lodge-by date rendered for a settled sale");
  t.assert.ok(!/3 November 2026/.test(f1), "the computed lodge-by date leaked onto a settled sale");

  // D8 — and the same must hold when the date arrives from the STORED path rather than from
  // sessionStorage. The precedence is a property of the terminal, not of where the date came
  // from, so resolving dates server-side must not quietly reopen the lodge-by on a settled sale.
  const stored = buildBuyerContext({
    productId: PRODUCT, terminalId: "no-certificate-resident", tier: 2,
    rawAnswers: { [SETTLEMENT_DATE_FIELD]: "2026-12-01" },
  });
  const pres = getTerminalPresentation(PRODUCT, stored.terminalId, { headline: "", fileSlugs: [] });
  const storedF1 = renderDocTemplate(docs["frcgw-01"].content,
    { values: stored.values, flags: [...stored.flags, ...pres.docFlags] });
  t.assert.ok(stored.values.lodge_by_date, "the context did compute a lodge-by date");
  t.assert.ok(!/Lodge by:/i.test(storedF1), "stored path reopened the lodge-by on a settled sale");
  t.assert.ok(!new RegExp(stored.values.lodge_by_date).test(storedF1),
    "the stored-path lodge-by date leaked onto a settled sale");
  t.assert.match(storedF1, /settlement has already happened/i, "lost the settled dates variant");
});

// ── W1 · no document may branch on suppress:* to assert a positive fact ──────
test("frcgw-rebuild · W1 · no {{#if suppress:*}} block remains in any document", (t) => {
  for (const slug of Object.keys(docs)) {
    const hits = docs[slug].content.match(/\{\{#if\s+suppress:[a-z_]+\}\}/g) ?? [];
    t.assert.deepStrictEqual(hits, [],
      `${slug} branches on a suppress: flag to decide what to SAY — suppress flags are coarse ` +
      `(apply_now is true for pending, provided AND settled) and must only ever remove content`);
  }
});

test("frcgw-rebuild · W1 · File 05 cannot render two blocks with the same heading", (t) => {
  for (const term of engine.terminals) {
    const f5 = renderPack(term.id)["frcgw-05"];
    const headings = f5.match(/<h3>[^<]*<\/h3>/g) ?? [];
    t.assert.strictEqual(new Set(headings).size, headings.length,
      `${term.id}: File 05 repeated a heading — ${headings.join(" | ")}`);
  }
});

// ── W2 · fact rules ──────────────────────────────────────────────────────────
test("frcgw-rebuild · W2 · fact rules resolve by product id, so both assess paths get them", (t) => {
  const { getFactRules, PRODUCT_FACT_RULES } = req(path.join(REPO, "lib", "fact-rules.ts"));
  const rules = getFactRules(PRODUCT);
  t.assert.ok(rules.length >= 5, `expected a fact sheet, got ${rules.length} rules`);
  t.assert.ok(PRODUCT_FACT_RULES[PRODUCT], "FRCGW missing from the registry");
  t.assert.deepStrictEqual(getFactRules("some-unregistered-product"), [],
    "an unregistered product must inject nothing");

  // The registry lookup inside generateAssessment is what reaches the webhook, which builds
  // its own AssessInput and passes no factRules argument.
  const core = fs.readFileSync(path.join(REPO, "lib", "assess-core.ts"), "utf8");
  t.assert.match(core, /getFactRules\(product_id\)/,
    "assess-core does not resolve fact rules from the registry — the webhook path would miss them");
});

test("frcgw-rebuild · W2 · the config's factRules match the runtime registry exactly", (t) => {
  const { PRODUCT_CONFIG } = req(path.join(COLE_ROOT, "config", "au-19-frcgw-clearance-certificate.ts"));
  const { getFactRules } = req(path.join(REPO, "lib", "fact-rules.ts"));
  t.assert.deepStrictEqual(PRODUCT_CONFIG.factRules, getFactRules(PRODUCT),
    "cole/config and lib/fact-rules.ts have drifted");
});

test("frcgw-rebuild · W2 · every dispatched fact rule is present in the sheet", (t) => {
  const sheet = req(path.join(REPO, "lib", "fact-rules.ts")).getFactRules(PRODUCT).join("\n");
  const REQUIRED: Array<[RegExp, string]> = [
    [/1-4 weeks/i, "must forbid the 1-4 weeks phrasing"],
    [/issue within days/i, "must give the correct processing phrasing"],
    [/allow up to 28/i, "must give the ATO's outer allowance"],
    [/locked up/i, "must forbid 'locked up'"],
    [/WITHHELD AND CREDITED/i, "must state withheld-and-credited"],
    [/6-18 months/i, "must forbid the generic 6-18 months range"],
    [/AROUND\s+15\s+MONTHS/i, "must give the contract-year-derived ~15 months"],
    [/income year the CONTRACT was/i, "must state the contract-year rule"],
    [/PURCHASER withholds/i, "must name the purchaser as the withholder"],
    [/never exempt/i, "must say a resident without a certificate was not exempt"],
    [/variation NOTICE/i, "must say notice, not certificate"],
  ];
  for (const [needle, why] of REQUIRED) t.assert.match(sheet, needle, why);
});

// ── W3 · accountant questions must be answerable by an accountant ────────────
test("frcgw-rebuild · W3 · the prompt forbids asking the accountant buyer-only facts", (t) => {
  const src = fs.readFileSync(path.join(REPO, "lib", "assess-core.ts"), "utf8");
  t.assert.match(src, /answerable BY THE ACCOUNTANT/i, "the rule is missing from the prompt");
  t.assert.match(src, /must NEVER be asked/i, "the prohibition is missing");
  t.assert.match(src, /BRING, not something to ask/i, "the bring-vs-ask instruction is missing");
  // The worked examples are what make the rule operational rather than decorative.
  t.assert.match(src, /BAD:\s+"What was my sale price\?"/, "missing the sale-price counter-example");
  t.assert.match(src, /BAD:\s+"Has my settlement happened yet\?"/, "missing the settlement counter-example");
  t.assert.match(src, /GOOD:.*Am I an Australian resident for tax purposes/, "missing a GOOD example");
});

test("frcgw-rebuild · W3 · File 05's own questions obey the same rule", (t) => {
  for (const term of engine.terminals) {
    const f5 = renderPack(term.id)["frcgw-05"];
    for (const q of f5.match(/"[^"]{15,200}\?"/g) ?? []) {
      t.assert.ok(!/what (was|did) (my|I)\b[^"]*\b(sale price|pay)/i.test(q),
        `${term.id}: File 05 asks the accountant a buyer-only fact — ${q}`);
      t.assert.ok(!/has my settlement/i.test(q),
        `${term.id}: File 05 asks the accountant whether settlement happened — ${q}`);
    }
  }
});

// ── W4 · checklist heading ───────────────────────────────────────────────────

// ═════════════════════════════════════════════════════════════════════════════
// WALK-B RERUN (W4 stored path, W6, NIT). Added 2026-08-16.
// ═════════════════════════════════════════════════════════════════════════════

const { terminalFlags, resolveTerminalId, RETIRED_TERMINALS } =
  req(path.join(REPO, "lib", "terminal-presentation.ts"));

/**
 * The shipped checklistHeading(), re-expressed against the real terminalFlags().
 *
 * WHY A MIRROR AND WHY THAT IS NOW SAFE. success/plan/page.tsx is a .tsx using the "@/"
 * alias, which this CommonJS ts-node project cannot resolve, so the function itself cannot be
 * imported here. The PREVIOUS version of this test dealt with that by regex-matching the
 * page's SOURCE TEXT for the strings it hoped would render — which is exactly why it passed
 * while the live render failed: the strings were present, the logic that selects them was
 * reading the wrong flag bag. This mirror calls the real terminalFlags() on the real
 * presentation map, so the SELECTION is genuinely exercised; a guard test below pins the
 * mirror to the page's actual source so the two cannot drift.
 */
function checklistHeadingMirror(ctx: any): string {
  const flags = terminalFlags(PRODUCT, ctx);
  if (flags.includes("section:recovery")) return "What to do, in order, to recover the withheld amount";
  if (flags.includes("state:settled")) return "What to do, in order, to close this sale out";
  return ctx?.values?.settlement_date
    ? `What to do — in order — before ${ctx.values.settlement_date}`
    : "What to do, in order, before settlement";
}

/** A context as the STORED path builds it: no sessionStorage, terminal from the DB. */
function storedCtx(terminalId: string | null) {
  return buildBuyerContext({ productId: PRODUCT, terminalId, tier: 2 });
}

test("frcgw-rebuild · W4 · docFlags are NOT in ctx.flags — the bug the heading had", (t) => {
  const ctx = storedCtx("no-certificate-resident");
  // This is the measured root cause, pinned so it cannot be forgotten: section:recovery is a
  // docFlag and has never been in BuyerContext.flags. Any code reading ctx.flags for one is
  // silently dead.
  t.assert.ok(!ctx.flags.includes("section:recovery"),
    "ctx.flags now carries docFlags — if that changed deliberately, terminalFlags() is redundant");
  t.assert.ok(!ctx.flags.includes("state:settled"));
  t.assert.ok(terminalFlags(PRODUCT, ctx).includes("section:recovery"),
    "terminalFlags() must merge the docFlags in");
});

test("frcgw-rebuild · W4 · the heading resolves identically on the stored and client paths", (t) => {
  const CASES: Array<[string, string]> = [
    ["no-certificate-resident", "What to do, in order, to recover the withheld amount"],
    ["no-certificate-non-resident", "What to do, in order, to recover the withheld amount"],
    ["no-certificate-unsure-residency", "What to do, in order, to recover the withheld amount"],
    ["certificate-provided-no-withholding", "What to do, in order, to close this sale out"],
    ["when-to-apply-timeline", "What to do, in order, before settlement"],
    ["certificate-pending-resident", "What to do, in order, before settlement"],
  ];
  for (const [terminalId, expected] of CASES) {
    // STORED path: terminal from the DB, no sessionStorage at all.
    t.assert.strictEqual(checklistHeadingMirror(storedCtx(terminalId)), expected,
      `${terminalId}: stored path`);
    // CLIENT path: same terminal, plus the engine answers sessionStorage would carry.
    const client = buildBuyerContext({
      productId: PRODUCT, terminalId, tier: 2,
      rawAnswers: { q1_scope: "in_scope", q2_knowledge: "no_cert" },
    });
    t.assert.strictEqual(checklistHeadingMirror(client), expected, `${terminalId}: client path`);
  }
});

test("frcgw-rebuild · W4 · a captured settlement date does not override a settled terminal", (t) => {
  const ctx = buildBuyerContext({
    productId: PRODUCT, terminalId: "no-certificate-resident", tier: 2,
    rawAnswers: { q6_settlement_date: "2026-12-01" },
  });
  t.assert.strictEqual(checklistHeadingMirror(ctx),
    "What to do, in order, to recover the withheld amount",
    "the date branch won over the settled branch");
});

test("frcgw-rebuild · W4 · the mirror matches the shipped checklistHeading source", (t) => {
  const src = fs.readFileSync(
    path.join(REPO, "app", "au", "check", PRODUCT, "success", "plan", "page.tsx"), "utf8");
  const fn = /export function checklistHeading[\s\S]*?\n}/.exec(src);
  t.assert.ok(fn, "checklistHeading not found");
  const body = fn![0];
  t.assert.match(body, /terminalFlags\(PRODUCT_ID, ctx\)/,
    "the shipped function no longer reads the merged flag set — the mirror is now lying");
  t.assert.ok(!/ctx\?\.flags\s*\?\?\s*\[\]/.test(body),
    "the shipped function went back to reading ctx.flags directly");
  for (const s2 of ["section:recovery", "state:settled",
                    "to recover the withheld amount", "to close this sale out",
                    "before settlement"]) {
    t.assert.ok(body.includes(s2), `shipped function missing ${s2}`);
  }
});

test("frcgw-rebuild · W4 · the stored path can recover the terminal server-side", (t) => {
  const api = fs.readFileSync(path.join(REPO, "app", "api", "get-assessment", "route.ts"), "utf8");
  t.assert.match(api, /decision_session_id/, "get-assessment does not read the decision-session link");
  t.assert.match(api, /decision_sessions/, "get-assessment does not resolve the terminal");
  t.assert.match(api, /terminalId/, "get-assessment does not return terminalId");

  for (const tierDir of ["assess", "plan"]) {
    const page = fs.readFileSync(
      path.join(REPO, "app", "au", "check", PRODUCT, "success", tierDir, "page.tsx"), "utf8");
    t.assert.match(page, /d\.terminalId/, `${tierDir} page ignores the server-resolved terminal`);
    // D8 widened this call to carry the settlement date too; the terminal is the first
    // override and must still be passed.
    t.assert.match(page, /buyerContextFromSession\(PRODUCT_ID, TIER, storedTerminal[,)]/,
      `${tierDir} page does not rebuild its context from the server-resolved terminal`);
  }
});

test("frcgw-rebuild · W4 · retired pre-E2 terminal ids still resolve", (t) => {
  // Measured on the live table 2026-08-16: stored rows still reference these ids, which E2
  // split into residency variants. Without the alias they fall back to the neutral default.
  const aliases = RETIRED_TERMINALS[PRODUCT];
  t.assert.ok(aliases["certificate-pending-at-settlement"], "pending alias missing");
  t.assert.ok(aliases["no-certificate-withholding-applies"], "no-cert alias missing");
  for (const [oldId, newId] of Object.entries(aliases) as Array<[string, string]>) {
    t.assert.ok(engine.terminals.some((x: any) => x.id === newId),
      `${oldId} aliases to ${newId}, which is not a real terminal`);
    t.assert.strictEqual(resolveTerminalId(PRODUCT, oldId), newId);
    t.assert.ok(getTerminalPresentation(PRODUCT, oldId, { headline: "FALLBACK", fileSlugs: [] }).strip.headline !== "FALLBACK",
      `${oldId} still degrades to the neutral default`);
  }
  t.assert.strictEqual(checklistHeadingMirror(storedCtx("no-certificate-withholding-applies")),
    "What to do, in order, to recover the withheld amount",
    "a pre-E2 no-certificate row still gets the pre-settlement heading");
  // A live id must pass straight through.
  t.assert.strictEqual(resolveTerminalId(PRODUCT, "no-certificate-resident"), "no-certificate-resident");
});

// ── W6 · File 06 must contain no pre-settlement content on a settled sale ────
test("frcgw-rebuild · W6 · File 06 on no_cert+resident has no pre-settlement content", (t) => {
  const f6 = renderPack("no-certificate-resident")["frcgw-06"];

  const BANNED: Array<[RegExp, string]> = [
    [/week before settlement/i, "Phase 3's 'the week before settlement'"],
    [/calendar first/i, "the 'put your settlement date in your calendar first' intro"],
    [/pre-settlement plan/i, "the pre-settlement heading"],
    [/Phase 3/i, "Phase 3 (pre-settlement by definition)"],
    [/Phase 4/i, "Phase 4 (pre-settlement by definition)"],
    [/work backwards from it/i, "the work-back-from-settlement instruction"],
    [/before settlement/i, "any future-settlement instruction"],
    [/Confirm in writing that the purchaser's side holds the certificate/i, "the pre-settlement confirmation step"],
  ];
  for (const [re, why] of BANNED) {
    t.assert.ok(!re.test(f6), `File 06 still renders ${why} for a settled sale`);
  }

  // and the recovery sequence IS there, and is the only sequence.
  t.assert.match(f6, /Your recovery plan/i, "missing the recovery heading");
  t.assert.match(f6, /Phase 1 — Now/, "missing the recovery Phase 1");
  t.assert.match(f6, /Phase 2 — At the next return/, "missing the recovery Phase 2");
  t.assert.strictEqual((f6.match(/<h2>Phase \d/g) ?? []).length, 2,
    "a settled sale must render exactly the two recovery phases");
});

test("frcgw-rebuild · W6 · pre-settlement terminals keep Phases 3 and 4", (t) => {
  for (const id of ["when-to-apply-timeline", "certificate-pending-resident", "co-owners-separate-certificates"]) {
    const f6 = renderPack(id)["frcgw-06"];
    t.assert.match(f6, /Phase 3 — The week before settlement/, `${id}: lost Phase 3`);
    t.assert.match(f6, /Phase 4 — If a certificate is not held at settlement/, `${id}: lost Phase 4`);
    t.assert.match(f6, /pre-settlement plan/i, `${id}: lost the pre-settlement heading`);
  }
});

test("frcgw-rebuild · W6 · certificate-provided gets the close-out sequence, not recovery", (t) => {
  const f6 = renderPack("certificate-provided-no-withholding")["frcgw-06"];
  t.assert.match(f6, /Closing this sale out/i, "missing the close-out heading");
  t.assert.ok(!/pre-settlement plan/i.test(f6), "a settled sale still shows the pre-settlement heading");
  t.assert.ok(!/Phase 3|Phase 4/.test(f6), "a settled sale still shows the pre-settlement phases");
  t.assert.ok(!/Your recovery plan/i.test(f6),
    "a buyer who provided a certificate is offered a recovery plan for a withholding that never happened");
});

// ── NIT · no invented ATO form names ─────────────────────────────────────────
test("frcgw-rebuild · NIT · the fact sheet forbids naming ATO forms not in the corpus", (t) => {
  const sheet = req(path.join(REPO, "lib", "fact-rules.ts")).getFactRules(PRODUCT).join("\n");
  t.assert.match(sheet, /FORM NAMES/, "the form-name rule is missing");
  t.assert.match(sheet, /do NOT name a specific ATO form/i, "the prohibition is missing");
  t.assert.match(sheet, /unless that exact name appears in the corpus/i, "the corpus exception is missing");
  t.assert.match(sheet, /payment notification to the ATO/i, "the dispatched example wording is missing");
});


// ═════════════════════════════════════════════════════════════════════════════
// D8 — the buyer's settlement date on the STORED path. Added 2026-08-16.
// ═════════════════════════════════════════════════════════════════════════════

const { SETTLEMENT_DATE_FIELD, dateAnswerField, DATE_ANSWER_FIELD } =
  req(path.join(REPO, "lib", "buyer-context.ts"));

/** The dated surfaces, derived exactly as the pages derive them. */
function datedSurfaces(ctx: any) {
  const pres = getTerminalPresentation(PRODUCT, ctx.terminalId, { headline: "", fileSlugs: [] });
  const cal = resolveCalendar(pres.calendar, ctx, new Date("2026-08-16T00:00:00Z"));
  return {
    settlement_date: ctx.values.settlement_date ?? null,
    lodge_by_date: ctx.values.lodge_by_date ?? null,
    days_to_settlement: ctx.values.days_to_settlement ?? null,
    hasFlag: ctx.flags.includes("has:settlement_date"),
    proximity: ctx.flags.filter((f: string) => f.startsWith("settlement:")).join(",") || null,
    datedEvents: cal.filter((e: any) => e.isoDate).map((e: any) => `${e.uid}@${e.isoDate}`).join(" | "),
  };
}

test("frcgw-rebuild · D8 · the measured raw-answer key is the one the code reads", (t) => {
  // MEASURED on live decision_sessions row d1c7df00-e116-4ffc-b480-d05061c04c21 (2026-08-16):
  //   output.raw_answers.q6_settlement_date = "2026-08-26"
  t.assert.strictEqual(SETTLEMENT_DATE_FIELD, "q6_settlement_date");
  t.assert.strictEqual(dateAnswerField(PRODUCT), "q6_settlement_date");
  t.assert.strictEqual(dateAnswerField("some-other-product"), null,
    "a product with no date question must resolve to null, not to FRCGW's key");
  // And the engine really does emit that id, so the map cannot rot against the question set.
  t.assert.ok(engine.questions.some((q: any) => q.id === SETTLEMENT_DATE_FIELD && q.type === "date"),
    "engine.json has no date question with that id");
  t.assert.ok(Object.keys(DATE_ANSWER_FIELD).includes(PRODUCT));
});

test("frcgw-rebuild · D8 · stored-path date produces surfaces identical to the client path", (t) => {
  const ISO = "2026-12-01";
  // CLIENT: the date came out of sessionStorage with the rest of the answers.
  const client = buildBuyerContext({
    productId: PRODUCT, terminalId: "when-to-apply-timeline", tier: 2,
    rawAnswers: { q1_scope: "in_scope", [SETTLEMENT_DATE_FIELD]: ISO },
  });
  // STORED: no sessionStorage at all; terminal and date both came from the DB.
  const stored = buildBuyerContext({
    productId: PRODUCT, terminalId: "when-to-apply-timeline", tier: 2,
    rawAnswers: { [SETTLEMENT_DATE_FIELD]: ISO },
  });

  t.assert.deepStrictEqual(datedSurfaces(stored), datedSurfaces(client),
    "the stored path renders different dated surfaces from the client path");

  // and they are actually populated, not identically empty.
  const s = datedSurfaces(stored);
  t.assert.strictEqual(s.settlement_date, "1 December 2026");
  t.assert.strictEqual(s.lodge_by_date, "3 November 2026", "lodge-by must be settlement minus 28 days");
  t.assert.ok(s.hasFlag, "has:settlement_date not set");
  t.assert.ok(s.datedEvents.includes("frcgw-settlement@2026-12-01"), "no dated settlement event");
  t.assert.ok(s.datedEvents.includes("frcgw-lodge-by@2026-11-03"), "no dated lodge-by event");
});

test("frcgw-rebuild · D8 · no date on the stored path keeps today's undated behaviour", (t) => {
  const none = buildBuyerContext({ productId: PRODUCT, terminalId: "when-to-apply-timeline", tier: 2 });
  const s = datedSurfaces(none);
  t.assert.strictEqual(s.settlement_date, null);
  t.assert.strictEqual(s.lodge_by_date, null);
  t.assert.ok(!s.hasFlag);
  // Settlement-anchored events are DROPPED, never defaulted.
  t.assert.ok(!/frcgw-settlement@|frcgw-lodge-by@/.test(s.datedEvents),
    "a settlement-anchored event was dated without a settlement date");

  // The skip answer must behave as no date, not as an unparseable one.
  const skipped = buildBuyerContext({
    productId: PRODUCT, terminalId: "when-to-apply-timeline", tier: 2,
    rawAnswers: { [SETTLEMENT_DATE_FIELD]: "not_scheduled" },
  });
  t.assert.deepStrictEqual(datedSurfaces(skipped), s, "the skip value did not degrade to undated");
});

test("frcgw-rebuild · D8 · get-assessment returns the date and both pages consume it", (t) => {
  const api = fs.readFileSync(path.join(REPO, "app", "api", "get-assessment", "route.ts"), "utf8");
  t.assert.match(api, /raw_answers/, "the API does not read raw_answers");
  t.assert.match(api, /dateAnswerField\(data\.product_id\)/,
    "the API hardcodes the answer key instead of resolving it per product");
  t.assert.match(api, /settlementDate/, "the API does not return settlementDate");
  // Only a well-formed ISO date may be forwarded — the same slot holds the skip value.
  t.assert.match(api, /\\d\{4\}-\\d\{2\}-\\d\{2\}/, "the API forwards the answer without validating it");

  for (const tierDir of ["assess", "plan"]) {
    const page = fs.readFileSync(
      path.join(REPO, "app", "au", "check", PRODUCT, "success", tierDir, "page.tsx"), "utf8");
    t.assert.match(page, /d\.settlementDate/, `${tierDir} page ignores the server-resolved date`);
    t.assert.match(page, /buyerContextFromSession\(PRODUCT_ID, TIER, storedTerminal, storedDate\)/,
      `${tierDir} page does not rebuild its context from both overrides in one call`);
  }
});

/** Every document that renders a lodge-by / settlement dates box, found not assumed. */
function filesWithDatesBox(): string[] {
  return Object.keys(docs).filter((s) => /Lodge by:/i.test(docs[s].content));
}

/** Every terminal whose docFlags mark the sale as already settled. */
function settledTerminals(): string[] {
  return engine.terminals
    .map((x: any) => x.id)
    .filter((id: string) =>
      getTerminalPresentation(PRODUCT, id, { headline: "", fileSlugs: [] })
        .docFlags.includes("state:settled"));
}

test("frcgw-rebuild · D9 · no settled terminal renders a lodge-by, in ANY file carrying a dates box", (t) => {
  // ENUMERATED, not hardcoded. The D8 version of this test named File 01 and File 06 by hand
  // and therefore could not see File 02, which had no state:settled guard at all and rendered
  // "Your settlement: 1 December 2026. Lodge by: 3 November 2026" on a settled sale. A test
  // that lists the files it checks can only ever find the files someone remembered.
  const files = filesWithDatesBox();
  const settled = settledTerminals();
  t.assert.ok(files.length >= 3, `expected several files with a dates box, found ${files.length}`);
  t.assert.ok(settled.length >= 4, `expected the settled terminals, found ${settled.length}`);

  for (const id of settled) {
    const ctx = buildBuyerContext({
      productId: PRODUCT, terminalId: id, tier: 2,
      rawAnswers: { [SETTLEMENT_DATE_FIELD]: "2026-12-01" },
    });
    const pres = getTerminalPresentation(PRODUCT, id, { headline: "", fileSlugs: [] });
    const flags = [...ctx.flags, ...pres.docFlags];
    t.assert.ok(ctx.values.lodge_by_date, "the context did compute a lodge-by date to leak");

    for (const slug of files) {
      const html = renderDocTemplate(docs[slug].content, { values: ctx.values, flags });
      t.assert.ok(!/Lodge by:/i.test(html), `${id} / ${slug}: lodge-by rendered on a settled sale`);
      t.assert.ok(!html.includes(ctx.values.lodge_by_date),
        `${id} / ${slug}: the computed lodge-by date leaked onto a settled sale`);
    }
  }
});

test("frcgw-rebuild · D9 · every file with a dates box guards it on state:settled", (t) => {
  // The structural counterpart: the render test above proves today's output is right, this
  // proves the guard is actually present, so a new dates box cannot be added without one.
  for (const slug of filesWithDatesBox()) {
    t.assert.match(docs[slug].content, /\{\{#unless state:settled\}\}/,
      `${slug} renders a lodge-by but never guards on state:settled`);
  }
});

test("frcgw-rebuild · D9 · settled terminals keep their settled variants", (t) => {
  for (const id of settledTerminals()) {
    const ctx = buildBuyerContext({
      productId: PRODUCT, terminalId: id, tier: 2,
      rawAnswers: { [SETTLEMENT_DATE_FIELD]: "2026-12-01" },
    });
    const pres = getTerminalPresentation(PRODUCT, id, { headline: "", fileSlugs: [] });
    const flags = [...ctx.flags, ...pres.docFlags];
    const f1 = renderDocTemplate(docs["frcgw-01"].content, { values: ctx.values, flags });
    const f6 = renderDocTemplate(docs["frcgw-06"].content, { values: ctx.values, flags });
    t.assert.match(f1, /settlement has already happened/i, `${id}: File 01 lost the settled variant`);
    t.assert.ok(!/pre-settlement plan/i.test(f6), `${id}: File 06 rendered the pre-settlement heading`);
  }
});

// ── D9-2 · File 03 must not offer a hand-over template to a settled sale ─────
test("frcgw-rebuild · D9 · File 03 renders no cover-note template on the recovery terminals", (t) => {
  const recovery = engine.terminals
    .map((x: any) => x.id)
    .filter((id: string) =>
      getTerminalPresentation(PRODUCT, id, { headline: "", fileSlugs: [] })
        .docFlags.includes("section:recovery"));
  t.assert.strictEqual(recovery.length, 3, `expected the three no-certificate terminals, got ${recovery.length}`);

  for (const id of recovery) {
    const f3 = renderPack(id)["frcgw-03"];
    t.assert.ok(!/Cover-note template/i.test(f3), `${id}: still offers the hand-over cover note`);
    t.assert.ok(!/Handing over the certificate/i.test(f3), `${id}: still offers the hand-over heading`);
    t.assert.ok(!/Please find attached the ATO clearance certificate/i.test(f3),
      `${id}: still transmits a certificate the buyer never held`);
    t.assert.ok(!/Pending-notice template/i.test(f3), `${id}: offers a pending notice too`);
    // The recovery variant, and the dispatched wording.
    t.assert.match(f3, /nothing to send about the withholding/i, `${id}: missing the recovery variant`);
    t.assert.match(f3, /payment notification to the ATO/i, `${id}: missing the payment-notification request`);
  }
});

test("frcgw-rebuild · D9 · File 03 still serves the pending and hand-over cases", (t) => {
  for (const id of ["certificate-pending-resident", "certificate-pending-non-resident",
                    "certificate-pending-unsure-residency"]) {
    const f3 = renderPack(id)["frcgw-03"];
    t.assert.match(f3, /Pending-notice template/i, `${id}: lost the pending notice`);
    t.assert.ok(!/nothing to send about the withholding/i.test(f3), `${id}: got the recovery variant`);
  }
  for (const id of ["when-to-apply-timeline", "certificate-provided-no-withholding", "co-owners-separate-certificates"]) {
    const f3 = renderPack(id)["frcgw-03"];
    t.assert.match(f3, /Cover-note template/i, `${id}: lost the hand-over cover note`);
    t.assert.ok(!/nothing to send about the withholding/i.test(f3), `${id}: got the recovery variant`);
  }
});

test("frcgw-rebuild · D9 · File 03 renders exactly one template on every terminal", (t) => {
  for (const term of engine.terminals) {
    const f3 = renderPack(term.id)["frcgw-03"];
    const n = ["Pending-notice template", "Cover-note template", "What to request instead"]
      .filter((h) => f3.includes(h)).length;
    t.assert.strictEqual(n, 1, `${term.id}: File 03 rendered ${n} templates, expected exactly 1`);
  }
});

// ── D9-3 · no resolved terminal may render an empty calendar ─────────────────
test("frcgw-rebuild · D9 · certificate-expired-long-contract has a dated event without a date", (t) => {
  const id = "certificate-expired-long-contract";
  const ctx = buildBuyerContext({ productId: PRODUCT, terminalId: id, tier: 1 });
  const pres = getTerminalPresentation(PRODUCT, id, { headline: "", fileSlugs: [] });
  const cal = resolveCalendar(pres.calendar, ctx, new Date("2026-08-16T00:00:00Z"));
  t.assert.ok(cal.length > 0, "the undated calendar is empty again");
  t.assert.ok(cal.some((e: any) => e.uid === "frcgw-reapply" && e.isoDate === "2026-08-16"),
    "the today-anchored re-apply event is missing or undated");
  // and the settlement-anchored ones are still dropped, not defaulted.
  t.assert.ok(!cal.some((e: any) => ["frcgw-lodge-by", "frcgw-settlement", "frcgw-confirm"].includes(e.uid)),
    "a settlement-anchored event was dated without a settlement date");

  // With a date, all four resolve.
  const dated = buildBuyerContext({
    productId: PRODUCT, terminalId: id, tier: 1,
    rawAnswers: { [SETTLEMENT_DATE_FIELD]: "2026-12-01" },
  });
  const cal2 = resolveCalendar(pres.calendar, dated, new Date("2026-08-16T00:00:00Z"));
  t.assert.strictEqual(cal2.length, 4, "the dated calendar lost an event");
  t.assert.ok(cal2.every((e: any) => e.isoDate), "an event resolved without a date");
});

test("frcgw-rebuild · D9 · no RESOLVED terminal renders an empty undated calendar", (t) => {
  // Escapes are allowed to have none — they assert no position and offer no plan.
  for (const term of engine.terminals) {
    if (term.escape) continue;
    const ctx = buildBuyerContext({ productId: PRODUCT, terminalId: term.id, tier: term.tier >= 147 ? 2 : 1 });
    const pres = getTerminalPresentation(PRODUCT, term.id, { headline: "", fileSlugs: [] });
    const cal = resolveCalendar(pres.calendar, ctx, new Date("2026-08-16T00:00:00Z"));
    t.assert.ok(cal.length > 0,
      `${term.id}: a paying buyer with no captured date is given no dates at all`);
  }
});
