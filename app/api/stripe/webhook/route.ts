import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendDeliveryEmail } from "@/lib/cole-email";

// ── PRODUCT DELIVERY MAP — all 25 TaxCheckNow + 5 SuperTaxCheck ─────────────
const DELIVERY_MAP: Record<string, {
  subject: string;
  productName: string;
  driveUrl: string;
  tierLabel: string;
  market: string;
  authority: string;
  productId: string;
}> = {
  // ── UK ────────────────────────────────────────────────────────────────────
  "uk_67_mtd_scorecard":            { subject: "Your MTD Compliance Assessment — TaxCheckNow",           productName: "Your MTD Compliance Assessment",           driveUrl: "",                                                       tierLabel: "£67",  market: "United Kingdom", authority: "HMRC", productId: "mtd-scorecard" },
  "uk_147_mtd_scorecard":           { subject: "Your MTD Action Plan — TaxCheckNow",                     productName: "Your MTD Action Plan",                     driveUrl: "",                                                       tierLabel: "£147", market: "United Kingdom", authority: "HMRC", productId: "mtd-scorecard" },
  "uk_67_allowance_sniper":         { subject: "Your Allowance Recovery Pack — TaxCheckNow",             productName: "Your Allowance Recovery Pack",             driveUrl: "",                                                       tierLabel: "£67",  market: "United Kingdom", authority: "HMRC", productId: "allowance-sniper" },
  "uk_147_allowance_sniper":        { subject: "Your Allowance Recovery System — TaxCheckNow",           productName: "Your Allowance Recovery System",           driveUrl: "",                                                       tierLabel: "£147", market: "United Kingdom", authority: "HMRC", productId: "allowance-sniper" },
  "uk_67_digital_link_auditor":     { subject: "Your Digital Link Audit Pack — TaxCheckNow",             productName: "Your Digital Link Audit Pack",             driveUrl: "",                                                       tierLabel: "£67",  market: "United Kingdom", authority: "HMRC", productId: "digital-link-auditor" },
  "uk_147_digital_link_auditor":    { subject: "Your Digital Link Control System — TaxCheckNow",         productName: "Your Digital Link Control System",         driveUrl: "",                                                       tierLabel: "£147", market: "United Kingdom", authority: "HMRC", productId: "digital-link-auditor" },
  "uk_67_side_hustle_checker":      { subject: "Your Side Hustle Tax Pack — TaxCheckNow",                productName: "Your Side Hustle Tax Pack",                driveUrl: "",                                                       tierLabel: "£67",  market: "United Kingdom", authority: "HMRC", productId: "side-hustle-checker" },
  "uk_147_side_hustle_checker":     { subject: "Your Side Hustle Tax System — TaxCheckNow",              productName: "Your Side Hustle Tax System",              driveUrl: "",                                                       tierLabel: "£147", market: "United Kingdom", authority: "HMRC", productId: "side-hustle-checker" },
  "uk_67_dividend_trap":            { subject: "Your Dividend Tax Pack — TaxCheckNow",                   productName: "Your Dividend Tax Pack",                   driveUrl: "",                                                       tierLabel: "£67",  market: "United Kingdom", authority: "HMRC", productId: "dividend-trap" },
  "uk_147_dividend_trap":           { subject: "Your Dividend Optimisation System — TaxCheckNow",        productName: "Your Dividend Optimisation System",        driveUrl: "",                                                       tierLabel: "£147", market: "United Kingdom", authority: "HMRC", productId: "dividend-trap" },
  "uk_67_pension_iht_trap":         { subject: "Your Pension IHT Exposure — TaxCheckNow",                 productName: "Your Pension IHT Decision Pack",           driveUrl: "",                                                       tierLabel: "£67",  market: "United Kingdom", authority: "HMRC", productId: "pension-iht-trap" },
  "uk_147_pension_iht_trap":        { subject: "Your Pension IHT Strategy — TaxCheckNow",                 productName: "Your Pension IHT Strategy Pack",           driveUrl: "",                                                       tierLabel: "£147", market: "United Kingdom", authority: "HMRC", productId: "pension-iht-trap" },
  // ── US ────────────────────────────────────────────────────────────────────
  "us_67_section_174_auditor":      { subject: "Your Section 174 Audit Pack — TaxCheckNow",              productName: "Your Section 174 Audit Pack",              driveUrl: "",                                                       tierLabel: "$67",  market: "United States",  authority: "IRS", productId: "section-174-auditor" },
  "us_147_section_174_auditor":     { subject: "Your Section 174 Recovery System — TaxCheckNow",         productName: "Your Section 174 Recovery System",         driveUrl: "",                                                       tierLabel: "$147", market: "United States",  authority: "IRS", productId: "section-174-auditor" },
  "us_67_feie_nomad_auditor":       { subject: "Your FEIE Audit Pack — TaxCheckNow",                     productName: "Your FEIE Audit Pack",                     driveUrl: "",                                                       tierLabel: "$67",  market: "United States",  authority: "IRS", productId: "feie-nomad-auditor" },
  "us_147_feie_nomad_auditor":      { subject: "Your FEIE Optimisation System — TaxCheckNow",            productName: "Your FEIE Optimisation System",            driveUrl: "",                                                       tierLabel: "$147", market: "United States",  authority: "IRS", productId: "feie-nomad-auditor" },
  "us_67_qsbs_exit_auditor":        { subject: "Your QSBS Eligibility Pack — TaxCheckNow",               productName: "Your QSBS Eligibility Pack",               driveUrl: "",                                                       tierLabel: "$67",  market: "United States",  authority: "IRS", productId: "qsbs-exit-auditor" },
  "us_147_qsbs_exit_auditor":       { subject: "Your Exclusion Stacker Blueprint — TaxCheckNow",         productName: "Your Exclusion Stacker Blueprint",         driveUrl: "",                                                       tierLabel: "$147", market: "United States",  authority: "IRS", productId: "qsbs-exit-auditor" },
  "us_67_iso_amt_sniper":           { subject: "Your Zero-AMT Exercise Map — TaxCheckNow",               productName: "Your Zero-AMT Exercise Map",               driveUrl: "",                                                       tierLabel: "$67",  market: "United States",  authority: "IRS", productId: "iso-amt-sniper" },
  "us_147_iso_amt_sniper":          { subject: "Your ISO Exercise System — TaxCheckNow",                 productName: "Your ISO Exercise System",                 driveUrl: "",                                                       tierLabel: "$147", market: "United States",  authority: "IRS", productId: "iso-amt-sniper" },
  "us_67_wayfair_nexus_sniper":     { subject: "Your Nexus Exposure Pack — TaxCheckNow",                 productName: "Your Nexus Exposure Pack",                 driveUrl: "",                                                       tierLabel: "$67",  market: "United States",  authority: "IRS", productId: "wayfair-nexus-sniper" },
  "us_147_wayfair_nexus_sniper":    { subject: "Your Nexus Compliance System — TaxCheckNow",             productName: "Your Nexus Compliance System",             driveUrl: "",                                                       tierLabel: "$147", market: "United States",  authority: "IRS", productId: "wayfair-nexus-sniper" },
  // ── NZ ────────────────────────────────────────────────────────────────────
  "nz_67_bright_line_auditor":      { subject: "Your Main Home Proof Kit — TaxCheckNow",                 productName: "Your Main Home Proof Kit",                 driveUrl: "",                                                       tierLabel: "$67",  market: "New Zealand",    authority: "IRD", productId: "bright-line-auditor" },
  "nz_147_bright_line_auditor":     { subject: "Your Bright-Line Shield System — TaxCheckNow",           productName: "Your Bright-Line Shield System",           driveUrl: "",                                                       tierLabel: "$147", market: "New Zealand",    authority: "IRD", productId: "bright-line-auditor" },
  "nz_67_app_tax_gst_sniper":       { subject: "Your GST Registration Logic Pack — TaxCheckNow",         productName: "Your GST Registration Logic Pack",         driveUrl: "",                                                       tierLabel: "$67",  market: "New Zealand",    authority: "IRD", productId: "app-tax-gst-sniper" },
  "nz_147_app_tax_gst_sniper":      { subject: "Your GST Compliance System — TaxCheckNow",               productName: "Your GST Compliance System",               driveUrl: "",                                                       tierLabel: "$147", market: "New Zealand",    authority: "IRD", productId: "app-tax-gst-sniper" },
  "nz_67_interest_reinstatement_engine": { subject: "Your Interest Reinstatement Pack — TaxCheckNow",   productName: "Your Interest Reinstatement Pack",         driveUrl: "",                                                       tierLabel: "$67",  market: "New Zealand",    authority: "IRD", productId: "interest-reinstatement-engine" },
  "nz_147_interest_reinstatement_engine": { subject: "Your Interest Reinstatement System — TaxCheckNow", productName: "Your Interest Reinstatement System",      driveUrl: "",                                                       tierLabel: "$147", market: "New Zealand",    authority: "IRD", productId: "interest-reinstatement-engine" },
  "nz_67_trust_tax_splitter":       { subject: "Your Beneficiary Distribution Pack — TaxCheckNow",       productName: "Your Beneficiary Distribution Pack",       driveUrl: "",                                                       tierLabel: "$67",  market: "New Zealand",    authority: "IRD", productId: "trust-tax-splitter" },
  "nz_147_trust_tax_splitter":      { subject: "Your Trust Tax Optimisation System — TaxCheckNow",       productName: "Your Trust Tax Optimisation System",       driveUrl: "",                                                       tierLabel: "$147", market: "New Zealand",    authority: "IRD", productId: "trust-tax-splitter" },
  "nz_67_investment_boost_auditor": { subject: "Your New to NZ Asset Log — TaxCheckNow",                 productName: "Your New to NZ Asset Log",                 driveUrl: "",                                                       tierLabel: "$67",  market: "New Zealand",    authority: "IRD", productId: "investment-boost-auditor" },
  "nz_147_investment_boost_auditor": { subject: "Your Investment Boost Compliance System — TaxCheckNow", productName: "Your Investment Boost Compliance System",  driveUrl: "",                                                       tierLabel: "$147", market: "New Zealand",    authority: "IRD", productId: "investment-boost-auditor" },
  // ── NOMAD (global cross-border residency) ───────────────────────────────────
  "nomad_67_residency_risk_index":  { subject: "Your Global Tax Risk Report — TaxCheckNow",             productName: "Your Global Residency Risk Report",        driveUrl: "",                                                       tierLabel: "$67",  market: "Global",         authority: "OECD", productId: "residency-risk-index" },
  "nomad_147_residency_risk_index": { subject: "Your Global Tax Residency System — TaxCheckNow",       productName: "Your Global Tax Residency System",         driveUrl: "",                                                       tierLabel: "$147", market: "Global",         authority: "OECD", productId: "residency-risk-index" },
  "nomad_67_tax_treaty_navigator":  { subject: "Your Treaty Decision Pack — TaxCheckNow",              productName: "Your Treaty Decision Pack",                driveUrl: "",                                                       tierLabel: "$67",  market: "Global",         authority: "OECD", productId: "tax-treaty-navigator" },
  "nomad_147_tax_treaty_navigator": { subject: "Your Global Tax Residency System — TaxCheckNow",       productName: "Your Global Tax Residency System",         driveUrl: "",                                                       tierLabel: "$147", market: "Global",         authority: "OECD", productId: "tax-treaty-navigator" },
  "nomad_67_183_day_rule":          { subject: "Your 183-Day Residency Reality Check — TaxCheckNow",  productName: "Your 183-Day Residency Check",             driveUrl: "",                                                       tierLabel: "$67",  market: "Global",         authority: "OECD", productId: "183-day-rule" },
  "nomad_147_183_day_rule":         { subject: "Your Global Residency Strategy — TaxCheckNow",         productName: "Your Global Residency Strategy",           driveUrl: "",                                                       tierLabel: "$147", market: "Global",         authority: "OECD", productId: "183-day-rule" },
  "nomad_67_exit_tax_trap":         { subject: "Your Exit Tax Risk Report — TaxCheckNow",              productName: "Your Exit Tax Risk Report",                driveUrl: "",                                                       tierLabel: "$67",  market: "Global",         authority: "OECD", productId: "exit-tax-trap" },
  "nomad_147_exit_tax_trap":        { subject: "Your Exit Tax Strategy — TaxCheckNow",                 productName: "Your Exit Tax Strategy",                   driveUrl: "",                                                       tierLabel: "$147", market: "Global",         authority: "OECD", productId: "exit-tax-trap" },
  "nomad_67_uk_residency":          { subject: "Your UK Residency Decision Pack — TaxCheckNow",        productName: "Your UK Residency Decision Pack",          driveUrl: "",                                                       tierLabel: "£67",  market: "United Kingdom", authority: "HMRC", productId: "uk-residency" },
  "nomad_147_uk_residency":         { subject: "Your UK Residency Strategy — TaxCheckNow",             productName: "Your UK Residency Strategy System",        driveUrl: "",                                                       tierLabel: "£147", market: "United Kingdom", authority: "HMRC", productId: "uk-residency" },
  // ── AU ────────────────────────────────────────────────────────────────────
  "au_67_cgt_main_residence_trap":         { subject: "Your CGT Exposure Plan — TaxCheckNow",                    productName: "Your CGT Exposure Plan",                    driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_CGT_MR_67 || "",    tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "cgt-main-residence-trap" },
  "au_147_cgt_main_residence_trap":        { subject: "Your Main Residence Shield System — TaxCheckNow",         productName: "Your Main Residence Shield System",         driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_CGT_MR_147 || "",   tierLabel: "$147", market: "Australia", authority: "ATO", productId: "cgt-main-residence-trap" },
  "au_67_division_7a_loan_trap":           { subject: "Your Division 7A Rescue Plan — TaxCheckNow",              productName: "Your Division 7A Rescue Plan",              driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_DIV7A_67 || "",     tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "division-7a-loan-trap" },
  "au_147_division_7a_loan_trap":          { subject: "Your Director Loan Shield System — TaxCheckNow",          productName: "Your Director Loan Shield System",          driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_DIV7A_147 || "",    tierLabel: "$147", market: "Australia", authority: "ATO", productId: "division-7a-loan-trap" },
  "au_67_fbt_hidden_exposure":             { subject: "Your FBT Exposure Fix Plan — TaxCheckNow",                productName: "Your FBT Exposure Fix Plan",                driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_FBT_67 || "",       tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "fbt-hidden-exposure" },
  "au_147_fbt_hidden_exposure":            { subject: "Your FBT Control System — TaxCheckNow",                   productName: "Your FBT Control System",                   driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_FBT_147 || "",      tierLabel: "$147", market: "Australia", authority: "ATO", productId: "fbt-hidden-exposure" },
  "au_67_cgt_discount_timing_sniper":      { subject: "Your CGT Timing Fix Plan — TaxCheckNow",                  productName: "Your CGT Timing Fix Plan",                  driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_CGT_DT_67 || "",    tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "cgt-discount-timing-sniper" },
  "au_147_cgt_discount_timing_sniper":     { subject: "Your CGT Exit Timing System — TaxCheckNow",               productName: "Your CGT Exit Timing System",               driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_CGT_DT_147 || "",   tierLabel: "$147", market: "Australia", authority: "ATO", productId: "cgt-discount-timing-sniper" },
  "au_67_negative_gearing_illusion":       { subject: "Your Negative Gearing Reality Plan — TaxCheckNow",        productName: "Your Negative Gearing Reality Plan",        driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_NG_67 || "",         tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "negative-gearing-illusion" },
  "au_147_negative_gearing_illusion":      { subject: "Your Property Cashflow Control System — TaxCheckNow",     productName: "Your Property Cashflow Control System",     driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_NG_147 || "",        tierLabel: "$147", market: "Australia", authority: "ATO", productId: "negative-gearing-illusion" },
  "au_67_small_business_cgt_concessions":  { subject: "Your CGT Concession Eligibility Memo — TaxCheckNow",      productName: "Your CGT Concession Eligibility Memo",      driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_SBCGT_67 || "",      tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "small-business-cgt-concessions" },
  "au_147_small_business_cgt_concessions": { subject: "Your Exit Concession Blueprint — TaxCheckNow",            productName: "Your Exit Concession Blueprint",            driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_SBCGT_147 || "",     tierLabel: "$147", market: "Australia", authority: "ATO", productId: "small-business-cgt-concessions" },
  "au_67_instant_asset_write_off":         { subject: "Your EOFY Asset Deadline Plan — TaxCheckNow",             productName: "Your EOFY Asset Deadline Plan",             driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_IAWO_67 || "",       tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "instant-asset-write-off" },
  "au_147_instant_asset_write_off":        { subject: "Your Asset Timing & Depreciation System — TaxCheckNow",   productName: "Your Asset Timing & Depreciation System",   driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_IAWO_147 || "",      tierLabel: "$147", market: "Australia", authority: "ATO", productId: "instant-asset-write-off" },
  "au_67_gst_registration_trap":           { subject: "Your GST Catch-Up Plan — TaxCheckNow",                    productName: "Your GST Catch-Up Plan",                    driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_GST_67 || "",        tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "gst-registration-trap" },
  "au_147_gst_registration_trap":          { subject: "Your GST Compliance Launch System — TaxCheckNow",         productName: "Your GST Compliance Launch System",         driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_GST_147 || "",       tierLabel: "$147", market: "Australia", authority: "ATO", productId: "gst-registration-trap" },
  "au_67_rental_property_deduction_audit": { subject: "Your Rental Deduction Repair Pack — TaxCheckNow",         productName: "Your Rental Deduction Repair Pack",         driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_RENTAL_67 || "",     tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "rental-property-deduction-audit" },
  "au_147_rental_property_deduction_audit":{ subject: "Your ATO Audit-Ready Rental System — TaxCheckNow",        productName: "Your ATO Audit-Ready Rental System",        driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_RENTAL_147 || "",    tierLabel: "$147", market: "Australia", authority: "ATO", productId: "rental-property-deduction-audit" },
  "au_67_medicare_levy_surcharge_trap":    { subject: "Your MLS Avoidance Plan — TaxCheckNow",                   productName: "Your MLS Avoidance Plan",                   driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_MLS_67 || "",        tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "medicare-levy-surcharge-trap" },
  "au_147_medicare_levy_surcharge_trap":   { subject: "Your Income & Insurance Optimisation System — TaxCheckNow", productName: "Your Income & Insurance Optimisation System", driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_MLS_147 || "",    tierLabel: "$147", market: "Australia", authority: "ATO", productId: "medicare-levy-surcharge-trap" },
  "au_67_bring_forward_window":            { subject: "Your June 30 Decision Pack — TaxCheckNow",                productName: "Your June 30 Decision Pack",                driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_BFW_67 || "",        tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "bring-forward-window" },
  "au_147_bring_forward_window":           { subject: "Your June 30 Execution Plan — TaxCheckNow",               productName: "Your June 30 Execution Plan",               driveUrl: process.env.NEXT_PUBLIC_DRIVE_AU_BFW_147 || "",       tierLabel: "$147", market: "Australia", authority: "ATO", productId: "bring-forward-window" },
  "au_67_super_death_tax_trap":  { subject: "Your Super Death Tax Report — TaxCheckNow", productName: "Your Super Death Tax Report", driveUrl: "", tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "super-death-tax-trap" },
  "au_147_super_death_tax_trap": { subject: "Your Super Death Tax Execution Plan — TaxCheckNow", productName: "Your Super Death Tax Execution Plan", driveUrl: "", tierLabel: "$147", market: "Australia", authority: "ATO", productId: "super-death-tax-trap" },
  "au_67_div296_wealth_eraser":  { subject: "Your Div 296 Decision Pack — TaxCheckNow", productName: "Your Div 296 Decision Pack", driveUrl: "", tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "div296-wealth-eraser" },
  "au_147_div296_wealth_eraser": { subject: "Your Div 296 Execution Pack — TaxCheckNow", productName: "Your Div 296 Execution Pack", driveUrl: "", tierLabel: "$147", market: "Australia", authority: "ATO", productId: "div296-wealth-eraser" },
  "au_67_super_to_trust_exit":   { subject: "Your Exit Break-Even Pack — TaxCheckNow", productName: "Your Exit Break-Even Pack", driveUrl: "", tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "super-to-trust-exit" },
  "au_147_super_to_trust_exit":  { subject: "Your Full Exit Decision Model — TaxCheckNow", productName: "Your Full Exit Decision Model", driveUrl: "", tierLabel: "$147", market: "Australia", authority: "ATO", productId: "super-to-trust-exit" },
  "au_67_transfer_balance_cap":  { subject: "Your TBC Position Pack — TaxCheckNow", productName: "Your TBC Position Pack", driveUrl: "", tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "transfer-balance-cap" },
  "au_147_transfer_balance_cap": { subject: "Your Full TBC Strategy — TaxCheckNow", productName: "Your Full TBC Strategy", driveUrl: "", tierLabel: "$147", market: "Australia", authority: "ATO", productId: "transfer-balance-cap" },
  // ── SUPERTAXCHECK ─────────────────────────────────────────────────────────
  "supertax_67_div296_wealth_eraser":  { subject: "Your Div 296 Wealth Eraser — SuperTaxCheck",  productName: "Your Div 296 Wealth Eraser",  driveUrl: process.env.DRIVE_DIV296_67 || "",  tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "div296-wealth-eraser" },
  "supertax_147_div296_wealth_eraser": { subject: "Your Div 296 Strategy System — SuperTaxCheck", productName: "Your Div 296 Strategy System", driveUrl: process.env.DRIVE_DIV296_147 || "", tierLabel: "$147", market: "Australia", authority: "ATO", productId: "div296-wealth-eraser" },
};

// ── DEADLINES PER PRODUCT ────────────────────────────────────────────────────
const PRODUCT_DEADLINES: Record<string, string> = {
  "mtd-scorecard":                    "2026-08-07T00:00:00.000+01:00",
  "allowance-sniper":                 "2027-01-31T23:59:59.000+00:00",
  "digital-link-auditor":             "2026-08-07T00:00:00.000+01:00",
  "side-hustle-checker":              "2027-01-31T23:59:59.000+00:00",
  "dividend-trap":                    "2027-01-31T23:59:59.000+00:00",
  "medicare-levy-surcharge-trap":     "2026-10-31T23:59:59.000+11:00",
  "instant-asset-write-off":          "2026-06-30T23:59:59.000+10:00",
  "gst-registration-trap":            "2026-06-30T23:59:59.000+10:00",
  "cgt-main-residence-trap":          "2026-10-31T23:59:59.000+11:00",
  "cgt-discount-timing-sniper":       "2026-10-31T23:59:59.000+11:00",
  "negative-gearing-illusion":        "2026-10-31T23:59:59.000+11:00",
  "rental-property-deduction-audit":  "2026-10-31T23:59:59.000+11:00",
  "division-7a-loan-trap":            "2026-10-31T23:59:59.000+11:00",
  "fbt-hidden-exposure":              "2026-03-31T23:59:59.000+11:00",
  "small-business-cgt-concessions":   "2026-10-31T23:59:59.000+11:00",
  "bring-forward-window":             "2026-06-30T23:59:59.000+10:00",
};

const REMINDER_DAYS = [30, 7, 1];

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

// ── GENERATE + STORE ASSESSMENT ──────────────────────────────────────────────
async function generateAndStoreAssessment(
  supabase: any,
  stripeSessionId: string,
  decisionSessionId: string,
  productKey: string,
  tier: number,
  delivery: typeof DELIVERY_MAP[string],
  customerEmail: string,
  customerName: string,
): Promise<void> {
  try {
    const { data: ds } = await supabase
      .from("decision_sessions")
      .select("inputs, questionnaire_payload")
      .eq("id", decisionSessionId)
      .single() as { data: { inputs: Record<string, unknown>; questionnaire_payload: Record<string, unknown> } | null };

    const inputs = {
      ...(ds?.inputs || {}),
      ...(ds?.questionnaire_payload || {}),
    };

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://taxchecknow.com";
    const res = await fetch(`${baseUrl}/api/assess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: delivery.productId,
        market:     delivery.market,
        authority:  delivery.authority,
        tier:       tier >= 147 ? 2 : 1,
        name:       customerName,
        inputs,
        fields:     tier >= 147
          ? ["status","keyFinding","exposureAmount","mainRiskTrigger","recommendedAction","confidenceLevel","implementationPlan","scenarioAnalysis","evidenceRequired","timelineStrategy"]
          : ["status","keyFinding","exposureAmount","mainRiskTrigger","recommendedAction","confidenceLevel","firstAction"],
      }),
    });

    if (!res.ok) { console.error("[webhook] /api/assess failed:", res.status); return; }

    const { assessment } = await res.json();

    await (supabase as any).from("assessments").upsert({
      stripe_session_id:   stripeSessionId,
      decision_session_id: decisionSessionId,
      product_id:          delivery.productId,
      product_key:         productKey,
      tier,
      customer_email:      customerEmail,
      customer_name:       customerName,
      assessment_json:     assessment,
      created_at:          new Date().toISOString(),
    }, { onConflict: "stripe_session_id" });

    console.log("[webhook] Assessment stored:", stripeSessionId);
  } catch (err) {
    console.error("[webhook] Assessment failed (non-blocking):", err);
  }
}

// ── QUEUE REMINDER EMAILS ────────────────────────────────────────────────────
async function queueReminders(
  supabase: any,
  stripeSessionId: string,
  productKey: string,
  customerEmail: string,
  customerName: string,
  delivery: typeof DELIVERY_MAP[string],
): Promise<void> {
  try {
    const deadlineIso = PRODUCT_DEADLINES[delivery.productId];
    if (!deadlineIso) return;

    const deadline = new Date(deadlineIso);
    const rows = REMINDER_DAYS.map(days => {
      const trigger = new Date(deadline);
      trigger.setDate(trigger.getDate() - days);
      return {
        stripe_session_id:    stripeSessionId,
        product_key:          productKey,
        product_id:           delivery.productId,
        customer_email:       customerEmail,
        customer_name:        customerName,
        trigger_date:         trigger.toISOString().split("T")[0],
        days_before_deadline: days,
        subject:              `${days === 1 ? "Tomorrow" : `${days} days`} — ${delivery.productName}`,
        status:               "queued",
        created_at:           new Date().toISOString(),
      };
    });

    const { error } = await (supabase as any).from("email_queue").insert(rows);
    if (error) console.error("[webhook] Queue error:", error.message);
    else console.log("[webhook] Queued", rows.length, "reminders for", customerEmail);
  } catch (err) {
    console.error("[webhook] Queue failed (non-blocking):", err);
  }
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature");
  const secret    = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("[webhook] Signature failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("[webhook] Received:", event.type);
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session       = event.data.object as Stripe.Checkout.Session;
  const productKey    = session.metadata?.product_key           || "";
  const tier          = Number(session.metadata?.tier           || 0);
  const decisionSid   = session.metadata?.decision_session_id   || "";
  const customerEmail = session.customer_details?.email          || "";
  const customerName  = session.customer_details?.name           || "there";
  const amountPaid    = (session.amount_total || 0) / 100;

  console.log("[webhook] Purchase:", { productKey, tier, customerEmail });

  const delivery = DELIVERY_MAP[productKey];
  const supabase = getSupabase();

  // 1. Record purchase
  let purchaseId: string | null = null;
  try {
    const { data, error } = await supabase
      .from("purchases")
      .insert({
        stripe_session_id:     session.id,
        stripe_payment_intent: String(session.payment_intent || ""),
        decision_session_id:   decisionSid,
        product_key:           productKey,
        tier,
        amount_gbp:            amountPaid,
        currency:              session.currency || "aud",
        customer_email:        customerEmail,
        customer_name:         customerName,
        site:                  "taxchecknow",
        country_code:          delivery?.market?.slice(0,2).toUpperCase() || "AU",
        delivery_status:       "pending",
        metadata:              session.metadata,
      })
      .select("id")
      .single();

    if (error) console.error("[webhook] Purchase insert error:", error.message);
    else { purchaseId = data?.id || null; }
  } catch (err) {
    console.error("[webhook] Supabase purchase error:", err);
  }

  // 2. Generate + store assessment (non-blocking — fires and continues)
  if (delivery && decisionSid && customerEmail) {
    generateAndStoreAssessment(
      supabase, session.id, decisionSid, productKey,
      tier, delivery, customerEmail, customerName
    ).catch(() => {});
  }

  // 3. Queue reminder emails (non-blocking)
  if (delivery && customerEmail) {
    queueReminders(supabase, session.id, productKey, customerEmail, customerName, delivery)
      .catch(() => {});
  }

  // 4. Send delivery email
  if (!delivery) {
    console.error("[webhook] No delivery config for:", productKey);
    return NextResponse.json({ received: true });
  }
  if (!customerEmail) {
    console.error("[webhook] No customer email:", session.id);
    return NextResponse.json({ received: true });
  }

  const emailResult = await sendDeliveryEmail({
    to:          customerEmail,
    productName: delivery.productName,
    productKey,
    tierLabel:   delivery.tierLabel,
    driveUrl:    delivery.driveUrl,
    subject:     delivery.subject,
  });

  // 5. Log email status
  if (purchaseId) {
    try {
      const supabase2 = getSupabase();
      await (supabase2 as any).from("email_log").insert({
        purchase_id:     purchaseId,
        recipient_email: customerEmail,
        email_type:      "delivery",
        subject:         delivery.subject,
        resend_id:       emailResult.resendId || null,
        status:          emailResult.success ? "sent" : "failed",
      });
      await supabase2.from("purchases").update({
        delivery_status:  emailResult.success ? "sent" : "failed",
        delivery_sent_at: emailResult.success ? new Date().toISOString() : null,
      }).eq("id", purchaseId);
    } catch (err) {
      console.error("[webhook] Log error:", err);
    }
  }

  console.log("[webhook] Complete. Email:", emailResult.success);
  return NextResponse.json({ received: true });
}
