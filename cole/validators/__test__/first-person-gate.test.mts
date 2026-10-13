// cole/validators/__test__/first-person-gate.test.mts
//
// F45 gate test. Run: npx tsx cole/validators/__test__/first-person-gate.test.mts
// Pure for the unit cases; the census reads the repo's own corpus routes.

import * as fs from "node:fs";
import * as path from "node:path";
import { scanText, QUOTING_KEYS, ALLOW_MARKER, FIRST_PERSON_PATTERNS } from "../first-person-gate.js";

let failed = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
}
const hits = (text: string): number => scanText("x.ts", text).length;

console.log("\n-- it catches what actually shipped ------------------------------------------");
// Verbatim from the live assessments rows, 2026-09-27.
for (const real of [
  'Without knowing your income level or the foreign tax rate where you reside, I cannot calculate a specific savings figure for you.',
  'Without knowing your salary, host country, and foreign taxes paid, I cannot calculate your specific savings.',
  'Without knowing your specific income figures, I cannot calculate your exact exposure.',
]) check(`caught: ${real.slice(0, 52)}…`, hits(real), 1);

console.log("\n-- and the other first-person shapes -----------------------------------------");
for (const t of [
  "I can't give you a number here.",
  "I am unable to determine your residency.",
  "I do not have your settlement date.",
  "I would need your income to calculate this.",
  "I recommend electing the FTC.",
  "As an AI, I have no access to your records.",
]) check(`caught: ${t.slice(0, 44)}`, hits(t), 1);

console.log("\n-- what it must NOT flag ------------------------------------------------------");
for (const t of [
  "This figure is not available here — work it out as follows.",
  "The deciding factor is the effective foreign tax rate.",
  'The declaration reads "I declare that the information is true and correct".',
  "Taxpayers who cannot substantiate the claim lose the deduction.",
  "It cannot be claimed twice.",
]) check(`clean: ${t.slice(0, 44)}`, hits(t), 0);

console.log("\n-- the structural exemption ---------------------------------------------------");
check('"question": first person is the customer',
  hits('      "question": "What if I cannot afford to repay the loan?",'), 0);
check('"ai_says": first person is the quoted wrong answer',
  hits('      "ai_says": "ChatGPT says: I live abroad so I cannot be UK resident",'), 0);
check("a space before the colon still exempts (the regex bug this pins)",
  hits('      "ai_says" : "I cannot be UK resident",'), 0);
check("but a body field with the same text is NOT exempt",
  hits('      "body": "I cannot be UK resident",'), 1);
check(`${ALLOW_MARKER} exempts a line`,
  hits(`  const example = "I cannot calculate"; // ${ALLOW_MARKER}`), 0);
check(`quoting keys: ${QUOTING_KEYS.join(",")}`, QUOTING_KEYS.length, 5);
check("pattern count", FIRST_PERSON_PATTERNS.length, 3);

console.log("\n-- census: what the gate would block today ------------------------------------");
const rulesDir = path.join(process.cwd(), "app", "api", "rules");
let files = 0;
const flagged: string[] = [];
for (const d of fs.readdirSync(rulesDir)) {
  const f = path.join(rulesDir, d, "route.ts");
  if (!fs.existsSync(f)) continue;
  files++;
  const h = scanText(f, fs.readFileSync(f, "utf8"));
  if (h.length) flagged.push(`${d}:${h.map((x) => x.line).join(",")}`);
}
const prompt = path.join(process.cwd(), "lib", "assess-core.ts");
const promptHits = scanText(prompt, fs.readFileSync(prompt, "utf8"));
console.log(`      corpus routes scanned: ${files}`);
check("no corpus route is blocked", flagged, []);
check("the prompt builder is clean", promptHits.length, 0);

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}\n`);
process.exitCode = failed === 0 ? 0 : 1;
