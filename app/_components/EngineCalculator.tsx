"use client";

/**
 * EngineCalculator — generic renderer for a v2 FLAG-ROUTED decision maze (Decision Graph Bee).
 *
 * Contract (engine.json v2):
 *   questions[]     — { id, text, criticality, showIf?: FlagExpr, options[] }
 *   options[]       — { label, value, flags: string[], sub_label? }   (options EMIT flags)
 *   derived_flags[] — { name, when: FlagExpr }                        (computed, e.g. `eligible`)
 *   terminals[]     — { id, when?: FlagExpr, tier, severity, criticality, escape, title_key,
 *                       heading, result_copy, complexity_name?, modifiers? }  (priority order)
 *
 * Routing: answered options accumulate a FLAG SET (+ generic `any_unsure` + engine-derived
 * flags). Questions gate on showIf(flags). When all applicable questions are answered, the
 * first terminal whose `when` matches the flag set is the result. No path enumeration; the
 * combination of facts produces the terminal (fact-first maze).
 *
 * STRUCTURE lives here; all DOMAIN WORDS + severity/tier come from config/engine.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EngineVerdictPanel from "@/app/_components/EngineVerdictPanel";
import EngineQualPopup from "@/app/_components/EngineQualPopup";
import EngineSellPopup from "@/app/_components/EngineSellPopup";
import { resolveTerminalFigures, type EngineConfidence, type EngineFigure } from "@/app/_components/engine-terms";
import {
  altTier,
  bridgeCopyFor,
  ctaLabelFor,
  escapeBodyFor,
  escapeCtaLabelFor,
  escapeLabelFor,
  fmtPrice,
  getItLabelFor,
  heroCopyFor,
  monetizeEveryResolved,
  payLabelFor,
  planChecklistFor,
  priceForTier,
  qualFields,
  resultLabelFor,
  saveHeadingFor,
  saveSubcopyFor,
  secondaryTierLabelFor,
  sellSubheadFor,
  sellTitleFor,
  type EngineConfig,
  type PinnedTier,
  type Severity,
} from "@/app/_components/engine-config";

// ── v2 engine contract (permissive — extra fields tolerated) ─────────────────
export interface FlagExpr { all?: string[]; any?: string[]; none?: string[] }
export interface EngineOption { label: string; value: string; flags?: string[]; sub_label?: string; subLabel?: string }
export interface EngineQuestion { id: string; text: string; criticality?: string; sub_label?: string; showIf?: FlagExpr; options: EngineOption[] }
export interface EngineTerminalDef {
  id: string;
  when?: FlagExpr;
  tier: number;
  severity: Severity;
  criticality?: string;
  escape?: boolean;
  title_key?: "product" | "review_guide";
  heading: string;
  result_copy: string;
  complexity_name?: string;
  modifiers?: { when: FlagExpr; append: string }[];
  figure_ids?: string[]; // P2.5: figures bound to this terminal at emit (deterministic); absent → runtime resolve
}
export interface DerivedFlag { name: string; when: FlagExpr }
export interface Engine {
  questions?: EngineQuestion[];
  terminals?: EngineTerminalDef[];
  derived_flags?: DerivedFlag[];
  figures?: EngineFigure[];
}

export interface EngineTerminal { kind: "menu" | "escape"; id: string; label: string }
export interface EngineCompletion { answers: Record<string, string>; terminal: EngineTerminal; confidence: EngineConfidence | null; statFigures: EngineFigure[] }
export interface EngineCheckout { sessionId: string | null; terminal: EngineTerminal; tier: number; price: number; answers: Record<string, string>; qualification: Record<string, string> }

interface TrailEntry { qId: string; value: string; label: string; flags: string[] }

// ── flag evaluation ──────────────────────────────────────────────────────────
export function matchExpr(expr: FlagExpr | undefined, flags: Set<string>): boolean {
  if (!expr) return true;
  if (expr.all && !expr.all.every((f) => flags.has(f))) return false;
  if (expr.any && expr.any.length > 0 && !expr.any.some((f) => flags.has(f))) return false;
  if (expr.none && expr.none.some((f) => flags.has(f))) return false;
  return true;
}
function computeFlags(trail: TrailEntry[], derived: DerivedFlag[]): Set<string> {
  const f = new Set<string>();
  for (const t of trail) for (const fl of t.flags ?? []) f.add(fl);
  if ([...f].some((x) => x.startsWith("unsure:"))) f.add("any_unsure"); // generic, domain-free
  for (const d of derived) if (matchExpr(d.when, f)) f.add(d.name);      // engine-defined derived
  return f;
}
function optSubLabel(o: EngineOption): string | undefined {
  return o.sub_label ?? o.subLabel;
}

// ── design tokens — "the engine look" (operator-approved reel); Tailwind v4 arbitrary values, no config file ──
// canvas #F4F6FB · card #FFFFFF · ink #0F172A · muted #64748B · navy #0B1F44 · accent #2563EB · accentSoft #EFF5FF · hairline #E2E8F0
const ENGINE_CANVAS = "mx-auto w-full max-w-[820px] rounded-[28px] bg-[#F4F6FB] p-3 sm:p-6";
const ENGINE_CARD = "rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]";

// ── main ─────────────────────────────────────────────────────────────────────
export default function EngineCalculator({
  engine,
  figures,
  config,
  onComplete,
  onCheckout,
}: {
  engine: Engine;
  figures?: EngineFigure[];
  config?: EngineConfig;
  onComplete?: (c: EngineCompletion) => void;
  onCheckout?: (c: EngineCheckout) => void | Promise<boolean | void>;
}) {
  const questions = useMemo(() => engine.questions ?? [], [engine.questions]);
  const terminals = useMemo(() => engine.terminals ?? [], [engine.terminals]);
  const derived = useMemo(() => engine.derived_flags ?? [], [engine.derived_flags]);
  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const pool = useMemo<EngineFigure[]>(() => figures ?? engine.figures ?? [], [figures, engine.figures]);

  const [trail, setTrail] = useState<TrailEntry[]>([]);
  const [pending, setPending] = useState<string | null>(null);

  // ── session / tier / popup / email state ──
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pinnedTier, setPinnedTier] = useState<PinnedTier | null>(null);
  const [qual, setQual] = useState<Record<string, string>>({});
  const [popupStage, setPopupStage] = useState<0 | 1 | 2>(0);
  const [popupTier, setPopupTier] = useState<PinnedTier | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const postedFor = useRef<string | null>(null);
  const firedFor = useRef<string | null>(null);

  const clearSession = useCallback(() => {
    setSessionId(null); setPinnedTier(null); setQual({}); setPopupStage(0);
    setPopupTier(null); setPaying(false); setEmail(""); setEmailSent(false);
    postedFor.current = null;
  }, []);

  useEffect(() => {
    setTrail([]); setPending(null); clearSession();
  }, [questions, clearSession]);

  // ── flag state + routing ──
  const flags = useMemo(() => computeFlags(trail, derived), [trail, derived]);
  const applicable = useMemo(() => questions.filter((q) => matchExpr(q.showIf, flags)), [questions, flags]);
  const answeredIds = useMemo(() => new Set(trail.map((t) => t.qId)), [trail]);
  const currentQ = useMemo(() => applicable.find((q) => !answeredIds.has(q.id)), [applicable, answeredIds]);
  const anyUnsure = flags.has("any_unsure");

  // B1 — showIf-aware TRUE remaining depth of the current branch. A not-yet-answered
  // question counts only if it can still be shown: its `none` flags aren't already set,
  // and its `all`/`any` flags are still ACHIEVABLE (present, or emittable by some
  // still-unanswered question). So M narrows as gates are ruled out (PR/unsure → fewer).
  const remainingDepth = useMemo(() => {
    const achievable = new Set(flags);
    for (const q of questions) if (!answeredIds.has(q.id)) for (const o of q.options ?? []) for (const fl of o.flags ?? []) achievable.add(fl);
    const couldShow = (q: EngineQuestion): boolean => {
      const s = q.showIf;
      if (!s) return true;
      if (s.none && s.none.some((f) => flags.has(f))) return false;
      if (s.all && !s.all.every((f) => achievable.has(f))) return false;
      if (s.any && s.any.length > 0 && !s.any.some((f) => achievable.has(f))) return false;
      return true;
    };
    return trail.length + questions.filter((q) => !answeredIds.has(q.id) && couldShow(q)).length;
  }, [questions, answeredIds, flags, trail.length]);

  const matched = useMemo<EngineTerminalDef | null>(() => {
    if (currentQ) return null; // still asking
    return terminals.find((t) => matchExpr(t.when, flags)) ?? null;
  }, [currentQ, terminals, flags]);

  const answers = useMemo(() => Object.fromEntries(trail.map((t) => [t.qId, t.value])), [trail]);
  const labeledAnswers = useMemo(
    () => Object.fromEntries(trail.map((t) => [qById.get(t.qId)?.text ?? t.qId, t.label])),
    [trail, qById],
  );

  // ── terminal derivation: composed copy (+ modifiers), figures, confidence ──
  const terminal = useMemo(() => {
    if (!matched) return null;
    let copy = matched.result_copy;
    for (const m of matched.modifiers ?? []) if (matchExpr(m.when, flags)) copy += ` ${m.append}`;
    const escape = !!matched.escape;
    const context = [matched.id, matched.heading, copy, ...trail.flatMap((t) => [t.value, t.label])].join(" ");
    // P2.5: prefer the emit-time deterministic binding (figure_ids). Absent (e.g. NZ, pre-P2.5 engines) →
    // fall back to the runtime resolver — identical behaviour, zero regression.
    const statFigures = escape
      ? []
      : matched.figure_ids && matched.figure_ids.length
        ? pool.filter((f) => f.id != null && matched.figure_ids!.includes(f.id)).slice(0, 3)
        : resolveTerminalFigures(pool, context, { maxN: 3 });
    const confidence: EngineConfidence | null = escape
      ? null
      : { level: anyUnsure ? "MEDIUM" : "HIGH", checklist: trail.map((t) => t.label) };
    return {
      id: matched.id, heading: matched.heading, copy, escape,
      severity: matched.severity, tier: matched.tier, titleKey: matched.title_key ?? "product",
      statFigures, confidence,
    };
  }, [matched, flags, pool, trail, anyUnsure]);

  // ── tier + confidence sell-rule (ruling 6) ──
  // A $147 "confirmed position" requires zero unsure flags; else the dish sells $67-PRIMARY.
  const primaryTier = terminal
    ? terminal.escape
      ? 67
      : terminal.tier === 147 && anyUnsure
        ? 67
        : terminal.tier
    : null;
  const liveTier: PinnedTier | null = primaryTier == null ? null : { tier: primaryTier, price: priceForTier(config, primaryTier) };
  const tierInfo = pinnedTier ?? liveTier;
  const monetize = monetizeEveryResolved(config);
  // Escapes always monetise $67 (B5); resolved-blue monetises only when the flag is on (ruling 7).
  const showCta = !!terminal && (terminal.escape || monetize || terminal.severity !== "blue");
  const monetizable = !!terminal && !!tierInfo;

  // ── HYDRATION: ?session_id= → replay from raw answers → flags → terminal ──
  const replayFromRaw = useCallback((raw: Record<string, string>): TrailEntry[] => {
    const t: TrailEntry[] = [];
    const answered = new Set<string>();
    for (let guard = 0; guard < questions.length + 1; guard++) {
      const f = computeFlags(t, derived);
      const q = questions.find((x) => matchExpr(x.showIf, f) && !answered.has(x.id));
      if (!q) break;
      const o = (q.options ?? []).find((x) => x.value === raw[q.id]);
      if (!o) break;
      t.push({ qId: q.id, value: o.value, label: o.label, flags: o.flags ?? [] });
      answered.add(q.id);
    }
    return t;
  }, [questions, derived]);

  useEffect(() => {
    if (typeof window === "undefined") { setHydrated(true); return; }
    const sid = new URLSearchParams(window.location.search).get("session_id");
    if (!sid || sid.startsWith("fallback_")) { setHydrated(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/decision-sessions/${encodeURIComponent(sid)}`);
        if (!res.ok || cancelled) return;
        const row = await res.json();
        const out = (row?.output ?? {}) as { tier?: number; price?: number; raw_answers?: Record<string, string> };
        const raw = out.raw_answers ?? (row?.inputs as Record<string, string> | undefined);
        if (cancelled || !raw) return;
        const t = replayFromRaw(raw);
        setTrail(t);
        setSessionId(sid);
        const tid = terminals.find((x) => matchExpr(x.when, computeFlags(t, derived)))?.id ?? null;
        postedFor.current = tid; firedFor.current = tid;
        if (typeof out.tier === "number") setPinnedTier({ tier: out.tier, price: typeof out.price === "number" ? out.price : out.tier });
      } catch { /* non-blocking */ } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, [replayFromRaw, terminals, derived]);

  // ── onComplete once per terminal ──
  useEffect(() => {
    if (!terminal) { firedFor.current = null; return; }
    if (firedFor.current === terminal.id) return;
    firedFor.current = terminal.id;
    onComplete?.({
      answers,
      terminal: { kind: terminal.escape ? "escape" : "menu", id: terminal.id, label: terminal.heading },
      confidence: terminal.confidence,
      statFigures: terminal.statFigures,
    });
  }, [terminal, answers, onComplete]);

  // ── POST a decision session when a monetizable terminal is reached (tier PINNED) ──
  useEffect(() => {
    if (!hydrated || !monetizable || !terminal || !tierInfo) return;
    if (!config?.productSlug || sessionId) return;
    if (postedFor.current === terminal.id) return;
    postedFor.current = terminal.id;
    const slug = config.productSlug;
    try {
      sessionStorage.setItem(`${slug}_answers`, JSON.stringify(labeledAnswers));
      sessionStorage.setItem(`${slug}_terminal`, terminal.id);
      sessionStorage.setItem(`${slug}_status`, terminal.heading);
      sessionStorage.setItem(`${slug}_tier`, String(tierInfo.tier));
      if (terminal.confidence) sessionStorage.setItem(`${slug}_confidence`, terminal.confidence.level);
    } catch { /* ignore */ }
    fetch("/api/decision-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_slug: slug,
        source_path: config.sourcePath ?? window.location.pathname,
        country_code: config.country ?? "AU",
        currency_code: config.currency ?? "AUD",
        site: config.site ?? "taxchecknow",
        inputs: labeledAnswers,
        output: {
          terminal_id: terminal.id, terminal_label: terminal.heading, status: terminal.heading,
          confidence: terminal.confidence?.level ?? null, severity: terminal.severity,
          tier: tierInfo.tier, price: tierInfo.price, raw_answers: answers,
        },
        recommended_tier: tierInfo.tier,
      }),
    })
      .then((r) => r.json())
      .then((d) => { if (d?.id) { setSessionId(d.id); setPinnedTier(tierInfo); } })
      .catch(() => {});
  }, [hydrated, monetizable, terminal, tierInfo, config, sessionId, answers, labeledAnswers]);

  function openPopup(t: PinnedTier) { setPopupTier(t); setPopupStage(1); }
  function closePopup() { setPopupStage(0); }
  function setQualField(k: string, v: string) { setQual((p) => ({ ...p, [k]: v })); }

  function handleSaveEmail() {
    if (!email || !config?.productSlug) return;
    fetch("/api/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email, source: config.productSlug.replace(/-/g, "_"),
        country_code: config.country ?? "AU", site: config.site ?? "taxchecknow",
        session_id: sessionId ?? "", verdict_status: terminal?.heading ?? "",
      }),
    }).catch(() => {});
    if (sessionId) {
      fetch("/api/decision-sessions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, email }),
      }).catch(() => {});
    }
    setEmailSent(true);
  }

  async function pay() {
    if (!terminal) return;
    const buyTier = popupTier ?? tierInfo;
    if (!buyTier) return;
    setPaying(true);
    setPayError(null);
    const qualLabeled = Object.fromEntries(
      qualFields(config)
        .map((f) => [f.label, f.options.find((o) => o.value === qual[f.key])?.label ?? qual[f.key]] as const)
        .filter(([, v]) => v !== undefined && v !== ""),
    );
    if (sessionId) {
      fetch("/api/decision-sessions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, tier_intended: buyTier.tier, questionnaire_payload: qualLabeled }),
      }).catch(() => {});
    }
    try { if (config?.productSlug) sessionStorage.setItem(`${config.productSlug}_qualification`, JSON.stringify(qualLabeled)); } catch { /* ignore */ }
    // AWAIT the checkout handoff. On success it redirects (page unloads). A falsy result or a throw means
    // checkout could NOT start (e.g. the API 500'd) — surface it instead of a silent dead button.
    try {
      const ok = await onCheckout?.({
        sessionId, terminal: { kind: terminal.escape ? "escape" : "menu", id: terminal.id, label: terminal.heading },
        tier: buyTier.tier, price: buyTier.price, answers: labeledAnswers, qualification: qualLabeled,
      });
      if (ok === false) setPayError("Payment couldn't start — please try again.");
    } catch {
      setPayError("Payment couldn't start — please try again.");
    }
    setPaying(false);
  }

  function choose(o: EngineOption) {
    if (pending || !currentQ) return;
    setPending(o.value);
    const qid = currentQ.id;
    window.setTimeout(() => {
      setTrail((prev) => [...prev, { qId: qid, value: o.value, label: o.label, flags: o.flags ?? [] }]);
      setPending(null);
    }, 220);
  }
  function back() {
    if (!trail.length) return;
    const wasTerminal = !currentQ;
    setPending(null);
    setTrail((t) => t.slice(0, -1));
    firedFor.current = null;
    if (wasTerminal) clearSession();
  }
  function reset() { setPending(null); setTrail([]); firedFor.current = null; clearSession(); }

  if (!questions.length) {
    return (
      <div className={ENGINE_CANVAS}>
        <div className={ENGINE_CARD}>
          <p className="text-sm text-[#64748B]">This tool has no questions to display.</p>
        </div>
      </div>
    );
  }

  const hero = heroCopyFor(config);

  // ── QUESTION VIEW ──────────────────────────────────────────────────────────
  if (currentQ) {
    const n = trail.length + 1;
    const m = Math.max(remainingDepth, n);
    const prevValue = answers[currentQ.id];
    return (
      <div className={ENGINE_CANVAS}>
        {hero && trail.length === 0 && <p className="mb-3 px-1 text-sm leading-relaxed text-[#64748B]">{hero}</p>}
        <div className={ENGINE_CARD}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p aria-live="polite" className="text-[11px] font-medium uppercase tracking-widest text-[#64748B]">Step {n} of {m}</p>
            {trail.length > 0 && (
              <button onClick={back} className="rounded-md text-[11px] font-medium uppercase tracking-widest text-[#64748B] transition-colors hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 motion-reduce:transition-none">← Back</button>
            )}
          </div>
          <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-[#2563EB] transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${(trail.length / Math.max(m, 1)) * 100}%` }} />
          </div>
          <h2 className="mb-1 text-[21px] font-semibold leading-snug text-[#0F172A]">{currentQ.text}</h2>
          {currentQ.sub_label && <p className="mb-4 text-[13px] text-[#64748B]">{currentQ.sub_label}</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(currentQ.options ?? []).map((o) => {
              const selected = pending === o.value || (pending === null && prevValue === o.value);
              const sub = optSubLabel(o);
              return (
                <button key={o.value} onClick={() => choose(o)} aria-pressed={selected}
                  className={`group flex min-h-[56px] items-start gap-3 rounded-2xl border p-4 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 motion-reduce:transition-none ${selected ? "border-[#2563EB] bg-[#EFF5FF]" : "border-[#E2E8F0] bg-white hover:-translate-y-0.5 hover:border-[#2563EB]/40"}`}>
                  <span aria-hidden className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 motion-reduce:transition-none ${selected ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-slate-300 bg-white text-transparent"}`}>
                    <span className="text-[10px] leading-none">✓</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium text-[#0F172A]">{o.label}</span>
                    {sub && <span className={`mt-0.5 block text-[12px] ${selected ? "text-[#2563EB]" : "text-[#64748B]"}`}>{sub}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── TERMINAL VIEW: verdict panel + two-popup ────────────────────────────────
  if (terminal && tierInfo) {
    const alt = altTier(config, tierInfo.tier);
    const escape = terminal.escape;
    return (
      <div className={ENGINE_CANVAS}>
        <EngineVerdictPanel
          kind={escape ? "escape" : "menu"}
          severity={terminal.severity}
          whyFacts={escape ? undefined : trail.map((t) => t.label)}
          heading={terminal.heading}
          indicatedResult={terminal.copy}
          statFigures={escape ? [] : terminal.statFigures}
          confidence={escape ? null : terminal.confidence}
          onReset={reset}
          resultLabel={resultLabelFor(config)}
          escapeLabel={escapeLabelFor(config)}
          escapeBody={escapeBodyFor(config)}
          ctaLabel={showCta ? (escape ? escapeCtaLabelFor(config, tierInfo.price) : ctaLabelFor(config, tierInfo.price)) : undefined}
          ctaNote={showCta ? `${fmtPrice(tierInfo.price)} · one-time · built around your answers` : undefined}
          onCta={showCta ? () => openPopup(tierInfo) : undefined}
          secondaryLabel={!escape && showCta ? secondaryTierLabelFor(config, alt.price) : undefined}
          onSecondary={!escape && showCta ? () => openPopup(alt) : undefined}
          bridgeCopy={escape ? undefined : bridgeCopyFor(config)}
          planChecklist={escape ? undefined : planChecklistFor(config)}
          saveHeading={saveHeadingFor(config)}
          saveSubcopy={saveSubcopyFor(config)}
          email={email}
          emailSent={emailSent}
          onEmailChange={setEmail}
          onSaveEmail={handleSaveEmail}
        />
        {popupStage === 1 && popupTier && (
          <EngineSellPopup
            heading={sellTitleFor(config, terminal.titleKey, popupTier.tier)}
            subhead={sellSubheadFor(config)}
            tier={popupTier.tier}
            price={popupTier.price}
            bullets={planChecklistFor(config)}
            getItLabel={getItLabelFor(config, popupTier.price)}
            onGetIt={() => setPopupStage(2)}
            dismissLabel={config?.copy?.dismissLabel ?? "Not now — keep reading"}
            onDismiss={closePopup}
            altLabel={escape ? undefined : secondaryTierLabelFor(config, alt.price)}
            onAlt={escape ? undefined : () => setPopupTier(alt)}
          />
        )}
        {popupStage === 2 && popupTier && (
          <EngineQualPopup
            fields={qualFields(config)}
            answers={qual}
            onChange={setQualField}
            tier={popupTier.tier}
            price={popupTier.price}
            heading={config?.copy?.popupHeading ?? "Your personalised plan"}
            subhead={config?.copy?.popupSubhead ?? "A few quick questions, then checkout"}
            payLabel={payLabelFor(config, popupTier.price)}
            dismissLabel={config?.copy?.dismissLabel ?? "Not now — keep reading"}
            paying={paying}
            payError={payError}
            onPay={pay}
            onDismiss={closePopup}
          />
        )}
      </div>
    );
  }
  return null;
}
