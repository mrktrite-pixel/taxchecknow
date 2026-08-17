"use client";

/**
 * SuccessPack — the file section of a paid success page.
 *
 * R3 — the pack is TIER-BOUNDED and TERMINAL-ORDERED.
 *   · tier 1 lists exactly its own files and labels them "File N of 5"; the tier-2 files are
 *     named in a single upsell block WITH NO LINKS, because linking them is handing them over.
 *   · tier 2 lists all eight, labelled "File N of 8".
 *   · order and the START HERE badge come from the terminal the buyer actually reached
 *     (lib/terminal-presentation.ts), not from array position. The old page hardcoded the
 *     badge to index 1 and told every buyer "Start with File 02 — it has your exact numbers",
 *     which was wrong twice over: wrong file for most terminals, and File 02 has no numbers.
 *
 * R4 — ONE COMBINED PDF. The print view appends every one of the buyer's files inline, in
 * spine order, one page-break per file, after whatever the page rendered above. So Save PDF
 * produces a single document: their assessment first, then their whole pack. The per-file
 * Save-PDF buttons on the standalone /files pages are unaffected and still work.
 *
 * GENERIC — nothing here knows about FRCGW. Any product that emits docs.json and registers a
 * terminal map inherits it; a product with no map gets the neutral default ordering.
 */

import DocBody from "@/app/_components/DocBody";
import type { BuyerContext } from "@/lib/buyer-context";
import { getTerminalPresentation, resolveSpine, terminalFlags } from "@/lib/terminal-presentation";
import { resolveDocLabel } from "@/lib/terminal-labels";

export interface PackDoc {
  num: string;
  name: string;
  desc: string;
  tier: number;
  content: string;
}

export interface SuccessPackProps {
  productId: string;
  /** /files/<country>/<productId> */
  filesBasePath: string;
  tier: 1 | 2;
  packName: string;
  /** slug → document, as emitted by cole/scripts/emit-doc-bodies.ts */
  docs: Record<string, PackDoc>;
  ctx: BuyerContext | null;
  /** Copy for the tier-1 upsell block. */
  upsell?: { heading: string; body: string; ctaLabel: string; ctaHref: string };
}

export default function SuccessPack({
  productId,
  filesBasePath,
  tier,
  packName,
  docs,
  ctx,
  upsell,
}: SuccessPackProps) {
  const allSlugs = Object.keys(docs);
  const mine = allSlugs.filter((s) => docs[s].tier <= tier);
  const locked = allSlugs.filter((s) => docs[s].tier > tier);

  const presentation = getTerminalPresentation(productId, ctx?.terminalId, {
    headline: "",
    fileSlugs: mine,
  });
  const { order, startHere } = resolveSpine(presentation, mine);
  const total = mine.length;

  // D12-B — names and descriptions follow the terminal, like the bodies already do. Resolved
  // from the SAME merged flag set the {{#if}} sections branch on, so a label cannot contradict
  // the body underneath it.
  const flags = terminalFlags(productId, ctx);
  const label = (slug: string) => resolveDocLabel(productId, slug, flags, docs[slug]);

  return (
    <>
      {/* ── SCREEN: the ordered list ─────────────────────────────────────── */}
      <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
          {packName} · {total} document{total === 1 ? "" : "s"}
        </p>
        <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">Your documents</h2>
        <p className="mb-4 text-sm text-neutral-500">
          Ordered for your situation.{" "}
          {startHere && docs[startHere]
            ? `Start with File ${docs[startHere].num} — ${label(startHere).name}.`
            : ""}{" "}
          Use Save PDF at the top of this page to get your assessment and all{" "}
          {total} document{total === 1 ? "" : "s"} as one file.
        </p>

        <div className="space-y-2">
          {order.map((slug, i) => {
            const d = docs[slug];
            const isStart = slug === startHere;
            return (
              <div
                key={slug}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  isStart ? "border-neutral-900 bg-neutral-950" : "border-neutral-100 bg-neutral-50"
                }`}
              >
                <div>
                  {isStart && (
                    <span className="mb-0.5 block font-mono text-[9px] uppercase tracking-widest text-amber-400">
                      Start here
                    </span>
                  )}
                  <p className={`text-sm font-semibold ${isStart ? "text-white" : "text-neutral-950"}`}>
                    File {d.num} of {total} — {label(slug).name}
                  </p>
                  <p className={`text-xs ${isStart ? "text-neutral-400" : "text-neutral-500"}`}>{label(slug).desc}</p>
                </div>
                <a
                  href={`${filesBasePath}/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`no-print ml-4 shrink-0 rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition ${
                    isStart
                      ? "border-white/20 bg-white text-neutral-950 hover:bg-neutral-200"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-950 hover:text-white"
                  }`}
                >
                  Open →
                </a>
                <span className="sr-only">{i + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── TIER 1 UPSELL — names the locked files, links NONE of them ───── */}
      {tier === 1 && locked.length > 0 && upsell && (
        <div className="no-print rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{upsell.heading}</p>
          <p className="mb-3 text-sm text-neutral-600">{upsell.body}</p>
          <ul className="mb-4 space-y-1.5">
            {locked.map((slug) => (
              <li key={slug} className="flex items-start gap-2 text-sm text-neutral-700">
                <span aria-hidden className="mt-0.5 shrink-0 text-neutral-400">
                  🔒
                </span>
                <span>
                  <span className="font-semibold text-neutral-900">
                    File {docs[slug].num} — {label(slug).name}
                  </span>
                  <span className="block text-xs text-neutral-500">{label(slug).desc}</span>
                </span>
              </li>
            ))}
          </ul>
          <a
            href={upsell.ctaHref}
            className="font-mono text-xs font-bold text-neutral-700 underline transition hover:text-neutral-950"
          >
            {upsell.ctaLabel}
          </a>
        </div>
      )}

      {/* ── R4 PRINT: every one of the buyer's files, inline, one per page ── */}
      <div className="hidden print:block">
        {order.map((slug) => {
          const d = docs[slug];
          return (
            <section key={slug} style={{ breakBefore: "page", pageBreakBefore: "always" }} className="pt-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                {packName} · File {d.num} of {total}
              </p>
              <h2 className="mb-1 font-serif text-2xl font-bold text-neutral-950">{label(slug).name}</h2>
              <p className="mb-4 text-sm text-neutral-500">{label(slug).desc}</p>
              <DocBody html={d.content} ctx={ctx} extraFlags={presentation.docFlags} />
            </section>
          );
        })}
      </div>
    </>
  );
}
