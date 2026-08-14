// ─────────────────────────────────────────────────────────────────────────────
// COLE Generator — generate-product-files.ts
// Reads a ProductConfig and writes all 8 product HTML files
// Output path: app/files/[country]/[id]/[slug]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

import type { ProductConfig, ProductFile } from "../types/product-config";

// Jurisdiction flag from config.country — NEVER hardcode a flag (was leaking 🇬🇧 on AU).
function countryFlag(country: string): string {
  return ({ au: "🇦🇺", uk: "🇬🇧", us: "🇺🇸", nz: "🇳🇿", ca: "🇨🇦" } as Record<string, string>)[country?.toLowerCase()] ?? "🏳️";
}

/**
 * The red deadline bar at the top of every delivered document.
 *
 * FAIL-CLOSED ON AN EMPTY DISPLAY. `deadline.display` is free text, and a product
 * that declares no resolvable date clears it — emitting the bar anyway produced
 * "🔴 TIME-SENSITIVE:" with nothing after the colon, inside the PAID deliverable.
 *
 * This is the one place `display` reaches a customer without passing through a
 * countdown gate first, which is exactly why it needs its own guard: the success
 * pages and the gate page both suppress on `deadlineLive`, and this does not.
 *
 * When the product has declared qualitative urgency, that is used instead — a
 * dateless product still has something true and time-critical to say.
 */
function deadlineBar(config: ProductConfig): string {
  const q = config.deadline?.qualitative;
  // The FALLBACK line only — shown when there is no session to read a terminal from.
  // Prefer the qualitative headline: it is a whole sentence, whereas `display` is a short
  // label meant to be embedded in one, and gluing urgencyLabel to it produced doubled copy
  // ("CERTIFICATE NEEDS TO REACH THE PURCHASER BEFORE SETTLEMENT: your settlement").
  const text = q?.headline?.trim()
    ? q.headline.trim()
    : config.deadline?.display?.trim()
      ? `${config.deadline.urgencyLabel}: ${config.deadline.display}`
      : "";
  if (!text) {
    return `          {/* Deadline bar suppressed: this product declares no date and no
              qualitative urgency, so there is nothing truthful to put here. */}`;
  }
  // R2 — the live bar is terminal-driven (DocStrip). This is only what it shows before a
  // session is read, and for a reader who has none.
  return `          <DocStrip
            productId={PRODUCT_ID}
            fallbackText=${JSON.stringify(text)}
            checkHref="/${config.slug}"
          />`;
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export function generateProductFile(
  config: ProductConfig,
  file: ProductFile
): string {
  const allFiles  = config.files;
  const fileIndex = allFiles.findIndex(f => f.num === file.num);
  const prevFile  = fileIndex > 0 ? allFiles[fileIndex - 1] : null;
  const nextFile  = fileIndex < allFiles.length - 1 ? allFiles[fileIndex + 1] : null;

  // Build the file nav statically at generation time — no TS comparisons in JSX
  const fileNavItems = config.files.map(f => {
    const isCurrent = f.num === file.num;
    const planBadge = f.tier === 2
      ? `<span className="ml-2 font-mono text-[9px] uppercase tracking-widest text-blue-400">Plan only</span>`
      : "";
    if (isCurrent) {
      return `
            <div className="flex items-center justify-between rounded-xl border border-neutral-950 bg-neutral-950 px-4 py-3">
              <div className="flex items-center">
                <span className="mr-2 font-mono text-xs font-bold text-neutral-300">${f.num}</span>
                <span className="text-sm font-semibold text-white">${f.name}${planBadge}</span>
              </div>
              <span className="text-xs text-neutral-400">You are here</span>
            </div>`;
    }
    return `
            <a href="/files/${config.country}/${config.id}/${f.slug}"
              className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 transition hover:border-neutral-300">
              <div className="flex items-center">
                <span className="mr-2 font-mono text-xs font-bold text-neutral-500">${f.num}</span>
                <span className="text-sm font-semibold text-neutral-950">${f.name}${planBadge}</span>
              </div>
              <span className="font-mono text-xs text-neutral-500">Open →</span>
            </a>`;
  }).join("\n");

  const prevNavLink = prevFile
    ? `<a href="/files/${config.country}/${config.id}/${prevFile.slug}" className="font-semibold text-neutral-700 hover:text-neutral-950 transition">← File ${prevFile.num}: ${prevFile.name}</a>`
    : `<a href="/${config.slug}" className="font-semibold text-neutral-700 hover:text-neutral-950 transition">← Back to ${config.name}</a>`;

  const nextNavLink = nextFile
    ? `<a href="/files/${config.country}/${config.id}/${nextFile.slug}" className="font-semibold text-neutral-700 hover:text-neutral-950 transition">File ${nextFile.num}: ${nextFile.name} →</a>`
    : `<a href="/${config.slug}" className="font-semibold text-neutral-700 hover:text-neutral-950 transition">Back to ${config.name} →</a>`;

  const sourceLinks = config.sources.slice(0, 2).map(s =>
    `<a href="${s.url}" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-900 transition">${s.title} ↗</a>`
  ).join("\n            ");

  return `"use client";
// AUTO-GENERATED BY COLE — do not edit manually
// Product: ${config.id} · File ${file.num} of ${config.files.length}
// Regenerate: npx ts-node --project cole/tsconfig.json cole/scripts/cole-generate.ts ${config.country}-${config.id}

import { useEffect, useState } from "react";
import DocBody from "@/app/_components/DocBody";
import DocStrip from "@/app/_components/DocStrip";
import { buyerContextFromSession, type BuyerContext } from "@/lib/buyer-context";
import { getTerminalPresentation } from "@/lib/terminal-presentation";

const PRODUCT_ID = ${JSON.stringify(config.id)};
const BODY = \`${escapeContent(file.content)}\`;

export default function ${toPascal(config.id)}File${file.num}() {
  // R1 — bind the body to the buyer's own answers where we have them.
  //
  // Read in an effect, not during render: sessionStorage does not exist on the server, and
  // reading it during render would desync the hydration pass. First paint is therefore the
  // UNBOUND document — which is the correct thing to show anyway, because it is exactly what
  // a reader with no session (a cold link, a different device) gets and it must stand alone.
  //
  // A body with no {{bind:}}/{{#if}} markers renders byte-identically whether or not a
  // context is found, so every product that has not adopted the syntax is unaffected.
  const [ctx, setCtx] = useState<BuyerContext | null>(null);
  useEffect(() => { setCtx(buyerContextFromSession(PRODUCT_ID)); }, []);
  const docFlags = getTerminalPresentation(PRODUCT_ID, ctx?.terminalId, { headline: "", fileSlugs: [] }).docFlags;

  return (
    <div className="min-h-screen bg-white">
      <style>{\`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11px; color: #000; }
          h1 { font-size: 18px; }
          h2 { font-size: 14px; }
          h3 { font-size: 12px; }
          table { font-size: 10px; border-collapse: collapse; width: 100%; }
          td, th { padding: 4px 6px; border: 1px solid #ccc; word-break: break-word; }
          .action-box { background: #f0f0f0 !important; border: 1px solid #999; padding: 8px; }
          .info-box { background: #e8f0fe !important; border: 1px solid #aac; padding: 8px; }
          .warning-box { background: #fff0f0 !important; border: 1px solid #c99; padding: 8px; }
          .highlight { background: #fffbe6 !important; border: 1px solid #cc9; padding: 8px; }
          .checklist li::before { content: "☐ "; }
          a[href]:after { content: " (" attr(href) ")"; font-size: 8px; color: #555; word-break: break-all; }
          a[href^="#"]:after, a[href^="javascript"]:after { content: ""; }
        }
        .action-box { background: #0a0a0a; color: #fff; padding: 1rem 1.25rem; border-radius: 0.75rem; margin: 1rem 0; }
        .action-box h3 { color: #fff; margin-top: 0; }
        .action-box p, .action-box li { color: #d4d4d4; }
        .action-box a { color: #93c5fd; }
        .info-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 1rem 1.25rem; border-radius: 0.75rem; margin: 1rem 0; }
        .warning-box { background: #fff1f2; border: 1px solid #fecdd3; padding: 1rem 1.25rem; border-radius: 0.75rem; margin: 1rem 0; }
        .highlight { background: #fefce8; border: 1px solid #fde68a; padding: 1rem 1.25rem; border-radius: 0.75rem; margin: 1rem 0; }
        .checklist { list-style: none; padding-left: 0; }
        .checklist li { padding: 0.4rem 0; border-bottom: 1px solid #f0f0f0; }
        .checklist li::before { content: "☐ "; font-size: 1rem; color: #6b7280; margin-right: 0.5rem; }
        table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.875rem; }
        th { background: #f9fafb; text-align: left; padding: 0.625rem 0.75rem; border-bottom: 2px solid #e5e7eb; font-weight: 600; }
        td { padding: 0.625rem 0.75rem; border-bottom: 1px solid #f3f4f6; vertical-align: top; word-break: break-word; }
        h2 { font-size: 1.25rem; font-weight: 700; margin-top: 2rem; margin-bottom: 0.5rem; color: #111827; }
        h3 { font-size: 1rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.375rem; color: #111827; }
        ol { padding-left: 1.5rem; }
        ol li { margin-bottom: 0.5rem; line-height: 1.6; }
        p { line-height: 1.7; color: #374151; margin-bottom: 0.75rem; }
        a { color: #2563eb; }
      \`}</style>

      {/* NAV */}
      <nav className="no-print sticky top-0 z-50 border-b border-neutral-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <a href="/" className="font-bold text-neutral-900">TaxCheckNow</a>
          <div className="flex items-center gap-4 text-sm text-neutral-500">
            <span className="hidden sm:block">${config.market} · ${config.name}</span>
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition">
              ⬇ Save as PDF
            </button>
          </div>
        </div>
      </nav>

      {/* FILE NAV BAR */}
      <div className="no-print border-b border-neutral-100 bg-neutral-50 px-4 py-2">
        <div className="mx-auto flex max-w-3xl items-center justify-between text-xs text-neutral-500">
          <div>${prevNavLink}</div>
          <span className="font-mono">File ${file.num} of ${config.files.length}</span>
          <div>${nextNavLink}</div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8">

        {/* HEADER */}
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="bg-neutral-900 text-white px-2.5 py-1 font-medium">
              ${countryFlag(config.country)} ${config.authority} · ${config.legalAnchor}
            </span>
            <span className="bg-neutral-100 text-neutral-600 px-2.5 py-1 font-medium">
              Last verified: ${config.lastVerified}
            </span>
            <span className="bg-neutral-100 text-neutral-600 px-2.5 py-1 font-mono text-[10px]">
              File ${file.num} of ${config.files.length}
            </span>
          </div>

${deadlineBar(config)}

          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">
            ${config.name} · File ${file.num} of ${config.files.length}
          </p>
          <h1 className="font-serif text-3xl font-bold text-neutral-950 mb-2">
            ${file.name}
          </h1>
          <p className="text-neutral-500 text-sm">${file.desc}</p>
        </div>

        {/* PRINT BUTTON */}
        <div className="no-print mb-6">
          <button
            onClick={() => window.print()}
            className="w-full rounded-xl border-2 border-neutral-950 bg-white py-3 text-sm font-bold text-neutral-950 transition hover:bg-neutral-950 hover:text-white">
            ⬇ Save File ${file.num} as PDF
          </button>
        </div>

        {/* CONTENT */}
        <DocBody html={BODY} ctx={ctx} extraFlags={docFlags} />

        {/* FILE NAVIGATION */}
        <div className="no-print mt-12 border-t border-neutral-200 pt-6">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
            All files in this pack
          </p>
          <div className="space-y-2">
            ${fileNavItems}
          </div>
        </div>

        {/* DISCLAIMER */}
        <div className="mt-8 rounded-xl bg-neutral-50 px-5 py-4">
          <p className="text-xs leading-relaxed text-neutral-500">
            <strong className="text-neutral-600">General information only.</strong>{" "}
            This document does not constitute tax, legal or financial advice.
            Always consult a qualified ${adviserJurisdiction(config)} tax adviser for your personal situation.
            Based on ${config.authority} guidance ${config.lastVerified}.
          </p>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-neutral-200 bg-neutral-50 px-4 py-6 mt-8">
        <div className="mx-auto max-w-3xl flex flex-col md:flex-row md:justify-between gap-3 text-xs text-neutral-500">
          <div>
            <p className="font-bold text-neutral-700">TaxCheckNow</p>
            <p className="font-mono mt-0.5">
              This document: https://taxchecknow.com/files/${config.country}/${config.id}/${file.slug}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/${config.slug}" className="hover:text-neutral-900 transition">
              ← Back to ${config.name}
            </a>
            ${sourceLinks}
          </div>
        </div>
      </footer>

    </div>
  );
}
`;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

/**
 * C6 — the ADJECTIVE for the disclaimer's "consult a qualified <X> tax adviser".
 *
 * Two things were wrong with the old `${config.market}`.
 *
 * 1. GRAMMAR. `market` is a noun ("Australia", "Canada", "United States"), so the sentence
 *    read "consult a qualified Australia tax adviser". The slot needs a demonym.
 *
 * 2. THE WRONG FIELD. `market` is free prose; `country` is the controlled code the rest of
 *    the pipeline routes on (URL segment, price registry, corpus slug). Deriving the
 *    jurisdiction from `country` means the disclaimer cannot drift from the product's actual
 *    jurisdiction — which is exactly what it did: 394 emitted documents across 44 products
 *    currently say "qualified UK tax adviser" while citing the ATO, the IRS, the CRA and the
 *    IRD, because they were emitted before `market` was interpolated here at all and have
 *    never been regenerated.
 *
 * Unknown country → fall back to `market`, so a new jurisdiction degrades to today's
 * behaviour rather than to a wrong country.
 */
export function adviserJurisdiction(config: { country?: string; market?: string }): string {
  const byCountry: Record<string, string> = {
    au: "Australian",
    uk: "UK",
    gb: "UK",
    us: "US",
    nz: "New Zealand",
    can: "Canadian",
    ca: "Canadian",
  };
  const key = (config.country ?? "").toLowerCase();
  return byCountry[key] ?? config.market ?? "qualified";
}


function toPascal(str: string): string {
  return str.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

function escapeContent(content: string): string {
  return content
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

// ── OUTPUT PATH HELPER ────────────────────────────────────────────────────────

export function getProductFilePath(
  config: ProductConfig,
  file: ProductFile,
  appRoot: string
): string {
  const path = require("path");
  return path.join(appRoot, "files", config.country, config.id, file.slug, "page.tsx");
}

// ── GENERATE ALL FILES ────────────────────────────────────────────────────────

export function generateAllProductFiles(
  config: ProductConfig
): { path: string; content: string }[] {
  return config.files.map(file => ({
    path:    `app/files/${config.country}/${config.id}/${file.slug}/page.tsx`,
    content: generateProductFile(config, file),
  }));
}
