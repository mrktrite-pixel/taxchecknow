// ─── TAXCHECKNOW PERSONA LIBRARY ───────────────────────────────────────────
import type { PersonaConfig } from "../types/product-config";

// ─── UK — JAMES HARTLEY ────────────────────────────────────────────────────
export const JAMES: PersonaConfig = {
  name: "James",
  age: 54,
  occupation: "Director, Hartley Precision Engineering Ltd — 12 employees, West Midlands",
  location: "Solihull, West Midlands",
  family: "Wife Helen (part-time teacher). Two kids at university.",
  financialSnapshot: "£62k salary, £38k dividends. Birmingham rental flat. Pension largely ignored. Same accountant his dad used — sees him once a year in April.",
  painPoint: "James runs a tight ship on the factory floor. His tax affairs are a different story. He assumes his accountant is on top of it. His accountant assumes James is asking if he needs anything changed.",
  discovery: "James searched the question after getting a letter from HMRC — not threatening, just a reminder — but it made him realise he had no idea whether his numbers were right.",
  voice: "Plain. Direct. Slightly impatient. Does not want jargon. Wants the number and what to do about it. Trusts concrete examples over explanations.",
};

// ─── US — TYLER CHEN ───────────────────────────────────────────────────────
export const TYLER: PersonaConfig = {
  name: "Tyler",
  age: 36,
  occupation: "Co-founder and CEO, Stackform Inc — B2B SaaS, Austin TX, Series A",
  location: "Austin, Texas",
  family: "Partner Maya (UX designer). No kids. Dog named Kernel.",
  financialSnapshot: "$800k engineering payroll (8 US engineers, 4 India offshore). $2.1M ARR. Holds ISO options on 800k shares. QSBS qualified. Sells into 18 states.",
  painPoint: "Tyler is meticulous about product. His tax situation has grown faster than his attention to it. The offshore team and multi-state sales are both newer than the last full tax review.",
  discovery: "Tyler found the citation gap when stress-testing his Section 174 position with an AI tool before a board meeting. Got three different answers. Went looking for one source that was definitive.",
  voice: "Precise. Data-driven. Prefers to understand the rule before accepting the advice. Will share a good tool on Slack immediately. Respects speed and specificity.",
};

// ─── NZ — AROHA TANE ───────────────────────────────────────────────────────
export const AROHA: PersonaConfig = {
  name: "Aroha",
  age: 43,
  occupation: "Speech language therapist (part-time), Airbnb host, landlord — Auckland",
  location: "Pt Chevalier, Auckland",
  family: "Husband Mike (civil engineer). Two teenagers — Tama (16) and Hana (14).",
  financialSnapshot: "3 properties: family home, long-term rental in Avondale (held in family trust), Airbnb in Glen Eden. Combined household income ~$180k.",
  painPoint: "Aroha does the family finances. Their accountant David is good but busy. She researches before every annual meeting to make sure she asks the right questions.",
  discovery: "Aroha found conflicting bright-line answers on three different websites before selling an inherited property. Three sites. Three different rules. She needed one definitive answer.",
  voice: "Thorough. Asks good questions. Trusts research. Slightly sceptical of generic advice. Appreciates when complexity is acknowledged. Wry Kiwi humour.",
};

export const PERSONAS = { JAMES, TYLER, AROHA };
