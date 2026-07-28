// â”€â”€â”€ CALCULATOR INPUT TYPES (exported for generator use) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// TEMPORAL v1 Step 6.1 â€” the declaration vocabulary. Canonical in
// cole-marketing/lib/temporal-types.ts, snapshotted to lib/ by
// scripts/sync-cole-lib.mjs. Type-only import: cole/ is excluded from the app
// tsconfig, so this never pulls generator code into the app bundle.
import type { TemporalDeclaration } from "../../lib/temporal-types";
import type { NurtureDeclaration } from "../../lib/nurture-types";

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

// â”€â”€â”€ PRODUCT CONFIG v3.0 â€” with PersonaConfig + StorySection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


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
  financialSnapshot: string; // "Â£180k salary, Â£45k dividends, Birmingham rental"
  painPoint: string;      // "Accountant visits once a year. Everything else is guesswork."
  discovery: string;      // "James googled the question after his accountant didn't call"
  voice: string;          // Tone: "Plain. No-nonsense. Slightly frustrated. Midlands straight-talker."
}

export interface StorySection {
  hook: string;           // Opening sentence â€” sets scene immediately
  setup: string[];        // 2-3 paragraphs building the situation
  revelation: string;     // The moment James/Tyler/Aroha realises the problem
  resolution: string;     // What they did / what the calculator showed
  crosslinkTeaser?: string; // "Read James's full story on..." (blog site)
}

export interface ProductConfig {
  // â”€â”€â”€ IDENTITY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  id: string;
  name: string;
  site: string;
  country: string;
  market: string;
  language: string;
  currency: string;

  // â”€â”€â”€ ROUTING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  slug: string;
  url: string;
  apiRoute: string;

  // â”€â”€â”€ LEGAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  authority: string;
  authorityUrl: string;
  legalAnchor: string;
  legislation: string;
  lastVerified: string;

  // â”€â”€â”€ PRODUCTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ DEADLINE (PRESENTATION ONLY) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // WARNING: `isoDate` here is a STORED DATE and is therefore wrong the day
  // after it passes. It drives the gate-page countdown only, and the generated
  // page already suppresses the countdown when it has elapsed
  // (generate-gate-page.ts:81 `if (!DEADLINE_ISO) return null`, plus the
  // expired-suppression log at :128). It is NOT, and must never again become,
  // the input to anything that SCHEDULES an email â€” that is `temporal` below.
  // Set isoDate to "" for any product whose date is not a fixed calendar date.
  deadline: {
    isoDate: string;
    display: string;
    short: string;
    description: string;
    urgencyLabel: string;
    countdownLabel: string;
  };

  // â”€â”€â”€ TEMPORAL DECLARATION (TEMPORAL v1 Â· Step 6.1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // The product's own statement of its temporal behaviour, and the ONLY thing
  // the email scheduler reads (via lib/temporal-resolver.ts).
  //
  // OPTIONAL BY TYPE, MANDATORY BY GATE. Making it required here would break
  // every existing config at once and force a rushed, inferred declaration for
  // 21 products â€” exactly what ruling 3.5 forbids. Instead the soverella gate
  // item `temporal_declared` (Step 6.4) blocks any product from SHIPPING while
  // it is absent, so each product declares as a by-product of work already
  // happening. Absent here means UNDECLARED, which means SILENT (6.3) â€” never
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
  nurture?: NurtureDeclaration;

  // â”€â”€â”€ PAGE CONTENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ CALCULATOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ PERSONA + STORY (v3.0) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  persona?: PersonaConfig;
  story?: StorySection;

  // â”€â”€â”€ GEO BLOCK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  geoBlockTitle: string;
  geoBlockH2: string;
  geoBodyParagraph: string;
  geoFormula: string;
  geoFacts: Array<{ label: string; value: string }>;

  // â”€â”€â”€ WORKED EXAMPLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  workedExamplesH2: string;
  workedExamplesColumns: string[];
  workedExamples: Array<{
    name: string;
    setup: string;
    income: string;
    status: string;
  }>;

  // â”€â”€â”€ COMPARISON TABLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  comparisonH2: string;
  comparisonColumns: string[];
  comparisonRows: Array<{
    position: string;
    metric1: string;
    metric2: string;
    bestMove: string;
  }>;

  // â”€â”€â”€ TOOLS TABLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  toolsH2: string;
  toolsColumns: string[];
  toolsRows: Array<{
    tool: string;
    effect: string;
    note: string;
  }>;

  // â”€â”€â”€ AI CORRECTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  aiCorrections: Array<{ wrong: string; correct: string }>;

  // â”€â”€â”€ FAQs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  faqs: Array<{ question: string; answer: string }>;

  // â”€â”€â”€ ACCOUNTANT QUESTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  accountantQuestionsH2: string;
  accountantQuestions: Array<{ q: string; why: string }>;

  // â”€â”€â”€ CROSSLINK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  crosslink: { title: string; body: string; url: string; label: string };

  // â”€â”€â”€ LAW BAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  lawBarSummary: string;
  lawBarBadges: string[];
  sources: Array<{ title: string; url: string }>;

  // â”€â”€â”€ FILES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  files: Array<ProductFile>;

  // â”€â”€â”€ CALENDAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  calendarTitle: string;
  tier1Calendar: Array<{ uid: string; summary: string; description: string; date: string }>;
  tier2Calendar: Array<{ uid: string; summary: string; description: string; date: string }>;

  // â”€â”€â”€ DELIVERY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  delivery?: { tier1DriveEnvVar: string; tier2DriveEnvVar: string };

  // â”€â”€â”€ MONITORING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  monitorUrls: string[];

  // â”€â”€â”€ SIDEBAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sidebarNumbers: Array<{ label: string; value: string }>;
  sidebarMathsTitle: string;
  sidebarMathsIncludes: string[];
  sidebarMathsExcludes: string[];
  sidebarMathsNote: string;

  // â”€â”€â”€ HOW TO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  howToSteps: Array<{ position: number; name: string; text: string }>;

  // â”€â”€â”€ SUCCESS PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  successPromptFields: Array<{ key: string; label: string; defaultVal: string }>;
  tier1AssessmentFields: string[];
  tier2AssessmentFields: string[];
}

