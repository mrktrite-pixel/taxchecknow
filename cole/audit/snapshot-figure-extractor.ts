// ─────────────────────────────────────────────────────────────────────────────
// SNAPSHOT FIGURE EXTRACTOR (Step 5)
//
// The SECOND extractor. extractAuthorityFigures() reads a BUILD's structured
// research_output; this one reads a SNAPSHOT's markdown and produces the SAME
// {label, value, unit} shape, so everything downstream is identical.
//
// It exists because the sweep was blind on 52 of 56 products: figures came only
// from build_jobs.research_output, and the 29 snapshot rows were labelled but
// never parsed.
//
// ── WRITTEN AGAINST THE REAL BYTES, NOT AGAINST "MARKDOWN" ───────────────────
// Snapshots come from lib/sources/fetcher.ts's htmlToMarkdown, which is
// regex-based: <tr> becomes "\n" and <td>/<th> become " | ". The result is NOT a
// pipe table with one row per line. ATO Table 26 actually arrives as:
//
//     Table 26: General transfer balance cap
//     |
//     Year
//     |
//     |
//     General transfer balance cap ($m)
//     |
//     ...
//     |
//     2026&ndash;27
//     |
//     |
//     2.1
//     |
//
// Every CELL on its own line, wrapped in pipes, row structure destroyed. So the
// parser cannot split lines into rows. It flattens to a cell SEQUENCE and pairs
// cells positionally, which is only valid for a strictly two-column register —
// which is exactly why parseability is reported per table rather than assumed.
//
// &ndash; is NOT decoded by htmlToMarkdown (it handles only &amp; &lt; &gt;
// &quot; &#39; &nbsp;), so period keys arrive as "2026&ndash;27".
//
// ── THE UNIT LIVES IN THE HEADER, NOT THE CELL ───────────────────────────────
// The cell says "2.1". The header says "General transfer balance cap ($m)". The
// figure is $2,100,000. Reading the cell alone would compare 2.1 against a config
// written in dollars and report a spurious disagreement, so the column header's
// unit hint is applied as a multiplier.
// ─────────────────────────────────────────────────────────────────────────────
import type { AuthorityFigure } from "./config-authority-diff";

export interface TableParse {
  caption: string;
  headers: string[];
  rows: { key: string; raw: string }[];
  parseable: boolean;
  reason: string;
}

export interface SnapshotParseResult {
  figures: AuthorityFigure[];
  tablesFound: number;
  tablesParsed: number;
  /** Rows present but deliberately not emitted (superseded periods). */
  rowsSkipped: number;
  parseable: boolean;
  reason: string;
  tables: TableParse[];
}

const ENTITIES: [RegExp, string][] = [
  [/&ndash;/gi, "–"], [/&mdash;/gi, "—"], [/&nbsp;/gi, " "],
  [/&amp;/gi, "&"], [/&#39;/gi, "'"], [/&quot;/gi, '"'],
];
function decode(s: string): string {
  let t = s;
  for (const [re, to] of ENTITIES) t = t.replace(re, to);
  return t.trim();
}

/**
 * Unit + multiplier implied by a column header.
 *   "General transfer balance cap ($m)" → AUD x1,000,000
 *   "Defined benefit income cap"        → AUD x1 (values carry their own $)
 */
export function unitFromHeader(header: string): { unit: string; multiplier: number } {
  const h = header.toLowerCase();
  if (/\(\s*\$\s*m/.test(h) || /\bin \$m\b/.test(h)) return { unit: "AUD", multiplier: 1_000_000 };
  if (/\(\s*\$\s*b/.test(h)) return { unit: "AUD", multiplier: 1_000_000_000 };
  if (/\(\s*\$\s*k/.test(h)) return { unit: "AUD", multiplier: 1_000 };
  if (/%|per cent|percent/.test(h)) return { unit: "%", multiplier: 1 };
  return { unit: "AUD", multiplier: 1 };
}

/** Does this cell look like a period KEY (year / financial year) rather than a value? */
function isPeriodKey(cell: string): boolean {
  return /^(19|20)\d{2}\s*[–—\-\/]\s*\d{2,4}$/.test(cell) || /^(19|20)\d{2}$/.test(cell);
}

function numericCell(cell: string): number | null {
  const m = cell.replace(/[, ]/g, "").match(/^\$?(\d+(?:\.\d+)?)%?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse every "Table N: caption" block in a snapshot.
 *
 * ONLY THE NEWEST DATA ROW IS EMITTED PER TABLE. These are historical registers —
 * Table 26 carries ten years of caps. Emitting all ten would produce nine
 * guaranteed disagreements per table (no config states the 2018-19 cap), burying
 * the one row that matters. The newest row is taken on the stated assumption that
 * authorities publish newest-first, true of every ATO table observed here; the
 * skipped count is reported so the choice is visible rather than silent.
 */
export function parseSnapshotFigures(content: string): SnapshotParseResult {
  const text = String(content ?? "");
  const tables: TableParse[] = [];
  const figures: AuthorityFigure[] = [];
  let rowsSkipped = 0;

  const markers = [...text.matchAll(/Table\s+(\d+)\s*:\s*([^\n|]+)/gi)];
  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    const caption = decode(m[2]);
    const start = (m.index ?? 0) + m[0].length;
    const nextMarker = i + 1 < markers.length ? (markers[i + 1].index ?? text.length) : text.length;
    const nextHeading = text.indexOf("\n## ", start);
    const end = Math.min(nextMarker, nextHeading === -1 ? text.length : nextHeading);
    const block = text.slice(start, end);

    const cells = block.split(/[|\n]/).map(decode).filter(c => c.length > 0);

    if (cells.length < 4) {
      tables.push({ caption, headers: [], rows: [], parseable: false, reason: `only ${cells.length} cell(s) recovered - not a readable table` });
      continue;
    }

    const headers: string[] = [];
    let k = 0;
    while (k < cells.length && headers.length < 4 && numericCell(cells[k]) === null && !isPeriodKey(cells[k])) {
      headers.push(cells[k]); k++;
    }
    if (headers.length < 2) {
      tables.push({ caption, headers, rows: [], parseable: false, reason: `expected a 2-column header, found ${headers.length}` });
      continue;
    }

    const rows: { key: string; raw: string }[] = [];
    for (let j = k; j + 1 < cells.length; j += 2) {
      const key = cells[j], raw = cells[j + 1];
      if (!isPeriodKey(key) || numericCell(raw) === null) continue;
      rows.push({ key, raw });
    }
    if (rows.length === 0) {
      tables.push({ caption, headers, rows, parseable: false, reason: "no (period, number) pairs recovered - not a clean two-column register" });
      continue;
    }

    tables.push({ caption, headers, rows, parseable: true, reason: `${rows.length} row(s)` });

    const { unit, multiplier } = unitFromHeader(headers[headers.length - 1]);
    const newest = rows[0];
    rowsSkipped += rows.length - 1;
    const n = numericCell(newest.raw)!;
    figures.push({
      id: `${caption} — ${newest.key}`,
      value: String(multiplier === 1 ? n : Math.round(n * multiplier)),
      unit,
      factRole: "threshold",
      sourceQuote: `${headers[headers.length - 1]}: ${newest.key} = ${newest.raw}`,
      occurrences: 1,
    });
  }

  const tablesParsed = tables.filter(t => t.parseable).length;
  return {
    figures,
    tablesFound: tables.length,
    tablesParsed,
    rowsSkipped,
    parseable: figures.length > 0,
    reason: tables.length === 0
      ? "no 'Table N:' blocks found - this page is not a tabular register"
      : tablesParsed === 0
        ? `${tables.length} table(s) found but none parseable: ${tables.map(t => t.reason).join("; ").slice(0, 160)}`
        : `${tablesParsed}/${tables.length} table(s) parsed, ${figures.length} figure(s) emitted`,
    tables,
  };
}
