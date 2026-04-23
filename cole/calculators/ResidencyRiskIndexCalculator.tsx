"use client";

/**
 * NOMAD-01 — Nomad Residency Risk Index (ROUTING ENGINE)
 *
 * PURPOSE: This is NOT a final verdict engine — it is a routing engine.
 * Classifies residency risk state (GREEN / YELLOW / RED / US CITIZEN LAYER)
 * and routes to country-specific engines for full analysis.
 *
 * THREE RISK STATES + US LAYER:
 *   GREEN  — Single clear residency (one country claims)
 *   YELLOW — Dual residency (two countries claim; treaty tie-breaker needed)
 *   RED    — Undefined (no clear tax home; highest audit risk)
 *   US CITIZEN — Always adds worldwide taxation layer regardless of other status
 *
 * Legal anchor: OECD Model Tax Convention Article 4 (tie-breaker via bilateral
 * treaties) + domestic residency tests (UK SRT / AU resides+183+domicile /
 * NZ 183+PPOA / CA factual / US SPT+citizenship).
 *
 * ROUTING DESTINATIONS:
 *   AU ties → /au/check/cgt-main-residence-trap
 *   UK ties → /uk/check/allowance-sniper
 *   US citizen → /us/check/feie-nomad-auditor (always)
 *   NZ ties → /nz/check/bright-line-auditor
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type RiskState = "GREEN" | "YELLOW" | "RED";

interface Route {
  label: string;
  href: string;
  note: string;
}

interface ResidencyResult {
  priorResidency:    string;
  currentCountries:  string;
  hasPermanentHome:  string;
  workType:          string;
  citizenship:       string;

  riskState:         RiskState;
  riskLabel:         string;
  usCitizenLayer:    boolean;

  countriesClaiming: string[];   // list of country codes with potential claims
  routes:            Route[];    // country-specific engine links
  flags:             string[];   // warnings (treaty advice, documentation, etc.)
}

interface VerdictResult {
  status: string;
  statusClass: string;
  panelClass: string;
  headline: string;
  stats: Array<{ label: string; value: string; highlight?: boolean }>;
  consequences: string[];
  confidence: ConfidenceLevel;
  confidenceNote: string;
  tier: Tier;
  ctaLabel: string;
  altTierLabel: string;
  productKey67: string;
  productKey147: string;
  result: ResidencyResult;
}

interface PopupAnswers {
  advisor_role: string;
  urgency: string;
  accountant: string;
}

const PRODUCT_KEYS = {
  p67:  "nomad_67_residency_risk_index",
  p147: "nomad_147_residency_risk_index",
};

const COUNTRY_LABEL: Record<string, string> = {
  uk: "United Kingdom",
  au: "Australia",
  nz: "New Zealand",
  ca: "Canada",
  us: "United States",
  other: "Other jurisdiction",
  none: "No prior residency",
  moving: "No fixed base (nomadic)",
  multi_non_us: "Multiple (non-US)",
};

const COUNTRY_ROUTE: Record<string, Route> = {
  uk: { label: "UK Allowance Sniper — SRT + 60% trap + dividend tax", href: "/uk/check/allowance-sniper",             note: "Resolve UK position: SRT score, allowances, dividend rates" },
  au: { label: "AU CGT Main Residence Trap — domicile + CGT + property", href: "/au/check/cgt-main-residence-trap",     note: "Resolve AU position: main residence, CGT, property" },
  nz: { label: "NZ Bright-Line Property Tax Decision Engine",           href: "/nz/check/bright-line-auditor",           note: "Resolve NZ position: bright-line, main home, sale timing" },
  us: { label: "US FEIE Nomad Auditor — required for US citizens abroad", href: "/us/check/feie-nomad-auditor",            note: "FEIE §911, physical presence, Form 2555" },
  ca: { label: "Canada (specialist advice recommended)",                  href: "/",                                       note: "No dedicated engine yet — seek specialist Canadian advice" },
};

function formatList(codes: string[]): string {
  const labels = codes.map(c => COUNTRY_LABEL[c] || c);
  if (labels.length === 0) return "—";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return labels.join(" and ");
  return labels.slice(0, -1).join(", ") + ", and " + labels[labels.length - 1];
}

function calcResidency(answers: AnswerMap): ResidencyResult {
  const priorResidency   = String(answers.prior_residency   || "uk");
  const currentCountries = String(answers.current_countries || "moving");
  const hasPermanentHome = String(answers.has_permanent_home || "none");
  const workType         = String(answers.work_type          || "freelance");
  const citizenship      = String(answers.citizenship        || "non_us");

  // Identify potentially claiming countries
  const countriesClaiming: string[] = [];

  // Prior country often continues to claim until formally severed
  if (["uk", "au", "nz", "ca", "us"].includes(priorResidency)) {
    // Only treat as claim if no formal severance likely (proxy: permanent home not in current country)
    // For YELLOW/RED classification we assume prior continues to claim unless clearly superseded
    countriesClaiming.push(priorResidency);
  }

  // Current country of presence often claims
  if (["uk", "au", "nz", "ca", "us"].includes(currentCountries)) {
    if (!countriesClaiming.includes(currentCountries)) {
      countriesClaiming.push(currentCountries);
    }
  }

  // US citizen layer — always adds US
  const usCitizenLayer = citizenship === "us";
  if (usCitizenLayer && !countriesClaiming.includes("us")) {
    countriesClaiming.push("us");
  }

  // Determine risk state
  let riskState: RiskState = "GREEN";

  if (currentCountries === "moving" || hasPermanentHome === "none") {
    riskState = "RED";
  } else if (countriesClaiming.length >= 2) {
    riskState = "YELLOW";
  } else if (priorResidency !== "none" && priorResidency !== currentCountries && priorResidency !== "other") {
    // Prior country likely still claims + current country also claims = dual
    riskState = "YELLOW";
  } else if (countriesClaiming.length === 1 && hasPermanentHome === "one") {
    riskState = "GREEN";
  } else {
    riskState = "YELLOW";
  }

  // Override for pure US citizen + overseas = always at least YELLOW (US + other)
  if (usCitizenLayer && countriesClaiming.length >= 2) {
    if (riskState === "GREEN") riskState = "YELLOW";
  }

  const riskLabel = {
    GREEN: "GREEN — SINGLE CLEAR RESIDENCY",
    YELLOW: "YELLOW — DUAL RESIDENCY RISK",
    RED: "RED — UNDEFINED / HIGH AUDIT RISK",
  }[riskState];

  // Build routing suggestions based on claims
  const routes: Route[] = [];
  for (const code of countriesClaiming) {
    const r = COUNTRY_ROUTE[code];
    if (r) routes.push(r);
  }
  // If US citizen, always add US route even if US not in claiming list (shouldn't happen, but belt-and-braces)
  if (usCitizenLayer && !routes.some(r => r.href.includes("/us/"))) {
    routes.push(COUNTRY_ROUTE.us);
  }

  // Flags
  const flags: string[] = [];
  if (usCitizenLayer) {
    flags.push("US citizens are taxed on worldwide income regardless of where they live. FEIE §911 may apply — but filing is always required. Form 2555 / 1116 / potentially FBAR.");
  }
  if (riskState === "YELLOW") {
    flags.push("Two or more countries can claim you. A bilateral tax treaty (if one exists between the country pair) resolves via OECD Article 4: permanent home → vital interests → habitual abode → nationality → mutual agreement. Treaty relief is NOT automatic — must be claimed.");
  }
  if (riskState === "RED") {
    flags.push("Undefined residency is the highest-audit-risk state. Without a clear tax home, multiple countries may assert taxing rights. Establishing formal residency somewhere is urgent. Source-country withholding still applies regardless.");
  }
  if (workType === "mixed" || workType === "business") {
    flags.push("Cross-border work / business adds source-country rules and potential permanent establishment (PE) exposure. Both source country and residence country may tax — specialist advice required.");
  }
  if (priorResidency === "uk" && currentCountries !== "uk") {
    flags.push("UK Statutory Residence Test (SRT) can apply with as few as 16 days if sufficient UK ties exist. A split-year treatment election may be available — requires active claim. Leaving the UK does NOT automatically end UK tax residency.");
  }
  if (priorResidency === "au" && currentCountries !== "au") {
    flags.push("Australia treats you as continuing tax resident until domicile genuinely changes. Physical absence alone is insufficient — you must establish a permanent place of abode elsewhere AND demonstrate no Australian domicile.");
  }

  return {
    priorResidency, currentCountries, hasPermanentHome, workType, citizenship,
    riskState, riskLabel, usCitizenLayer,
    countriesClaiming, routes, flags,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcResidency(answers);

  if (result.riskState === "GREEN") {
    return {
      status: result.riskLabel,
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `You appear to have clear tax residency in ${formatList(result.countriesClaiming)}. Your obligation is to file there. ${result.usCitizenLayer ? "⚠ US citizenship adds worldwide taxation regardless — always file US returns too." : "Check your country-specific position:"}`,
      stats: [
        { label: "Risk state",                value: "GREEN — single clear residency" },
        { label: "Country claiming",           value: formatList(result.countriesClaiming) },
        { label: "US citizen layer",            value: result.usCitizenLayer ? "YES — always additional" : "No" },
      ],
      consequences: [
        `✓ Based on your ties, presence, and permanent home, you appear to have clear tax residency in ${formatList(result.countriesClaiming)}. This is the cleanest residency state — one country claims, no competing claims.`,
        "Your obligation: file resident returns in that country. File non-resident returns elsewhere ONLY if you have source income from those other countries (e.g. rental property, business presence).",
        "Documentation: maintain evidence of permanent home, ties, and presence that supports the residency position. Residency challenges often occur years after the fact.",
        result.usCitizenLayer ? "⚠ US citizen layer: you are ALSO subject to US worldwide taxation regardless of where you live. FEIE §911 offsets foreign earned income up to the annual limit. File Form 1040 + Form 2555 + Form 1116 (foreign tax credits) + FBAR if foreign accounts over $10k. Filing is always required." : "",
        "Moving forward: if you move or change your pattern of life, re-assess. Residency is a moving target — annual review is a minimum.",
        "Route to your country-specific engine below for the full analysis of your local tax position.",
      ].filter(c => c !== ""),
      confidence: "MEDIUM",
      confidenceNote: "Classification based on stated ties and presence. Final determination requires country-specific tests and professional review.",
      tier: 67,
      ctaLabel: "Get My Full Residency Report — $67 →",
      altTierLabel: "Want treaty analysis + multi-country plan? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.riskState === "YELLOW") {
    return {
      status: result.riskLabel,
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `You have ties to multiple countries. ${formatList(result.countriesClaiming)} may each claim you as tax resident. A tax treaty tie-breaker (OECD Article 4) determines which country has primary taxing rights — but only if you CLAIM the treaty position with the right documentation.`,
      stats: [
        { label: "Risk state",                   value: "YELLOW — dual residency" },
        { label: "Countries potentially claiming", value: formatList(result.countriesClaiming), highlight: true },
        { label: "US citizen layer",               value: result.usCitizenLayer ? "YES — always additional" : "No",    highlight: result.usCitizenLayer },
      ],
      consequences: [
        `⚠ You have ties to ${formatList(result.countriesClaiming)}. Under each country's domestic law, each may claim you as tax resident. This is the most common residency trap for people who have moved internationally.`,
        "Treaty tie-breaker: where a bilateral tax treaty exists between two claiming countries, OECD Model Article 4 resolves the conflict in sequence — (1) permanent home available to you; (2) centre of vital interests (personal and economic ties); (3) habitual abode (over a 2-3 year period); (4) nationality; (5) mutual agreement between tax authorities.",
        "Treaty relief is NOT automatic. You must claim the treaty position on your tax return in each jurisdiction with the correct forms (e.g. UK DT-Individual, US Form 8833). File the documentation properly or risk the domestic position continuing to apply.",
        "If no treaty exists between two claiming countries: double taxation has no automatic relief. Unilateral foreign tax credits may partially offset but generally do not fully resolve.",
        result.usCitizenLayer ? "⚠ US citizen layer: US taxation applies in addition to any other residency. FEIE §911 + Form 2555 + foreign tax credits. The US filing obligation continues regardless of treaty position with another country — US tax law overrides." : "",
        "This is NOT a self-service resolution. YELLOW-state residency requires a tax advisor qualified in BOTH relevant jurisdictions (or two specialists coordinating). DIY filing in this state is a common source of tax disputes and penalty exposure.",
        "Route to both country-specific engines below for the starting point, and engage a cross-border tax advisor for the treaty analysis.",
      ].filter(c => c !== ""),
      confidence: "MEDIUM",
      confidenceNote: "Multiple countries can claim you under domestic law. Treaty tie-breaker is the resolution path — requires specialist advice and active documentation.",
      tier: 147,
      ctaLabel: "Get My Treaty Tie-Breaker Plan — $147 →",
      altTierLabel: "Just want the risk classification? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // RED
  return {
    status: result.riskLabel,
    statusClass: "text-red-700",
    panelClass: "border-red-200 bg-red-50",
    headline: `Your situation creates significant uncertainty. Without a clear tax home, multiple countries may assert taxing rights on your income. This is the highest audit risk state. ${result.usCitizenLayer ? "US citizenship adds worldwide taxation on top." : ""} Immediate action needed: establish formal residency in one country.`,
    stats: [
      { label: "Risk state",                   value: "RED — undefined / high audit risk", highlight: true },
      { label: "Countries potentially claiming", value: formatList(result.countriesClaiming), highlight: true },
      { label: "US citizen layer",               value: result.usCitizenLayer ? "YES — worldwide taxation" : "No",       highlight: result.usCitizenLayer },
    ],
    consequences: [
      `🔒 Undefined residency: you are moving frequently between countries with no clear tax home established. Prior country ${result.priorResidency !== "none" ? "(" + (COUNTRY_LABEL[result.priorResidency] || result.priorResidency) + ") " : ""}may still claim you. Current-year countries of presence may assert source rules. ${result.usCitizenLayer ? "US citizenship means US worldwide taxation continues regardless." : ""}`,
      "Why this is the highest audit risk state: (a) no country defends your position; (b) each claiming country sees unfiled obligations; (c) source-country withholding still applies on income regardless of residency; (d) treaty relief requires a RESIDENT position in one country to anchor the treaty — with no anchor, no treaty relief.",
      "The 'perpetual traveller' idea is a planning concept, not a compliance shortcut. Most people who claim this state have unfiled liabilities in their prior country + new source-country exposures + sometimes US citizenship-based tax on top. The gap between theory and enforcement is where penalties accumulate.",
      "Urgent action sequence: (1) engage a cross-border tax advisor this month; (2) clarify prior-country position — file any outstanding returns, claim split-year or non-residence where applicable; (3) establish formal residency in ONE country of choice — permanent home, tax ID, filing, documentation; (4) sever ties with prior country formally; (5) begin filing normally from the establishment date forward.",
      result.usCitizenLayer ? "⚠ US citizen layer intensifies this state. The US filing obligation does not pause during nomadic movement. Form 1040 + 2555 + 1116 + FBAR are all potentially required annually regardless of other residency. Missing years accumulate into $10,000+ per-year penalty exposure on FBAR alone." : "",
      "Documentation build NOW: day-counts per country with flight records, proof of lodging (even short-term), bank records, employment/client records. This documentation supports ANY residency position you later adopt — and is very hard to reconstruct after the fact.",
      "Route to country-specific engines below — but do not wait for engine outputs before engaging a cross-border advisor. RED state requires professional resolution.",
    ].filter(c => c !== ""),
    confidence: "LOW",
    confidenceNote: "Undefined residency is a high-risk and evidence-heavy state. Self-service classification gives the direction; resolution requires professional cross-border advice.",
    tier: 147,
    ctaLabel: "Get My Urgent Residency Plan — $147 →",
    altTierLabel: "Just want the risk classification? — $67 instead",
    productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
    result,
  };
}

type Q = {
  id: string;
  step: number;
  type: "button_group" | "two_button";
  label: string;
  subLabel?: string;
  options: { label: string; value: string | boolean; subLabel?: string }[];
  showIf?: (a: AnswerMap) => boolean;
  required?: boolean;
};

const QUESTIONS: Q[] = [
  {
    id: "prior_residency", step: 1, type: "button_group",
    label: "Where were you tax resident 12 months ago?",
    subLabel: "Where you last filed or were formally claimed as resident. Prior country often continues to claim until formally severed.",
    options: [
      { label: "UK (British / UK tax resident)",        value: "uk",    subLabel: "UK SRT applies — leaving does not auto-end" },
      { label: "Australia",                               value: "au",    subLabel: "AU resides + domicile test — hard to exit" },
      { label: "New Zealand",                              value: "nz",    subLabel: "183-day + permanent place of abode test" },
      { label: "Canada",                                    value: "ca",    subLabel: "Factual residence based on ties" },
      { label: "United States",                            value: "us",    subLabel: "SPT + citizenship-based (worldwide) taxation" },
      { label: "Other / multiple countries",                value: "other", subLabel: "Specify in tier 2 advisor brief" },
      { label: "Never been formally tax resident anywhere", value: "none",  subLabel: "Rare — usually means prior country still claims" },
    ],
    required: true,
  },
  {
    id: "current_countries", step: 2, type: "button_group",
    label: "Which country have you spent the most time in last 12 months?",
    subLabel: "Primary country of presence. If constantly moving between several, select the 'no fixed base' option.",
    options: [
      { label: "UK (60+ days)",                           value: "uk",     subLabel: "UK ties can trigger SRT at low day counts" },
      { label: "Australia (183+ days or ties)",            value: "au",     subLabel: "AU statutory test threshold" },
      { label: "New Zealand (183+ days)",                  value: "nz",     subLabel: "NZ statutory test" },
      { label: "Canada (183+ days)",                        value: "ca",     subLabel: "CA deeming rule threshold" },
      { label: "United States (substantial presence)",     value: "us",     subLabel: "Weighted day count — SPT" },
      { label: "Other country",                              value: "other",  subLabel: "Single country outside UK/AU/NZ/CA/US" },
      { label: "Constantly moving — no fixed base",          value: "moving", subLabel: "Nomadic — high RED-state risk" },
    ],
    required: true,
  },
  {
    id: "has_permanent_home", step: 3, type: "button_group",
    label: "Do you have a permanent home available to you anywhere?",
    subLabel: "OECD Article 4 tie-breaker starts with 'permanent home'. A permanent home is continuously available to you — not a hotel or short-term Airbnb.",
    options: [
      { label: "Yes — one country",                      value: "one",     subLabel: "Strong tie to that country" },
      { label: "Yes — homes in multiple countries",       value: "multi",   subLabel: "Dual residency risk — vital interests test next" },
      { label: "No — I live nomadically (hotels/Airbnb)",  value: "none",   subLabel: "RED state trigger — no permanent home" },
      { label: "Uncertain",                                  value: "unsure", subLabel: "Verify with advisor" },
    ],
    required: true,
  },
  {
    id: "work_type", step: 4, type: "button_group",
    label: "Work and income type?",
    subLabel: "Determines source-country rules and potential permanent establishment exposure.",
    options: [
      { label: "Employee of company in one country",          value: "employee",    subLabel: "Clearer source rules" },
      { label: "Self-employed / freelancer",                    value: "freelance",  subLabel: "Potentially source-country taxable where work performed" },
      { label: "Business owner (company registered somewhere)", value: "business",    subLabel: "PE risk + corporate residency overlay" },
      { label: "Investment income only",                          value: "investment", subLabel: "Source rules on investment income vary" },
      { label: "Multiple income types across countries",          value: "mixed",       subLabel: "Complex — specialist advice" },
    ],
    required: true,
  },
  {
    id: "citizenship", step: 5, type: "button_group",
    label: "Citizenship?",
    subLabel: "US citizens and green card holders face worldwide taxation regardless of where they live.",
    options: [
      { label: "Single citizenship (non-US)",           value: "non_us",        subLabel: "Standard residency-based taxation" },
      { label: "US citizen or green card holder",         value: "us",            subLabel: "WORLDWIDE taxation — always adds US layer" },
      { label: "Multiple citizenships (non-US)",          value: "multi_non_us", subLabel: "More residency options but same residency rules" },
      { label: "UK citizen",                                value: "uk",            subLabel: "UK citizenship-neutral for residency; SRT applies" },
      { label: "Australian citizen",                         value: "au",            subLabel: "AU citizenship-neutral for residency; resides test applies" },
    ],
    required: true,
  },
];

const TOTAL_STEPS = 5;

function VerdictBlock({ verdict, onCheckout, loading }: {
  verdict: VerdictResult;
  onCheckout: (t: Tier) => void;
  loading: boolean;
}) {
  const result = verdict.result;

  return (
    <div className={`scroll-mt-4 rounded-2xl border p-5 sm:p-6 ${verdict.panelClass}`}>
      <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>{verdict.status}</p>
      <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{verdict.headline}</h3>

      {/* Three risk-state visual panels — always visible */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <div className={`rounded-xl border-2 px-3 py-3 ${result.riskState === "GREEN" ? "border-emerald-400 bg-emerald-50" : "border-neutral-200 bg-neutral-50 opacity-60"}`}>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-emerald-700">GREEN — Single residency</p>
          <p className="text-xs text-neutral-800">One country clearly claims. Stable ties. Tax outcome predictable. Route to that country&apos;s engine.</p>
        </div>
        <div className={`rounded-xl border-2 px-3 py-3 ${result.riskState === "YELLOW" ? "border-amber-400 bg-amber-50" : "border-neutral-200 bg-neutral-50 opacity-60"}`}>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700">YELLOW — Dual residency</p>
          <p className="text-xs text-neutral-800">Two countries can claim. Treaty tie-breaker (Article 4) resolves. Must actively claim treaty position.</p>
        </div>
        <div className={`rounded-xl border-2 px-3 py-3 ${result.riskState === "RED" ? "border-red-400 bg-red-50" : "border-neutral-200 bg-neutral-50 opacity-60"}`}>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-700">RED — Undefined</p>
          <p className="text-xs text-neutral-800">No clear tax home. Multiple countries may claim. Highest audit risk state. Immediate action needed.</p>
        </div>
      </div>

      {/* OECD Article 4 banner */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Legal anchor — OECD Model Tax Convention Article 4</p>
        <div className="space-y-1 text-neutral-800">
          <p><strong>Tie-breaker sequence:</strong> permanent home → centre of vital interests → habitual abode → nationality → mutual agreement</p>
          <p><strong>Treaty relief is NOT automatic</strong> — must be claimed with documentation on each country&apos;s tax return.</p>
          <p><strong>No treaty between claiming countries:</strong> no automatic double-tax relief mechanism.</p>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* US citizen flag — prominent when applies */}
      {result.usCitizenLayer && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ US citizen / green card holder — worldwide taxation layer</p>
          <p className="text-red-900 leading-relaxed">
            US citizens are taxed on worldwide income regardless of where they live (IRC §§1, 61). FEIE (§911) may exclude limited foreign earned income, and foreign tax credits (IRC §901) offset foreign tax paid — but filing a US return is ALWAYS required. Form 1040 + Form 2555 + Form 1116 + FBAR if foreign accounts exceed $10,000. Renunciation is the only permanent exit, triggering exit tax under IRC §877A for covered expatriates.
          </p>
        </div>
      )}

      {/* Flags */}
      {result.flags.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-amber-700">⚠ Specific considerations for your situation</p>
          <ul className="space-y-1.5 text-xs text-amber-900">
            {result.flags.map((f, i) => <li key={i}>→ {f}</li>)}
          </ul>
        </div>
      )}

      {/* Routing destinations — always visible */}
      {result.routes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">→ Route to country-specific engines</p>
          <div className="space-y-2">
            {result.routes.map((r, i) => (
              <a key={i} href={r.href} className="block rounded-lg border border-emerald-300 bg-white px-3 py-2 hover:border-emerald-500 transition">
                <p className="text-sm font-semibold text-neutral-950">{r.label}</p>
                <p className="text-xs text-neutral-600 mt-0.5">{r.note}</p>
              </a>
            ))}
          </div>
          <p className="mt-2 text-xs text-emerald-800">Each country engine resolves the in-country position. YELLOW / RED states additionally need cross-border professional advice.</p>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
        <strong className="text-neutral-950">What this means:</strong>
        <ul className="mt-1.5 space-y-1 text-xs text-neutral-700">
          {verdict.consequences.map((c, i) => <li key={i}>→ {c}</li>)}
        </ul>
      </div>

      <div className={`mb-4 rounded-xl border px-4 py-2 text-xs ${
        verdict.confidence === "HIGH" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : verdict.confidence === "MEDIUM" ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-800"
      }`}>
        <strong>Confidence: {verdict.confidence}</strong> — {verdict.confidenceNote}
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-sm text-neutral-800 leading-relaxed">
          <strong className="text-neutral-950">This is a routing engine.</strong> It classifies your residency risk state and routes to country-specific engines for the full in-country analysis. YELLOW / RED state resolution requires a cross-border tax advisor — not a calculator.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your residency risk classification (GREEN / YELLOW / RED)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Country-by-country residency test summary (UK SRT / AU / NZ / CA / US)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Filing obligations checklist per jurisdiction</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Treaty applicability + tie-breaker guidance</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>US citizen layer analysis (if applies)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 cross-border accountant questions</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your specific residency risk state</p>
      <p className="mt-2 text-center">
        <button onClick={() => onCheckout(verdict.tier === 67 ? 147 : 67)} disabled={loading}
          className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
          {verdict.altTierLabel}
        </button>
      </p>
    </div>
  );
}

function QuestionBlock({ q, value, onAnswer }: {
  q: Q;
  value: AnswerMap[string];
  onAnswer: (id: string, v: string | boolean) => void;
}) {
  const sel = (v: string | boolean) => value === v;
  const base = "rounded-xl border px-4 py-3 text-left transition";
  const active = "border-neutral-950 bg-neutral-950 text-white";
  const inactive = "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400";

  return (
    <div>
      <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">{q.label}</h2>
      {q.subLabel && <p className="mb-4 text-sm text-neutral-500">{q.subLabel}</p>}

      {q.type === "two_button" ? (
        <div className="grid grid-cols-2 gap-3">
          {q.options.map(opt => (
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value as string | boolean)}
              className={`rounded-xl border px-4 py-3 text-center text-sm font-medium transition ${sel(opt.value as string | boolean) ? active : inactive}`}>
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map(opt => (
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value as string)}
              className={`${base} ${sel(opt.value as string) ? active : inactive}`}>
              <span className="block text-sm font-medium">{opt.label}</span>
              {opt.subLabel && <span className={`mt-0.5 block text-xs ${sel(opt.value as string) ? "text-neutral-300" : "text-neutral-500"}`}>{opt.subLabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NomadResidencyCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(147);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ advisor_role: "", urgency: "", accountant: "" });
  const [email, setEmail]           = useState("");
  const [emailSent, setEmailSent]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [sessionId, setSessionId]   = useState<string | null>(null);
  const verdictRef                  = useRef<HTMLDivElement>(null);

  const verdict = useMemo(() => showVerdict ? calcVerdict(answers) : null, [showVerdict, answers]);
  const visibleQs = QUESTIONS.filter(q => q.step === step && (!q.showIf || q.showIf(answers)));
  const stepComplete = !visibleQs.length || visibleQs.filter(q => q.required !== false).every(q => answers[q.id] !== undefined && answers[q.id] !== "");
  const popupComplete = Object.values(popupAnswers).every(v => v !== "");
  const maxStep = TOTAL_STEPS;

  useEffect(() => {
    if (!stepComplete) return;
    const t = setTimeout(() => {
      const next = step + 1;
      if (next <= TOTAL_STEPS) setStep(next);
      else setVerdict(true);
    }, visibleQs.length ? 300 : 0);
    return () => clearTimeout(t);
  }, [stepComplete, step, visibleQs.length]);

  useEffect(() => {
    if (showVerdict && verdictRef.current)
      setTimeout(() => verdictRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [showVerdict]);

  useEffect(() => {
    document.body.style.overflow = showPopup ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showPopup]);

  useEffect(() => {
    if (!showVerdict || !verdict) return;
    fetch("/api/decision-sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_slug: "residency-risk-index",
        source_path: "/nomad",
        country_code: "GLOBAL", currency_code: "USD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          risk_state: verdict.result.riskState,
          countries_claiming: verdict.result.countriesClaiming,
          us_citizen_layer: verdict.result.usCitizenLayer,
          routes: verdict.result.routes.map(r => r.href),
          tier: verdict.tier,
        },
        recommended_tier: verdict.tier,
      }),
    }).then(r => r.json()).then(d => { if (d.id) setSessionId(d.id); }).catch(() => {});
  }, [showVerdict]);

  function answer(id: string, v: string | boolean) {
    setAnswers(p => ({ ...p, [id]: v }));
  }

  function back() {
    if (showVerdict) { setVerdict(false); return; }
    if (step > 1) setStep(s => s - 1);
  }

  async function handleSaveEmail() {
    if (!email) return;
    await fetch("/api/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "residency_risk_index", country_code: "GLOBAL", site: "taxchecknow" }),
    }).catch(() => {});
    setEmailSent(true);
  }

  function openPopup(tier: Tier) {
    setPopupTier(tier);
    setShowQ(false);
    setShowPopup(true);
    setError("");
  }

  async function handleCheckout() {
    if (loading || !verdict) return;
    setLoading(true); setError("");
    const sid = sessionId || `nomad_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("residency-risk-index_prior_residency", String(answers.prior_residency || ""));
    sessionStorage.setItem("residency-risk-index_current_countries", String(answers.current_countries || ""));
    sessionStorage.setItem("residency-risk-index_has_permanent_home", String(answers.has_permanent_home || ""));
    sessionStorage.setItem("residency-risk-index_work_type", String(answers.work_type || ""));
    sessionStorage.setItem("residency-risk-index_citizenship", String(answers.citizenship || ""));
    sessionStorage.setItem("residency-risk-index_risk_state", verdict.result.riskState);
    sessionStorage.setItem("residency-risk-index_countries_claiming", verdict.result.countriesClaiming.join(","));
    sessionStorage.setItem("residency-risk-index_us_citizen_layer", String(verdict.result.usCitizenLayer));
    sessionStorage.setItem("residency-risk-index_status", verdict.status);
    sessionStorage.setItem("residency-risk-index_tier", String(popupTier));

    if (sessionId) {
      fetch("/api/decision-sessions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, tier_intended: popupTier, product_key: key, questionnaire_payload: popupAnswers, email: email || undefined }),
      }).catch(() => {});
    }

    try {
      const successPath = popupTier === 67 ? "assess" : "plan";
      const res = await fetch("/api/create-checkout-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision_session_id: sid, tier: popupTier, product_key: key,
          success_url: `${window.location.origin}/nomad/success/${successPath}`,
          cancel_url: `${window.location.origin}/nomad`,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { setError(data.error || "Checkout failed."); setLoading(false); }
    } catch {
      setError("Checkout failed — please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        {!showVerdict && visibleQs.length > 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">Step {step} of {maxStep}</p>
              {step > 1 && <button onClick={back} className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← Back</button>}
            </div>
            <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full bg-neutral-950 transition-all duration-300" style={{ width: `${((step - 1) / maxStep) * 100}%` }} />
            </div>
            <div className="space-y-6">
              {visibleQs.map(q => <QuestionBlock key={q.id} q={q} value={answers[q.id] as string | boolean} onAnswer={answer} />)}
            </div>
          </div>
        )}

        {showVerdict && verdict && (
          <div ref={verdictRef} className="space-y-4">
            <button onClick={back} className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← Change my answers</button>
            <VerdictBlock verdict={verdict} onCheckout={openPopup} loading={loading} />
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your residency risk report for your cross-border advisor.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your risk classification + routing by email — free.</p>
              {!emailSent ? (
                <div className="flex gap-2">
                  <input type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)}
                    className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                  <button onClick={handleSaveEmail} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">Save</button>
                </div>
              ) : <p className="text-sm font-semibold text-emerald-700">✓ Saved — check your inbox.</p>}
            </div>
          </div>
        )}
      </div>

      {showPopup && verdict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl my-auto">
            <div className="rounded-t-2xl bg-neutral-950 px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass.replace("700","400")}`}>{verdict.status}</p>
                  <p className="mt-1 font-serif text-xl font-bold text-white">
                    {popupTier === 67 ? "Your Global Residency Risk Report" : "Your Global Tax Residency System"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">OECD Model Article 4 · Multi-jurisdiction · April 2026</p>
                </div>
                <button onClick={() => { setShowPopup(false); setShowQ(false); }}
                  className="rounded-lg bg-white/10 px-2 py-1 font-mono text-xs text-neutral-300 hover:bg-white/20 transition">✕ close</button>
              </div>
            </div>
            <div className="px-6 pt-5">
              {!showQuestions ? (
                <>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">What you get</p>
                    <p className="text-sm font-bold text-neutral-950 mb-2">
                      {popupTier === 67 ? "Global Residency Risk Report™" : "Global Tax Residency System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your GREEN / YELLOW / RED classification, country-by-country residency test summary, filing obligations, treaty applicability guide, and 5 cross-border accountant questions — built around your specific residency profile."
                        : "Full strategy: risk classification + treaty tie-breaker analysis + multi-country planning sequence + audit-ready documentation pack + US citizen layer analysis (if applies) + cross-border accountant coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic nomad advice. Your specific risk state + routing.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Risk Report →" : "Get My Full Residency System →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the risk report? — $67 instead" : "Want the full treaty system? — $147 instead"}
                    </button>
                  </p>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">3 quick questions then pay</p>
                    <p className="font-serif text-lg font-bold text-neutral-950">${popupTier}</p>
                  </div>
                  {[
                    { label: "Your role", key: "advisor_role", options: [["nomad","Nomadic worker"],["expat","Expat / relocating"],["remote_worker","Remote worker"],["advisor","Cross-border advisor / accountant"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["unfiled_exposure","Unfiled returns / tax authority contact"],["moving_soon","Moving countries in next 90 days"],["planning","Planning next move"]] },
                    { label: "Do you have a cross-border tax advisor?", key: "accountant", options: [["cross_border","Yes — cross-border specialist"],["single_country","Yes — single-country advisor"],["diy","Self-managed"],["none","No — need one"]] },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">{field.label}</label>
                      <select value={popupAnswers[field.key as keyof PopupAnswers]}
                        onChange={e => setPopupA(p => ({ ...p, [field.key]: e.target.value }))}
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400">
                        <option value="">Select…</option>
                        {field.options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                      </select>
                    </div>
                  ))}
                  <button onClick={handleCheckout} disabled={!popupComplete || loading}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50">
                    {loading ? "Redirecting to Stripe…" : `Pay $${popupTier} →`}
                  </button>
                  {error && <p className="text-sm font-medium text-red-700">{error}</p>}
                </div>
              )}
              <button onClick={() => { setShowPopup(false); setShowQ(false); }}
                className="mt-3 w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-500 hover:bg-neutral-50 transition">
                Not now — keep reading
              </button>
            </div>
            <div className="px-6 pb-5 pt-2">
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · OECD Article 4 referenced content</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && (verdict.result.riskState === "RED" || verdict.result.usCitizenLayer) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">{verdict.result.riskState === "RED" ? "RED — urgent" : "US citizen layer"}</p>
              <p className="text-sm font-bold text-neutral-950">
                {verdict.result.riskState === "RED" ? "Establish residency + file outstanding returns" : "US worldwide taxation — always file US returns"}
              </p>
            </div>
            <button onClick={() => openPopup(verdict.tier)}
              className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white whitespace-nowrap">
              From $67 →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
