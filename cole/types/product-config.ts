// ─── CALCULATOR INPUT TYPES (exported for generator use) ──────────────────────

// TEMPORAL v1 Step 6.1 — the declaration vocabulary. Canonical in
// cole-marketing/lib/temporal-types.ts, snapshotted to lib/ by
// scripts/sync-cole-lib.mjs. Type-only import: cole/ is excluded from the app
// tsconfig, so this never pulls generator code into the app bundle.
import type { TemporalDeclaration } from "../../lib/temporal-types";
import type { NurtureLane } from "../../lib/nurture-types";

export interface ButtonGroupInput {
  type: "buttonGroup";
  stateKey: string;
  label: string;
  subLabel?: string;
  options: Array<{ label: string; value: string | number | boolean }>;
  default: string | number | boolean;
  noteOnLast?: string;
}

export interface TwoButtonInput {
  type: "twoButton";
  stateKey: string;
  label: string;
  subLabel?: string;
  options: Array<{ label: string; value: string | number | boolean }>;
  default: string | number | boolean;
}

// ─── PRODUCT CONFIG v3.0 — with PersonaConfig + StorySection ───────────────


export interface ProductFile {
  num: string;
  slug: string;
  name: string;
  desc: string;
  tier: 1 | 2;
  content: string;
}

export interface PersonaConfig {
  name: string;           // "James"
  age: number;            // 54
  occupation: string;     // "Company director, Hartley Precision Engineering"
  location: string;       // "West Midlands"
  family: string;         // "Wife Helen, two kids at university"
  financialSnapshot: string; // "£180k salary, £45k dividends, Birmingham rental"
  painPoint: string;      // "Accountant visits once a year. Everything else is guesswork."
  discovery: string;      // "James googled the question after his accountant didn't call"
  voice: string;          // Tone: "Plain. No-nonsense. Slightly frustrated. Midlands straight-talker."
}

export interface StorySection {
  hook: string;           // Opening sentence — sets scene immediately
  setup: string[];        // 2-3 paragraphs building the situation
  revelation: string;     // The moment James/Tyler/Aroha realises the problem
  resolution: string;     // What they did / what the calculator showed
  crosslinkTeaser?: string; // "Read James's full story on..." (blog site)
}

export interface ProductConfig {
  // ─── IDENTITY ──────────────────────────────────────────────────────────
  id: string;
  name: string;
  site: string;
  country: string;
  market: string;
  language: string;
  currency: string;

  // ─── ROUTING ───────────────────────────────────────────────────────────
  slug: string;
  url: string;
  apiRoute: string;

  // ─── LEGAL ─────────────────────────────────────────────────────────────
  authority: string;
  authorityUrl: string;
  legalAnchor: string;
  legislation: string;
  lastVerified: string;

  // ─── PRODUCTS ──────────────────────────────────────────────────────────
  tier1: {
    price: number;
    name: string;
    tagline: string;
    value: string;
    cta: string;
    productKey: string;
    envVar: string;
    successPath: string;
    fileCount: number;
  };
  tier2: {
    price: number;
    name: string;
    tagline: string;
    value: string;
    cta: string;
    productKey: string;
    envVar: string;
    successPath: string;
    fileCount: number;
  };

  // ─── DEADLINE (PRESENTATION ONLY) ──────────────────────────────────────
  // WARNING: `isoDate` here is a STORED DATE and is therefore wrong the day
  // after it passes. It drives the gate-page countdown only, and the generated
  // page already suppresses the countdown when it has elapsed
  // (generate-gate-page.ts:81 `if (!DEADLINE_ISO) return null`, plus the
  // expired-suppression log at :128). It is NOT, and must never again become,
  // the input to anything that SCHEDULES an email — that is `temporal` below.
  // Set isoDate to "" for any product whose date is not a fixed calendar date.
  deadline: {
    isoDate: string;
    display: string;
    short: string;
    description: string;
    urgencyLabel: string;
    countdownLabel: string;
  };

  // ─── TEMPORAL DECLARATION (TEMPORAL v1 · Step 6.1) ─────────────────────
  // The product's own statement of its temporal behaviour, and the ONLY thing
  // the email scheduler reads (via lib/temporal-resolver.ts).
  //
  // OPTIONAL BY TYPE, MANDATORY BY GATE. Making it required here would break
  // every existing config at once and force a rushed, inferred declaration for
  // 21 products — exactly what ruling 3.5 forbids. Instead the soverella gate
  // item `temporal_declared` (Step 6.4) blocks any product from SHIPPING while
  // it is absent, so each product declares as a by-product of work already
  // happening. Absent here means UNDECLARED, which means SILENT (6.3) — never
  // a fallback to config.deadline or to any other date.
  temporal?: TemporalDeclaration;

  // ─── NURTURE DECLARATION (TEMPORAL v1 · Step 7.1) ──────────────────────
  // The product's own nurture lane. INDEPENDENT of `temporal`: an unresolvable
  // product can still be nurtured (that is the entire premise of Step 7), and a
  // product with a resolvable deadline may declare both.
  //
  // NO GLOBAL DEFAULT — absent means NO nurture track, never an inherited one.
  // A track is a decision someone made about this product's customers.
  //
  // The cadence is validated AT EMIT (shape + copy availability), so a milestone
  // with no template is a loud declaration error rather than a queued row that
  // can never render.
  nurture?: NurtureLane;

  // ─── PAGE CONTENT ──────────────────────────────────────────────────────
  h1: string;
  metaTitle: string;
  metaDescription: string;
  canonical: string;

  answerHeadline: string;
  answerBody: string[];
  answerSource: string;

  mistakesHeadline: string;
  mistakes: string[];

  chainVisual: {
    label: string;
    broken: string;
    fixed: string;
  };

  brackets: Array<{
    label: string;
    value: number | string;
    status: "clear" | "approaching" | "trap" | "deep_trap" | "risk" | "fail" | "in_scope" | "out_of_scope";
  }>;

  // ─── CALCULATOR ────────────────────────────────────────────────────────
  calculatorInputs: Array<ButtonGroupInput | TwoButtonInput>;

  tierAlgorithm: {
    description: string;
    tier2Conditions: string[];
    tier2Flags: string[];
  };

  calculatorRuleBox: { label: string; body: string };
  calculatorClarification: { label: string; body: string };
  countdownLabel: string;

  countdownStats: Array<{
    label: string;
    value: string;
    sub: string;
    red?: boolean;
  }>;

  // ─── PERSONA + STORY (v3.0) ────────────────────────────────────────────
  persona?: PersonaConfig;
  story?: StorySection;

  // ─── GEO BLOCK ─────────────────────────────────────────────────────────
  geoBlockTitle: string;
  geoBlockH2: string;
  geoBodyParagraph: string;
  geoFormula: string;
  geoFacts: Array<{ label: string; value: string }>;

  // ─── WORKED EXAMPLES ───────────────────────────────────────────────────
  workedExamplesH2: string;
  workedExamplesColumns: string[];
  workedExamples: Array<{
    name: string;
    setup: string;
    income: string;
    status: string;
  }>;

  // ─── COMPARISON TABLE ──────────────────────────────────────────────────
  comparisonH2: string;
  comparisonColumns: string[];
  comparisonRows: Array<{
    position: string;
    metric1: string;
    metric2: string;
    bestMove: string;
  }>;

  // ─── TOOLS TABLE ───────────────────────────────────────────────────────
  toolsH2: string;
  toolsColumns: string[];
  toolsRows: Array<{
    tool: string;
    effect: string;
    note: string;
  }>;

  // ─── AI CORRECTIONS ────────────────────────────────────────────────────
  aiCorrections: Array<{ wrong: string; correct: string }>;

  // ─── FAQs ──────────────────────────────────────────────────────────────
  faqs: Array<{ question: string; answer: string }>;

  // ─── ACCOUNTANT QUESTIONS ──────────────────────────────────────────────
  accountantQuestionsH2: string;
  accountantQuestions: Array<{ q: string; why: string }>;

  // ─── CROSSLINK ─────────────────────────────────────────────────────────
  crosslink: { title: string; body: string; url: string; label: string };

  // ─── LAW BAR ───────────────────────────────────────────────────────────
  lawBarSummary: string;
  lawBarBadges: string[];
  sources: Array<{ title: string; url: string }>;

  // ─── FILES ─────────────────────────────────────────────────────────────
  files: Array<ProductFile>;

  // ─── CALENDAR ──────────────────────────────────────────────────────────
  calendarTitle: string;
  tier1Calendar: Array<{ uid: string; summary: string; description: string; date: string }>;
  tier2Calendar: Array<{ uid: string; summary: string; description: string; date: string }>;

  // ─── DELIVERY ──────────────────────────────────────────────────────────
  delivery?: { tier1DriveEnvVar: string; tier2DriveEnvVar: string };

  // ─── MONITORING ────────────────────────────────────────────────────────
  monitorUrls: string[];

  // ─── SIDEBAR ───────────────────────────────────────────────────────────
  sidebarNumbers: Array<{ label: string; value: string }>;
  sidebarMathsTitle: string;
  sidebarMathsIncludes: string[];
  sidebarMathsExcludes: string[];
  sidebarMathsNote: string;

  // ─── HOW TO ────────────────────────────────────────────────────────────
  howToSteps: Array<{ position: number; name: string; text: string }>;

  // ─── SUCCESS PAGE ──────────────────────────────────────────────────────
  successPromptFields: Array<{ key: string; label: string; defaultVal: string }>;
  tier1AssessmentFields: string[];
  tier2AssessmentFields: string[];
}


