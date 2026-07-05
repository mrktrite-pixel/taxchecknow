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
import {
  deriveConfidence,
  resolveTerminalFigures,
  type EngineConfidence,
  type EngineFigure,
} from "@/app/_components/engine-terms";

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
  confidence: EngineConfidence | null; // stage 3 input (inert now)
  statFigures: EngineFigure[];         // stage 3 input (inert now)
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
  onComplete,
}: {
  engine: Engine;
  figures?: EngineFigure[];
  onComplete?: (c: EngineCompletion) => void;
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

  const [trail, setTrail] = useState<TrailEntry[]>([]);
  const [node, setNode] = useState<string>(entryId);
  const [pending, setPending] = useState<string | null>(null); // selected value mid-auto-advance

  // reset when the engine (or its entry) changes.
  useEffect(() => {
    setTrail([]);
    setNode(entryId);
    setPending(null);
  }, [entryId]);

  const answers = useMemo(
    () => Object.fromEntries(trail.map((t) => [t.qId, t.value])),
    [trail],
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
  }

  function reset() {
    setPending(null);
    setTrail([]);
    setNode(entryId);
    firedFor.current = null;
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

  // ── TERMINAL VIEW (stage-2 VerdictPanel) ────────────────────────────────────
  if (terminal) {
    return (
      <EngineVerdictPanel
        kind={terminal.kind}
        heading={terminal.label}
        indicatedResult={terminal.indicatedResult}
        statFigures={terminal.statFigures}
        confidence={terminal.confidence}
        onReset={reset}
      />
    );
  }
  return null;
}
