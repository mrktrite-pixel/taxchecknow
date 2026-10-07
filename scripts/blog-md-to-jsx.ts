// scripts/blog-md-to-jsx.ts
// ─────────────────────────────────────────────────────────────────────────────
// BUILD-TIME ONLY. Converts a post's body_md into JSX SOURCE TEXT that
// scripts/generate-blog-pages.ts writes into a page.tsx.
//
// NOT A RUNTIME MODULE. It lives under scripts/ rather than lib/ precisely
// because it emits source code: nothing in app/ ever imports it, and no markdown
// parser ships to the browser.
//
// WHY NOT A MARKDOWN LIBRARY. Two reasons, both about what reaches a reader:
//   · dangerouslySetInnerHTML would be the easy path and it is the wrong one for
//     a page whose whole claim is that every figure is traceable. Emitting real
//     JSX elements means the content is static, crawlable, and cannot carry
//     injected markup.
//   · the generator's input is NOT arbitrary markdown. It is the narrow subset
//     lib/bees/blog-bee/compose.ts emits — h1/h2, paragraphs, bold runs, links,
//     bullet lists, blockquotes, pipe tables, italic stamp lines. A parser for
//     exactly that subset is small enough to read, and anything outside it is a
//     THROW rather than a silent drop: a heading the generator did not expect
//     would otherwise vanish from a published page without a trace.
//
// EVERY STRING GOES THROUGH JSON.stringify. Same escaping discipline as
// scripts/generate-gpt-pages.ts:131 (escTs) — it handles quotes, backslashes and
// newlines, and it is the reason a tax figure containing a dollar sign or a
// citation containing an apostrophe cannot break the emitted file.
// ─────────────────────────────────────────────────────────────────────────────

/** A TS/JSX string literal for `s`. Handles every escape case. */
export function lit(s: string): string {
  return JSON.stringify(s);
}

/** Inline markdown -> JSX children source. Supports **bold**, [text](url), `code`. */
export function inlineToJsx(text: string): string {
  const parts: string[] = [];
  // One pass, longest-first alternation so a link inside bold is not split wrongly.
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(`{${lit(text.slice(last, m.index))}}`);
    if (m[1] !== undefined) {
      const href = m[2];
      // An external link opens in place; it is a citation, and a new tab for a
      // source the reader is being asked to check is friction, not a courtesy.
      parts.push(`<a href={${lit(href)}} className="underline decoration-neutral-400 underline-offset-2 hover:text-neutral-950">{${lit(m[1])}}</a>`);
    } else if (m[3] !== undefined) {
      parts.push(`<strong className="font-semibold text-neutral-950">{${lit(m[3])}}</strong>`);
    } else if (m[4] !== undefined) {
      parts.push(`<code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.9em]">{${lit(m[4])}}</code>`);
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(`{${lit(text.slice(last))}}`);
  return parts.join("");
}

interface Block {
  jsx: string;
}

/** True for a markdown table delimiter row: | --- | --- | */
function isDelimiterRow(line: string): boolean {
  return /^\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line.trim());
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

/**
 * body_md -> an array of JSX element source strings, in order.
 *
 * THROWS on anything outside the composer's subset. The h1 is DROPPED on
 * purpose: the page template renders the title in its own hero, and emitting it
 * twice would give the post two <h1>s.
 */
export function bodyMdToJsx(bodyMd: string): string[] {
  const lines = bodyMd.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (t === "") { i++; continue; }

    // H1 — dropped; the hero owns the title. Recorded here so its absence is
    // a decision in the code rather than an accident of the parser.
    if (/^#\s+/.test(t)) { i++; continue; }

    if (/^##\s+/.test(t)) {
      out.push({ jsx: `<h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">${inlineToJsx(t.replace(/^##\s+/, ""))}</h2>` });
      i++; continue;
    }
    if (/^###\s+/.test(t)) {
      out.push({ jsx: `<h3 className="!mt-8 font-serif text-xl font-bold text-neutral-950">${inlineToJsx(t.replace(/^###\s+/, ""))}</h3>` });
      i++; continue;
    }

    // BLOCKQUOTE — the primary-source quotation. Consecutive > lines are one quote.
    if (/^>\s?/.test(t)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      out.push({ jsx: `<blockquote className="border-l-4 border-neutral-950 bg-neutral-50 px-6 py-4 text-[16px] italic leading-[1.7] text-neutral-700">${inlineToJsx(buf.join(" "))}</blockquote>` });
      continue;
    }

    // TABLE — header row, delimiter, then body rows.
    if (t.startsWith("|") && i + 1 < lines.length && isDelimiterRow(lines[i + 1])) {
      const head = splitRow(lines[i]);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const th = head.map((c) => `<th scope="col" className="border-b border-neutral-300 px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-neutral-500">${inlineToJsx(c)}</th>`).join("");
      const tb = rows.map((r) =>
        `<tr>${r.map((c) => `<td className="border-b border-neutral-200 px-3 py-2 align-top">${inlineToJsx(c)}</td>`).join("")}</tr>`,
      ).join("");
      // overflow-x-auto because a thresholds table on a phone must scroll inside
      // itself rather than making the whole page scroll sideways.
      out.push({ jsx: `<div className="overflow-x-auto"><table className="w-full border-collapse text-[15px]"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>` });
      continue;
    }

    // BULLET LIST
    if (/^[-*]\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      const li = items.map((x) => `<li className="pl-1">${inlineToJsx(x)}</li>`).join("");
      out.push({ jsx: `<ul className="list-disc space-y-2 pl-6">${li}</ul>` });
      continue;
    }

    // WHOLE-LINE ITALIC — the byline and the verification stamp.
    const italic = /^_(.+)_$/.exec(t);
    if (italic) {
      out.push({ jsx: `<p className="font-mono text-[12px] uppercase tracking-wider text-neutral-500">${inlineToJsx(italic[1])}</p>` });
      i++; continue;
    }

    // PARAGRAPH — consecutive plain lines, joined.
    if (/^[A-Za-z0-9"'(\[*`$£€]/.test(t)) {
      const buf: string[] = [];
      while (i < lines.length) {
        const s = lines[i].trim();
        if (s === "" || /^[#>|]/.test(s) || /^[-*]\s+/.test(s) || /^_.+_$/.test(s)) break;
        buf.push(s);
        i++;
      }
      out.push({ jsx: `<p>${inlineToJsx(buf.join(" "))}</p>` });
      continue;
    }

    // ANYTHING ELSE IS A THROW, not a skip. A line the composer emitted that this
    // parser does not understand would otherwise disappear from a published tax
    // page silently — the same failure class as a dropped figure.
    throw new Error(
      `blog-md-to-jsx: unsupported markdown at line ${i + 1}: ${JSON.stringify(t.slice(0, 80))}. ` +
      `The generator's input is the narrow subset lib/bees/blog-bee/compose.ts emits; if the composer gained a new construct, teach it to this parser rather than letting the line vanish.`,
    );
  }

  return out.map((b) => b.jsx);
}

/** The post's first H1 text, for cross-checking against blog_posts.title. */
export function h1Of(bodyMd: string): string | null {
  for (const l of bodyMd.split("\n")) {
    const m = /^#\s+(.+)$/.exec(l.trim());
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * The verification stamp line, verbatim from the body.
 *
 * Read OUT of the body rather than recomposed, so the page and the post cannot
 * disagree about the date — the stamp is the post's own claim about when its
 * figures were checked, and restating it here would create a second source.
 */
export function stampOf(bodyMd: string): string | null {
  for (const l of bodyMd.split("\n")) {
    const m = /^_(Figures verified against .+)_$/.exec(l.trim());
    if (m) return m[1];
  }
  return null;
}

/** The first non-byline paragraph under "## The answer" — the snippet/description. */
export function answerOf(bodyMd: string): string | null {
  const lines = bodyMd.split("\n");
  const at = lines.findIndex((l) => /^##\s+The answer\s*$/.test(l.trim()));
  if (at < 0) return null;
  for (let i = at + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "") continue;
    if (/^#/.test(t)) break;
    if (/^_.+_$/.test(t)) continue;
    return t;
  }
  return null;
}

/** Every external link target in the body, in order, deduped. */
export function linksOf(bodyMd: string): string[] {
  const out: string[] = [];
  for (const m of bodyMd.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}
