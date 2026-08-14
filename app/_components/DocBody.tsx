"use client";

/**
 * DocBody — renders one deliverable document body.
 *
 * R1. The body is a TEMPLATE (lib/doc-template.ts): {{bind:key}} pulls the buyer's own
 * value, {{#if flag}} keeps or drops a section. Both are resolved here, once, before the
 * HTML reaches the DOM.
 *
 * ON dangerouslySetInnerHTML: the body itself is author-written content committed to the
 * repo (cole/config/<product>.ts), which is the same trust level as this component's own
 * JSX — that has always been true and is unchanged. What IS new is that buyer-supplied
 * values can now appear inside it, and those are HTML-escaped by applyBinds() before
 * substitution (see escapeHtml in lib/doc-template.ts). So the templating tightens the
 * safety story rather than loosening it: previously nothing customer-derived could reach
 * the markup because nothing customer-derived reached the document at all.
 */

import { useMemo } from "react";
import { renderDocTemplate } from "@/lib/doc-template";
import type { BuyerContext } from "@/lib/buyer-context";

export interface DocBodyProps {
  html: string;
  /** Omitted (e.g. a standalone /files page opened cold) → every bind falls back honestly. */
  ctx?: BuyerContext | null;
  /** Extra flags on top of ctx.flags — the terminal's docFlags from the M map. */
  extraFlags?: string[];
  className?: string;
}

export default function DocBody({ html, ctx, extraFlags, className }: DocBodyProps) {
  const rendered = useMemo(
    () =>
      renderDocTemplate(html, {
        values: ctx?.values ?? {},
        flags: [...(ctx?.flags ?? []), ...(extraFlags ?? [])],
      }),
    [html, ctx, extraFlags],
  );

  return <div className={className ?? "prose-content"} dangerouslySetInnerHTML={{ __html: rendered }} />;
}
