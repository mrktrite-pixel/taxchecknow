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
  onComplete,
}: {
  engine: Engine;
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

  // fire onComplete once per terminal arrival (inert consumer in stage 1).
  const firedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isTerminal || !node) return;
    if (firedFor.current === node) return;
    firedFor.current = node;
    const label =
      kind === "menu" ? menuById.get(node)?.label ?? humanize(node) : humanize(node);
    onComplete?.({ answers, terminal: { kind: kind as TerminalKind, id: node, label } });
  }, [isTerminal, node, kind, answers, menuById, onComplete]);

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

  // ── TERMINAL VIEW (stage-1 plain card — no verdict styling) ─────────────────
  const isMenu = kind === "menu";
  const heading = isMenu ? menuById.get(node)?.label ?? humanize(node) : humanize(node);
  const menuResult = isMenu ? resultByMenuId.get(node) : undefined;
  const menuDesc = isMenu ? menuById.get(node)?.description : undefined;
  const tag = isMenu ? "Result" : "No match";
  const body = isMenu
    ? menuResult ?? menuDesc ?? ""
    : "Based on your answers, this tool can't fully resolve your situation. A closer review of your circumstances is indicated.";

  return (
    <div className="space-y-4">
      <button
        onClick={reset}
        className="font-mono text-xs text-neutral-400 transition hover:text-neutral-700"
      >
        ← Change my answers
      </button>
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-neutral-400">{tag}</p>
        <h3 className="mb-3 font-serif text-xl font-bold text-neutral-950">{heading}</h3>
        {body && <p className="text-sm leading-relaxed text-neutral-700">{body}</p>}
      </div>
    </div>
  );
}
