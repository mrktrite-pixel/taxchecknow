"use client";

/**
 * EngineCalculator — generic renderer for a Bee D routing engine.
 *
 * STAGE 1 (PQ-C1a-S1): engine consumption + step flow only. No verdict panel,
 * no popup, no sessions, no Stripe. onComplete is wired but inert (stage 2/3).
 *
 * Contract (Bee D engine JSON):
 *   questions[]     — { id, text, options[], showIf? }
 *   options[]       — { label, value, routes_to, sub_label? }
 *   routes_to       — a question id | a menu dish id | an escape-state string
 *   menu[]          — { id, label, description? }        (dish terminals)
 *   result_states[] — { menu_id, indicated_result }      (dish terminal copy, verbatim)
 *   escape_states[] — string[]                            (neutral "can't resolve" terminals)
 *
 * GENERALITY: no product-specific logic, no hardcoded ids, no domain strings.
 * Renders ANY contract-valid engine. Unknown/future fields are ignored gracefully.
 *
 * NOTE (schema): the current Bee D output expresses conditional flow via the
 * routes_to graph, NOT showIf. showIf is accepted as an OPTIONAL predicate for
 * forward-compat (a false showIf transparently skips the question via its first
 * option's route); it is inert on today's engines.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EngineVerdictPanel from "@/app/_components/EngineVerdictPanel";
import EngineQualPopup from "@/app/_components/EngineQualPopup";
import EngineSellPopup from "@/app/_components/EngineSellPopup";
import {
  deriveConfidence,
  isQuasiEscape,
  resolveTerminalFigures,
  type EngineConfidence,
  type EngineFigure,
} from "@/app/_components/engine-terms";
import {
  altTier,
  bridgeCopyFor,
  ctaLabelFor,
  escapeBodyFor,
  escapeCtaLabelFor,
  escapeLabelFor,
  fmtPrice,
  payLabelFor,
  planChecklistFor,
  priceForTier,
  qualFields,
  resolveTier,
  resultLabelFor,
  saveHeadingFor,
  saveSubcopyFor,
  secondaryTierLabelFor,
  severityFor,
  sellHeadingFor,
  sellSubheadFor,
  getItLabelFor,
  type EngineConfig,
  type PinnedTier,
} from "@/app/_components/engine-config";

// ── engine contract (permissive — extra fields tolerated) ────────────────────
export interface EngineOption {
  label: string;
  value: string;
  routes_to: string;
  sub_label?: string;
  subLabel?: string;
  description?: string;
}
export interface EngineShowIf {
  field: string;
  equals?: string;
  in?: string[];
}
export interface EngineQuestion {
  id: string;
  text: string;
  options: EngineOption[];
  sub_label?: string;
  showIf?: EngineShowIf;
}
export interface EngineMenuItem {
  id: string;
  label: string;
  description?: string;
}
export interface EngineResultState {
  menu_id: string;
  indicated_result: string;
}
export interface Engine {
  menu?: EngineMenuItem[];
  questions?: EngineQuestion[];
  escape_states?: string[];
  result_states?: EngineResultState[];
  routing_logic?: string;
  figures?: EngineFigure[]; // optional embedded pool; the `figures` prop takes precedence
}

export type TerminalKind = "menu" | "escape" | "unknown";
export interface EngineTerminal {
  kind: TerminalKind;
  id: string;
  label: string;
}
export interface EngineCompletion {
  answers: Record<string, string>;
  terminal: EngineTerminal;
  confidence: EngineConfidence | null;
  statFigures: EngineFigure[];
}

// Stub handoff to the (C2-scope) Stripe checkout — carries everything checkout needs.
export interface EngineCheckout {
  sessionId: string | null;
  terminal: EngineTerminal;
  tier: number;
  price: number;
  answers: Record<string, string>;
  qualification: Record<string, string>;
}

interface TrailEntry {
  qId: string;
  value: string;
  label: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function humanize(id: string): string {
  return id
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function optSubLabel(o: EngineOption): string | undefined {
  return o.sub_label ?? o.subLabel ?? o.description;
}

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
  onCheckout?: (c: EngineCheckout) => void;
}) {
  const questions = useMemo(() => engine.questions ?? [], [engine.questions]);
  const menu = useMemo(() => engine.menu ?? [], [engine.menu]);
  const escapes = useMemo(() => engine.escape_states ?? [], [engine.escape_states]);
  const results = useMemo(() => engine.result_states ?? [], [engine.result_states]);

  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const menuById = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);
  const resultByMenuId = useMemo(
    () => new Map(results.map((r) => [r.menu_id, r.indicated_result])),
    [results],
  );
  const escapeSet = useMemo(() => new Set(escapes), [escapes]);
  const pool = useMemo<EngineFigure[]>(
    () => figures ?? engine.figures ?? [],
    [figures, engine.figures],
  );

  const classify = useCallback(
    (id: string): TerminalKind | "question" => {
      if (qById.has(id)) return "question";
      if (menuById.has(id)) return "menu";
      if (escapeSet.has(id)) return "escape";
      return "unknown";
    },
    [qById, menuById, escapeSet],
  );

  // entry = the question no option routes to (the root); fallback = first question.
  const entryId = useMemo(() => {
    const targeted = new Set<string>();
    for (const q of questions) for (const o of q.options ?? []) targeted.add(o.routes_to);
    return questions.find((q) => !targeted.has(q.id))?.id ?? questions[0]?.id ?? "";
  }, [questions]);

  // longest remaining chain from a node (inclusive if it's a question), cycle-guarded.
  const depthOf = useCallback(
    (id: string): number => {
      const memo = new Map<string, number>();
      const walk = (nid: string, seen: Set<string>): number => {
        const q = qById.get(nid);
        if (!q) return 0; // terminal
        if (seen.has(nid)) return 1; // cycle guard — count self, stop
        if (memo.has(nid)) return memo.get(nid)!;
        const next = new Set(seen).add(nid);
        let best = 0;
        for (const o of q.options ?? []) best = Math.max(best, walk(o.routes_to, next));
        const d = 1 + best;
        memo.set(nid, d);
        return d;
      };
      return walk(id, new Set());
    },
    [qById],
  );

  // showIf: skip a question whose predicate is false by following its first route.
  const showIfPasses = useCallback((q: EngineQuestion, answers: Record<string, string>): boolean => {
    const s = q.showIf;
    if (!s) return true;
    const v = answers[s.field];
    if (s.in) return v !== undefined && s.in.includes(v);
    if (s.equals !== undefined) return v === s.equals;
    return true;
  }, []);

  const resolveNode = useCallback(
    (id: string, answers: Record<string, string>): string => {
      let cur = id;
      for (let guard = 0; guard < questions.length + 1; guard++) {
        const q = qById.get(cur);
        if (!q || showIfPasses(q, answers)) return cur;
        const first = (q.options ?? [])[0];
        if (!first) return cur;
        cur = first.routes_to;
      }
      return cur;
    },
    [qById, questions.length, showIfPasses],
  );

  // Deterministically replay a completed answer-map back into a trail (hydration).
  const replayTrail = useCallback(
    (ans: Record<string, string>): { trail: TrailEntry[]; node: string } => {
      const t: TrailEntry[] = [];
      let cur = resolveNode(entryId, ans);
      const seen = new Set<string>();
      while (qById.has(cur) && !seen.has(cur)) {
        seen.add(cur);
        const q = qById.get(cur)!;
        const o = (q.options ?? []).find((x) => x.value === ans[cur]);
        if (!o) break; // no stored answer for this question → stop (partial)
        t.push({ qId: cur, value: o.value, label: o.label });
        cur = resolveNode(o.routes_to, ans);
      }
      return { trail: t, node: cur };
    },
    [qById, resolveNode, entryId],
  );

  const [trail, setTrail] = useState<TrailEntry[]>([]);
  const [node, setNode] = useState<string>(entryId);
  const [pending, setPending] = useState<string | null>(null); // selected value mid-auto-advance

  // ── session / tier / popup / email state ──
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pinnedTier, setPinnedTier] = useState<PinnedTier | null>(null); // return-path pin
  const [qual, setQual] = useState<Record<string, string>>({});
  const [popupStage, setPopupStage] = useState<0 | 1 | 2>(0); // 0=closed · 1=WHAT-YOU-GET sell · 2=questions+Pay
  const [popupTier, setPopupTier] = useState<PinnedTier | null>(null); // which tier the popup buys (alt-tier aware)
  const [paying, setPaying] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const postedFor = useRef<string | null>(null);

  const clearSession = useCallback(() => {
    setSessionId(null);
    setPinnedTier(null);
    setQual({});
    setPopupStage(0);
    setPopupTier(null);
    setPaying(false);
    setEmail("");
    setEmailSent(false);
    postedFor.current = null;
  }, []);

  // reset when the engine (or its entry) changes.
  useEffect(() => {
    setTrail([]);
    setNode(entryId);
    setPending(null);
    clearSession();
  }, [entryId, clearSession]);

  const answers = useMemo(
    () => Object.fromEntries(trail.map((t) => [t.qId, t.value])),
    [trail],
  );
  // Human-readable answers for the assessment/webhook + success-page fallback:
  // "<question text>" → "<chosen option label>" (not raw ids). Manual-equivalent depth.
  const labeledAnswers = useMemo(
    () => Object.fromEntries(trail.map((t) => [qById.get(t.qId)?.text ?? t.qId, t.label])),
    [trail, qById],
  );
  const kind = classify(node);
  const isTerminal = kind !== "question";

  // terminal derivation (code-only): heading + verbatim result + stat figures + confidence.
  const terminal = useMemo(() => {
    if (!isTerminal || !node) return null;
    const menuItem = kind === "menu" ? menuById.get(node) : undefined;
    const label = menuItem?.label ?? humanize(node);
    const indicatedResult =
      kind === "menu" ? resultByMenuId.get(node) ?? menuItem?.description ?? "" : "";
    // provenance-first figure ids on the dish (forward-compat; absent on today's engines).
    const figureIds = (menuItem as { figure_ids?: string[] } | undefined)?.figure_ids;
    // Context for term-matching: terminal id + label + the VERBATIM result text + the answers
    // taken. Deliberately NOT the menu description — dish descriptions carry cross-category
    // comparison clauses ("higher than the ordinary rates") that leak a sibling's discriminating
    // terms; indicatedResult already falls back to the description only when no result_state exists.
    const context = [
      node,
      label,
      indicatedResult,
      ...trail.flatMap((t) => [t.value, t.label]),
    ].join(" ");
    const statFigures =
      kind === "menu" ? resolveTerminalFigures(pool, context, { figureIds, maxN: 3 }) : [];
    const confidence = deriveConfidence(trail, kind as TerminalKind);
    return { kind: kind as TerminalKind, id: node, label, indicatedResult, statFigures, confidence };
  }, [isTerminal, node, kind, menuById, resultByMenuId, pool, trail]);

  // fire onComplete once per terminal arrival (inert consumer in stages 1-2).
  const firedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!terminal) return;
    if (firedFor.current === terminal.id) return;
    firedFor.current = terminal.id;
    onComplete?.({
      answers,
      terminal: { kind: terminal.kind, id: terminal.id, label: terminal.label },
      confidence: terminal.confidence,
      statFigures: terminal.statFigures,
    });
  }, [terminal, answers, onComplete]);

  useEffect(() => {
    if (!isTerminal) firedFor.current = null;
  }, [isTerminal]);

  // ── effective terminal presentation (quasi-escape rider + pinned tier) ──
  // A dish the operator placed in the tierMap is a RESOLVED dish by judgment (nameable),
  // never a quasi-escape — even when it abstains from figures (named-complexity dishes).
  const operatorResolved = !!terminal && !!config?.tierMap && terminal.id in config.tierMap;
  const quasiEscape =
    !!terminal && !operatorResolved &&
    isQuasiEscape(terminal.kind, terminal.statFigures, terminal.indicatedResult);
  const effKind: TerminalKind | null = terminal ? (quasiEscape ? "escape" : terminal.kind) : null;
  const isEscape = effKind === "escape";
  // BOTH resolved dishes and escapes monetise now. Resolved → operator tierMap;
  // escape/quasi-escape → FORCED $67 ("a closer look"), never $147.
  const liveTier: PinnedTier | null = !terminal
    ? null
    : isEscape
      ? { tier: 67, price: priceForTier(config, 67) }
      : resolveTier(config, terminal.id);
  const tierInfo = pinnedTier ?? liveTier; // return-path pin wins over live re-derivation
  const monetizable = !!terminal && !!tierInfo; // resolved OR escape

  // ── HYDRATION: ?session_id= → rebuild trail from inputs; tier/price from the PINNED output ──
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
        // replay from the RAW {qId: value} answers (inputs is now human-labeled for the assessment).
        const rawForReplay = out.raw_answers ?? (row?.inputs as Record<string, string> | undefined);
        if (cancelled || !rawForReplay) return;
        const { trail: t, node: n } = replayTrail(rawForReplay);
        setTrail(t);
        setNode(n);
        setSessionId(sid);
        postedFor.current = n; // hydrated terminal — never re-POST
        firedFor.current = n;  // and don't re-fire onComplete
        if (typeof out.tier === "number") {
          setPinnedTier({ tier: out.tier, price: typeof out.price === "number" ? out.price : out.tier });
        }
      } catch { /* non-blocking */ } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, [replayTrail]);

  // ── POST a decision session when a MONETIZABLE terminal is reached (tier PINNED) ──
  // Both resolved dishes and escapes now create a session (needed for email + checkout).
  useEffect(() => {
    if (!hydrated || !monetizable || !terminal || !tierInfo) return;
    if (!config?.productSlug || sessionId) return;
    if (postedFor.current === terminal.id) return;
    postedFor.current = terminal.id;
    const slug = config.productSlug;
    try {
      // fallback path reads _answers = the LABELED answers (personalised pre-webhook render).
      sessionStorage.setItem(`${slug}_answers`, JSON.stringify(labeledAnswers));
      sessionStorage.setItem(`${slug}_terminal`, terminal.id);
      sessionStorage.setItem(`${slug}_status`, terminal.label);
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
        inputs: labeledAnswers,               // human-readable — webhook feeds this to /api/assess
        output: {
          terminal_id: terminal.id,
          terminal_label: terminal.label,
          status: terminal.label,
          confidence: terminal.confidence?.level ?? null,
          tier: tierInfo.tier,                // PINNED
          price: tierInfo.price,              // PINNED
          raw_answers: answers,               // {qId: value} — used by hydration replay only
        },
        recommended_tier: tierInfo.tier,
      }),
    })
      .then((r) => r.json())
      .then((d) => { if (d?.id) { setSessionId(d.id); setPinnedTier(tierInfo); } })
      .catch(() => {});
  }, [hydrated, monetizable, terminal, tierInfo, config, sessionId, answers, labeledAnswers]);

  function openPopup(tier: PinnedTier) { setPopupTier(tier); setPopupStage(1); } // → sell panel
  function closePopup() { setPopupStage(0); }
  function setQualField(k: string, v: string) { setQual((p) => ({ ...p, [k]: v })); }

  // Save box → free-result email (/api/leads: Resend + d3/d7/d14 nurture server-side)
  // + PATCH the pinned decision_session with the email. Ported from the manual calculator.
  function handleSaveEmail() {
    if (!email || !config?.productSlug) return;
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        source: config.productSlug.replace(/-/g, "_"),
        country_code: config.country ?? "AU",
        site: config.site ?? "taxchecknow",
        session_id: sessionId ?? "",
        verdict_status: terminal?.label ?? "",
      }),
    }).catch(() => {});
    if (sessionId) {
      fetch("/api/decision-sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, email }),
      }).catch(() => {});
    }
    setEmailSent(true);
  }

  function pay() {
    if (!terminal) return;
    const buyTier = popupTier ?? tierInfo;
    if (!buyTier) return;
    setPaying(true);
    // qualification labeled ("<field label>" → "<chosen option label>") for the assessment.
    const qualLabeled = Object.fromEntries(
      qualFields(config)
        .map((f) => [f.label, f.options.find((o) => o.value === qual[f.key])?.label ?? qual[f.key]] as const)
        .filter(([, v]) => v !== undefined && v !== ""),
    );
    if (sessionId) {
      fetch("/api/decision-sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, tier_intended: buyTier.tier, questionnaire_payload: qualLabeled }),
      }).catch(() => {});
    }
    try {
      if (config?.productSlug) sessionStorage.setItem(`${config.productSlug}_qualification`, JSON.stringify(qualLabeled));
    } catch { /* ignore */ }
    onCheckout?.({
      sessionId,
      terminal: { kind: terminal.kind, id: terminal.id, label: terminal.label },
      tier: buyTier.tier,
      price: buyTier.price,
      answers: labeledAnswers,
      qualification: qualLabeled,
    });
    setPaying(false);
  }

  const currentQ = qById.get(node);

  function choose(o: EngineOption) {
    if (pending) return;
    setPending(o.value);
    window.setTimeout(() => {
      setTrail((prev) => [...prev, { qId: node, value: o.value, label: o.label }]);
      setNode(resolveNode(o.routes_to, { ...answers, [node]: o.value }));
      setPending(null);
    }, 220);
  }

  function back() {
    if (!trail.length) return;
    const prev = trail[trail.length - 1];
    setPending(null);
    setTrail((t) => t.slice(0, -1));
    setNode(prev.qId);
    firedFor.current = null;
    if (isTerminal) clearSession(); // re-deciding from a terminal starts a fresh session
  }

  function reset() {
    setPending(null);
    setTrail([]);
    setNode(entryId);
    firedFor.current = null;
    clearSession();
  }

  if (!questions.length || !entryId) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
        This tool has no questions to display.
      </div>
    );
  }

  // ── QUESTION VIEW ──────────────────────────────────────────────────────────
  if (currentQ) {
    const n = trail.length + 1;
    const m = trail.length + depthOf(node);
    const prevValue = answers[currentQ.id]; // preserved on Back
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">
            Step {n} of {Math.max(m, n)}
          </p>
          {trail.length > 0 && (
            <button
              onClick={back}
              className="font-mono text-xs text-neutral-400 transition hover:text-neutral-700"
            >
              ← Back
            </button>
          )}
        </div>

        <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full bg-neutral-950 transition-all duration-300"
            style={{ width: `${(trail.length / Math.max(m, 1)) * 100}%` }}
          />
        </div>

        <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">{currentQ.text}</h2>
        {currentQ.sub_label && <p className="mb-4 text-sm text-neutral-500">{currentQ.sub_label}</p>}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(currentQ.options ?? []).map((o) => {
            const selected = pending === o.value || (pending === null && prevValue === o.value);
            const sub = optSubLabel(o);
            return (
              <button
                key={o.value}
                onClick={() => choose(o)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  selected
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
                }`}
              >
                <span className="block text-sm font-medium">{o.label}</span>
                {sub && (
                  <span
                    className={`mt-0.5 block text-xs ${selected ? "text-neutral-300" : "text-neutral-500"}`}
                  >
                    {sub}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── TERMINAL VIEW: verdict panel (full parity) + qualification popup ─────────
  if (terminal && effKind && tierInfo) {
    const alt = altTier(config, tierInfo.tier);
    return (
      <>
        <EngineVerdictPanel
          kind={effKind}
          severity={isEscape ? undefined : severityFor(config, terminal.id)}
          heading={terminal.label}
          indicatedResult={terminal.indicatedResult}
          statFigures={isEscape ? [] : terminal.statFigures}
          confidence={isEscape ? null : terminal.confidence}
          onReset={reset}
          resultLabel={resultLabelFor(config)}
          escapeLabel={escapeLabelFor(config)}
          escapeBody={escapeBodyFor(config)}
          ctaLabel={isEscape ? escapeCtaLabelFor(config, tierInfo.price) : ctaLabelFor(config, tierInfo.price)}
          ctaNote={`${fmtPrice(tierInfo.price)} · one-time · built around your answers`}
          onCta={() => openPopup(tierInfo)}
          secondaryLabel={isEscape ? undefined : secondaryTierLabelFor(config, alt.price)}
          onSecondary={isEscape ? undefined : () => openPopup(alt)}
          bridgeCopy={isEscape ? undefined : bridgeCopyFor(config)}
          planChecklist={isEscape ? undefined : planChecklistFor(config)}
          saveHeading={saveHeadingFor(config)}
          saveSubcopy={saveSubcopyFor(config)}
          email={email}
          emailSent={emailSent}
          onEmailChange={setEmail}
          onSaveEmail={handleSaveEmail}
        />
        {/* POPUP 1 — WHAT-YOU-GET sell panel (alt-tier link only for resolved dishes) */}
        {popupStage === 1 && popupTier && (
          <EngineSellPopup
            heading={sellHeadingFor(config, popupTier.tier)}
            subhead={sellSubheadFor(config)}
            tier={popupTier.tier}
            price={popupTier.price}
            bullets={planChecklistFor(config)}
            getItLabel={getItLabelFor(config, popupTier.price)}
            onGetIt={() => setPopupStage(2)}
            dismissLabel={config?.copy?.dismissLabel ?? "Not now — keep reading"}
            onDismiss={closePopup}
            altLabel={isEscape ? undefined : secondaryTierLabelFor(config, alt.price)}
            onAlt={isEscape ? undefined : () => setPopupTier(alt)}
          />
        )}
        {/* POPUP 2 — 3 qualification questions + Pay */}
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
            onPay={pay}
            onDismiss={closePopup}
          />
        )}
      </>
    );
  }
  return null;
}
