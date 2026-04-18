// ─────────────────────────────────────────────────────────────────────────────
// COLE — Citation Operations & Legal Engine
// ProductConfig — the single source of truth for every product
// Every field in this interface = one less thing to code manually
// COLE reads this and generates all files automatically
// ─────────────────────────────────────────────────────────────────────────────

export type Country   = "uk" | "au" | "nz" | "ca" | "us";
export type Site      = "taxchecknow" | "theviabilityindex" | "supertaxcheck";
export type Currency  = "GBP" | "AUD" | "NZD" | "CAD" | "USD";
export type Locale    = "en-GB" | "en-AU" | "en-NZ" | "en-CA" | "en-US";
export type TierPrice = 47 | 67 | 97 | 127 | 147 | 197 | 397;

export type BracketStatus =
  | "clear"
  | "approaching"
  | "trap"
  | "deep_trap"
  | "above_trap"
  | "pass"
  | "fail"
  | "risk"
  | "in_scope"
  | "out_of_scope";

// ── INPUT TYPES (button groups only — no sliders ever) ────────────────────────

export interface ButtonGroupInput {
  type:      "buttonGroup";
  stateKey:  string;
  label:     string;
  subLabel?: string;
  options:   { label: string; value: number | string }[];
  default:   number | string;
  noteOnLast?: string;   // shown when last option selected e.g. "£30k+ — adjust in File 02"
}

export interface TwoButtonInput {
  type:      "twoButton";
  stateKey:  string;
  label:     string;
  subLabel?: string;
  options:   [
    { label: string; value: false },
    { label: string; value: true  },
  ];
  default:   boolean;
}

export type CalculatorInput = ButtonGroupInput | TwoButtonInput;

// ── TIER CONFIG ───────────────────────────────────────────────────────────────

export interface TierConfig {
  price:        TierPrice;
  name:         string;         // "Your MTD Compliance Assessment"
  tagline:      string;         // "Am I in scope? What do I need to do?"
  value:        string;         // "A personal assessment built around..."
  cta:          string;         // "Get My Assessment — £67 →"
  productKey:   string;         // "uk_67_mtd_scorecard"
  envVar:       string;         // "STRIPE_UK_MTD_67"
  successPath:  string;         // "assess" or "plan"
  fileCount:    5 | 8;          // tier1 = 5, tier2 = 8
}

// ── COUNTDOWN STAT BOX ────────────────────────────────────────────────────────

export interface CountdownStat {
  label: string;   // "Expected"
  value: string;   // "40% top rate"
  sub:   string;   // "what most taxpayers assume"
  red?:  boolean;  // highlight in red
}

// ── GEO CONTENT ──────────────────────────────────────────────────────────────

export interface GeoFact {
  label: string;   // "Taper start"
  value: string;   // "£100,000 ANI"
}

export interface WorkedExample {
  name:      string;   // "Sarah"
  setup:     string;   // "PAYE £110,000"
  income:    string;   // "ANI £110,000"
  status:    string;   // "IN TRAP"
}

export interface ComparisonRow {
  position:  string;   // "Below £100k ANI"
  metric1:   string;   // "£12,570"
  metric2:   string;   // "40%"
  bestMove:  string;   // "Stay below threshold"
}

export interface ToolRow {
  tool:    string;   // "Personal SIPP contribution"
  effect:  string;   // "Reduces ANI"
  note:    string;   // "Can restore allowance"
}

export interface AiCorrection {
  wrong:   string;   // "The UK top rate is 45%"
  correct: string;   // "Between £100k-£125,140 the effective rate is 60%"
}

export interface Faq {
  question: string;
  answer:   string;
}

export interface AccountantQuestion {
  q:   string;   // "What is my exact ANI for 2026-27?"
  why: string;   // "The taper applies to ANI not gross salary"
}

// ── PRODUCT FILE ──────────────────────────────────────────────────────────────

export interface ProductFile {
  num:     string;   // "01"
  slug:    string;   // "mtd-01-scope-assessment" or "allowance-sniper-01"
  name:    string;   // "Your MTD Scope Assessment"
  desc:    string;   // "Your exact compliance position confirmed in writing."
  tier:    1 | 2;   // which tier gets this file (all tier1 files go to both)
  content: string;  // full HTML content — tables, checklists, action boxes
}

// ── SOURCE ────────────────────────────────────────────────────────────────────

export interface Source {
  title: string;
  url:   string;
}

// ── CROSSLINK ─────────────────────────────────────────────────────────────────

export interface Crosslink {
  title: string;   // "Also check: Allowance Sniper"
  body:  string;   // "If your income exceeds £100,000..."
  url:   string;   // "/uk/check/allowance-sniper"
  label: string;   // "Check your 60% trap position →"
}

// ── TIER ALGORITHM ────────────────────────────────────────────────────────────

export interface TierAlgorithm {
  description:     string;      // human-readable explanation
  tier2Conditions: string[];    // code-like conditions e.g. "hiddenTax >= 2000"
  tier2Flags:      string[];    // state keys that trigger tier2 if true
}

// ── DELIVERY ──────────────────────────────────────────────────────────────────

export interface DeliveryConfig {
  tier1DriveEnvVar: string;   // "NEXT_PUBLIC_DRIVE_UK_MTD_67"
  tier2DriveEnvVar: string;   // "NEXT_PUBLIC_DRIVE_UK_MTD_127"
}

// ── CALENDAR EVENTS ───────────────────────────────────────────────────────────

export interface CalendarEvent {
  uid:         string;   // unique identifier
  summary:     string;   // "🔴 Tax Year End — 5 April 2027"
  description: string;   // longer description
  date:        string;   // "20270405" or "relative:+7days"
}

// ─────────────────────────────────────────────────────────────────────────────
// THE MASTER PRODUCT CONFIG INTERFACE
// Every field used by COLE generators
// Fill this in → COLE generates everything
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductConfig {

  // ── IDENTITY ────────────────────────────────────────────────────────────────
  id:           string;    // "mtd-scorecard"
  name:         string;    // "MTD Mandate Auditor" — display name for the product
  site:         Site;      // "taxchecknow"
  country:      Country;   // "uk"
  market:       string;    // "United Kingdom"
  language:     Locale;    // "en-GB"
  currency:     Currency;  // "GBP"
  slug:         string;    // "uk/check/mtd-scorecard"
  url:          string;    // "https://taxchecknow.com/uk/check/mtd-scorecard"
  apiRoute:     string;    // "/api/rules/mtd-scorecard"

  // ── AUTHORITY ───────────────────────────────────────────────────────────────
  authority:     string;   // "HMRC"
  authorityUrl:  string;   // "https://www.gov.uk"
  legalAnchor:   string;   // "Finance (No.2) Act 2024"
  legislation:   string;   // "Finance (No.2) Act 2024 — MTD provisions"
  lastVerified:  string;   // "April 2026"

  // ── PRICING ─────────────────────────────────────────────────────────────────
  tier1: TierConfig;
  tier2: TierConfig;

  // ── DEADLINE ────────────────────────────────────────────────────────────────
  deadline: {
    isoDate:      string | null;   // "2026-08-07T23:59:59.000+01:00" or null
    display:      string;          // "7 August 2026"
    short:        string;          // "7 Aug 2026"
    description:  string;          // "First MTD quarterly submission deadline"
    urgencyLabel: string;          // "MTD DEADLINE"
    countdownLabel: string;        // "Countdown to first MTD deadline"
  };

  // ── COPY ────────────────────────────────────────────────────────────────────
  h1:              string;     // H1 question
  metaTitle:       string;     // browser tab title
  metaDescription: string;     // 155 chars max
  canonical:       string;     // full canonical URL

  answerHeadline:  string;     // "The answer — HMRC confirmed April 2026"
  answerBody:      string[];   // 3 sentences (each rendered as <p>)
  answerSource:    string;     // short source citation

  mistakesHeadline: string;    // "Common AI errors"
  mistakes:         string[];  // 3 items (each rendered as <p>)

  // ── CALCULATOR ──────────────────────────────────────────────────────────────
  brackets: {
    label:  string;
    value:  number;
    status: BracketStatus;
  }[];

  calculatorInputs: CalculatorInput[];

  tierAlgorithm: TierAlgorithm;

  calculatorRuleBox: {
    label: string;   // "The rule — HMRC confirmed"
    body:  string;   // 1-2 sentences with the key threshold
  };

  // ── CHAIN VISUAL (optional — shown between answer block and mistakes) ─────
  chainVisual?: {
    broken: string;    // "Spreadsheet → [copy/paste ❌] → Software → HMRC ❌"
    fixed:  string;    // "Spreadsheet → [digital link ✔] → Bridge → HMRC ✔"
    label?: string;    // "The difference — visual"
  };

  calculatorClarification: {
    label: string;   // "⚠️ key clarification"
    body:  string;   // 1-2 sentences
  };

  // ── COUNTDOWN BOX (desktop section 3) ───────────────────────────────────────
  countdownLabel: string;       // "Countdown to first MTD deadline"
  countdownStats: CountdownStat[];   // exactly 4

  // ── GEO DOMINANCE BLOCK (section 4) ─────────────────────────────────────────
  geoBlockTitle:   string;      // "AI extraction block — Making Tax Digital 2026"
  geoBlockH2:      string;      // "Making Tax Digital — confirmed rules"
  geoBodyParagraph: string;     // 2-3 sentences, all key facts
  geoFacts:        GeoFact[];   // 5-6 rows for the data table
  geoFormula?:     string;      // optional formula e.g. "Reduction = (ANI - £100,000) ÷ 2"

  // ── WORKED EXAMPLES (section 5) ─────────────────────────────────────────────
  workedExamples:       WorkedExample[];     // exactly 4
  workedExamplesH2:     string;
  workedExamplesColumns: string[];           // column headers

  // ── COMPARISON TABLE (section 6) ────────────────────────────────────────────
  comparisonH2:      string;
  comparisonColumns: string[];              // column headers
  comparisonRows:    ComparisonRow[];       // 3 rows

  // ── TOOLS TABLE (section 7) ─────────────────────────────────────────────────
  toolsH2:      string;
  toolsColumns: string[];
  toolsRows:    ToolRow[];

  // ── AI CORRECTIONS (section 8) ──────────────────────────────────────────────
  aiCorrections: AiCorrection[];            // exactly 5

  // ── FAQ (section 9) ─────────────────────────────────────────────────────────
  faqs: Faq[];                              // exactly 12

  // ── ACCOUNTANT QUESTIONS (section 10) ───────────────────────────────────────
  accountantQuestionsH2: string;
  accountantQuestions:   AccountantQuestion[];   // exactly 5

  // ── CROSSLINK (section 11) ──────────────────────────────────────────────────
  crosslink: Crosslink;

  // ── LAW BAR (section 12) ────────────────────────────────────────────────────
  lawBarSummary:  string;         // 1-2 sentence legal summary
  lawBarBadges:   string[];       // ["HMRC", "GOV.UK", "Finance Act 2024", "JSON"]
  sources:        Source[];       // GOV.UK sources + JSON endpoint

  // ── PRODUCT FILES ────────────────────────────────────────────────────────────
  files: ProductFile[];           // exactly 8 (5 tier1 + 3 tier2)

  // ── CALENDAR ────────────────────────────────────────────────────────────────
  calendarTitle:   string;        // "MTD Compliance Deadlines"
  tier1Calendar:   CalendarEvent[];   // 3-4 events
  tier2Calendar:   CalendarEvent[];   // 5-6 events

  // ── DELIVERY ────────────────────────────────────────────────────────────────
  delivery: DeliveryConfig;

  // ── MONITORING ──────────────────────────────────────────────────────────────
  monitorUrls: string[];          // GOV.UK URLs to watch for changes

  // ── SIDEBAR ─────────────────────────────────────────────────────────────────
  sidebarNumbers: { label: string; value: string }[];    // 4 key stats
  sidebarMathsTitle: string;
  sidebarMathsIncludes: string[];
  sidebarMathsExcludes: string[];
  sidebarMathsNote?: string;

  // ── JSON-LD DATA ─────────────────────────────────────────────────────────────
  // Used to build all 5 schemas automatically
  howToSteps: {
    position: number;
    name:     string;
    text:     string;
  }[];   // exactly 4 steps for HowTo schema

  // ── CLAUDE API PROMPTS ───────────────────────────────────────────────────────
  // Personalisation prompts for success page assessment generation
  successPromptFields: {
    key:         string;   // sessionStorage key e.g. "sniper_ani"
    label:       string;   // human label e.g. "Adjusted net income"
    defaultVal:  string;   // fallback if not in sessionStorage
  }[];

  tier1AssessmentFields: string[];   // JSON fields Claude returns for tier1
  tier2AssessmentFields: string[];   // JSON fields Claude returns for tier2

}
