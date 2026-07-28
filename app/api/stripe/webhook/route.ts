import { NextResponse, after } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendDeliveryEmail } from "@/lib/cole-email";
import { getMarketContext } from "@/lib/email-context";
import { getAssessmentFields } from "@/lib/assessment-fields";
import { buildComposerInputs } from "@/lib/composer-inputs";
import { generateAssessment } from "@/lib/assess-core";
// TEMPORAL v1 Step 6.2 — the SCHEDULER's date now comes from the resolver over
// the generated declaration registry. lookupDeadline() against the
// hand-authored lib/product-deadlines.ts is RETIRED here and must not come
// back: that file is a central list maintained apart from the products it
// describes, which is how it came to hold dates that had already passed.
// (lib/email-context.ts still reads it for the delivery-email BANNER — a
// presentation concern outside Step 6's scope, flagged in the report.)
import { resolve as resolveTemporal, schedulableDate } from "@/lib/temporal-resolver";
import { lookupTemporal, lookupNurture } from "@/lib/temporal-registry";
import { nurtureEmailType } from "@/lib/nurture-types";

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
  "nomad_67_uk_nrls":               { subject: "Your NRLS Compliance Fix Plan — TaxCheckNow",           productName: "Your NRLS Compliance Fix Plan",            driveUrl: "",                                                       tierLabel: "£67",  market: "United Kingdom", authority: "HMRC", productId: "uk-nrls" },
  "nomad_147_uk_nrls":              { subject: "Your UK Rental Tax System — TaxCheckNow",               productName: "Your UK Rental Tax System",                driveUrl: "",                                                       tierLabel: "£147", market: "United Kingdom", authority: "HMRC", productId: "uk-nrls" },
  "nomad_67_au_expat_cgt":          { subject: "Your Expat CGT Risk Report — TaxCheckNow",              productName: "Your Expat CGT Risk Report",               driveUrl: "",                                                       tierLabel: "$67",  market: "Australia",      authority: "ATO",  productId: "au-expat-cgt" },
  "nomad_147_au_expat_cgt":         { subject: "Your Expat CGT Strategy — TaxCheckNow",                  productName: "Your Expat CGT Strategy System",           driveUrl: "",                                                       tierLabel: "$147", market: "Australia",      authority: "ATO",  productId: "au-expat-cgt" },
  "nomad_67_us_expat_tax":          { subject: "Your US Expat Tax Strategy Report — TaxCheckNow",        productName: "Your US Expat Tax Strategy Report",        driveUrl: "",                                                       tierLabel: "$67",  market: "United States",  authority: "IRS",  productId: "us-expat-tax" },
  "nomad_147_us_expat_tax":         { subject: "Your Global Tax Optimization System — TaxCheckNow",      productName: "Your Global Tax Optimization System",      driveUrl: "",                                                       tierLabel: "$147", market: "United States",  authority: "IRS",  productId: "us-expat-tax" },
  "nomad_67_au_smsf":               { subject: "Your SMSF Residency Fix Kit — TaxCheckNow",               productName: "Your SMSF Residency Fix Kit",              driveUrl: "",                                                       tierLabel: "$67",  market: "Australia",      authority: "ATO",  productId: "australia-smsf-residency" },
  "nomad_147_au_smsf":              { subject: "Your SMSF Residency Shield System — TaxCheckNow",         productName: "Your SMSF Residency Shield System",        driveUrl: "",                                                       tierLabel: "$147", market: "Australia",      authority: "ATO",  productId: "australia-smsf-residency" },
  "nomad_67_spain_beckham":         { subject: "Your Beckham Eligibility Fix Kit — TaxCheckNow",           productName: "Your Beckham Eligibility Fix Kit",         driveUrl: "",                                                       tierLabel: "$67",  market: "Spain",          authority: "AEAT", productId: "spain-beckham-eligibility" },
  "nomad_147_spain_beckham":        { subject: "Your Beckham Approval System — TaxCheckNow",                productName: "Your Beckham Approval System",             driveUrl: "",                                                       tierLabel: "$147", market: "Spain",          authority: "AEAT", productId: "spain-beckham-eligibility" },
  // ── CAN ───────────────────────────────────────────────────────────────────
  "can_67_departure_tax_trap":      { subject: "Your Canada Departure Tax Report — TaxCheckNow",           productName: "Your Departure Tax Risk Report",           driveUrl: "",                                                       tierLabel: "$67",  market: "Canada",         authority: "CRA",  productId: "departure-tax-trap" },
  "can_147_departure_tax_trap":     { subject: "Your Canada Exit Tax Strategy — TaxCheckNow",               productName: "Your Exit Tax Strategy System",            driveUrl: "",                                                       tierLabel: "$147", market: "Canada",         authority: "CRA",  productId: "departure-tax-trap" },
  "can_67_non_resident_landlord":   { subject: "Your Canadian Rental Withholding Fix Plan — TaxCheckNow",   productName: "Your Rental Withholding Fix Plan",         driveUrl: "",                                                       tierLabel: "$67",  market: "Canada",         authority: "CRA",  productId: "non-resident-landlord-withholding" },
  "can_147_non_resident_landlord":  { subject: "Your Non-Resident Rental System — TaxCheckNow",              productName: "Your Non-Resident Rental System",          driveUrl: "",                                                       tierLabel: "$147", market: "Canada",         authority: "CRA",  productId: "non-resident-landlord-withholding" },
  "can_67_property_flipping_tax_trap":  { subject: "Your Property Tax Classification Report — TaxCheckNow",  productName: "Your Property Tax Classification Report",   driveUrl: "",                                                       tierLabel: "$67",  market: "Canada",         authority: "CRA",  productId: "property-flipping-tax-trap" },
  "can_147_property_flipping_tax_trap": { subject: "Your Property Tax Strategy System — TaxCheckNow",         productName: "Your Property Tax Strategy System",         driveUrl: "",                                                       tierLabel: "$147", market: "Canada",         authority: "CRA",  productId: "property-flipping-tax-trap" },
  "can_67_amt_shock_auditor":           { subject: "Your Canada AMT Risk Report — TaxCheckNow",                 productName: "Your AMT Risk Report",                       driveUrl: "",                                                       tierLabel: "$67",  market: "Canada",         authority: "CRA",  productId: "amt-shock-auditor" },
  "can_147_amt_shock_auditor":          { subject: "Your Canada AMT Optimization System — TaxCheckNow",         productName: "Your AMT Optimization System",               driveUrl: "",                                                       tierLabel: "$147", market: "Canada",         authority: "CRA",  productId: "amt-shock-auditor" },
  "can_67_eot_exit_optimizer":          { subject: "Your EOT Eligibility Report — TaxCheckNow",                   productName: "Your EOT Eligibility Report",                 driveUrl: "",                                                       tierLabel: "$67",  market: "Canada",         authority: "CRA",  productId: "eot-exit-optimizer" },
  "can_147_eot_exit_optimizer":         { subject: "Your EOT Exit Strategy System — TaxCheckNow",                  productName: "Your EOT Exit Strategy System",               driveUrl: "",                                                       tierLabel: "$147", market: "Canada",         authority: "CRA",  productId: "eot-exit-optimizer" },
  // ── AU ────────────────────────────────────────────────────────────────────
  "au_67_cgt_main_residence_trap":         { subject: "Your CGT Exposure Plan — TaxCheckNow",                    productName: "Your CGT Exposure Plan",                    driveUrl: "",    tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "cgt-main-residence-trap" },
  "au_147_cgt_main_residence_trap":        { subject: "Your Main Residence Shield System — TaxCheckNow",         productName: "Your Main Residence Shield System",         driveUrl: "",   tierLabel: "$147", market: "Australia", authority: "ATO", productId: "cgt-main-residence-trap" },
  "au_67_division_7a_loan_trap":           { subject: "Your Division 7A Rescue Plan — TaxCheckNow",              productName: "Your Division 7A Rescue Plan",              driveUrl: "",     tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "division-7a-loan-trap" },
  "au_147_division_7a_loan_trap":          { subject: "Your Director Loan Shield System — TaxCheckNow",          productName: "Your Director Loan Shield System",          driveUrl: "",    tierLabel: "$147", market: "Australia", authority: "ATO", productId: "division-7a-loan-trap" },
  "au_67_fbt_hidden_exposure":             { subject: "Your FBT Exposure Fix Plan — TaxCheckNow",                productName: "Your FBT Exposure Fix Plan",                driveUrl: "",       tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "fbt-hidden-exposure" },
  "au_147_fbt_hidden_exposure":            { subject: "Your FBT Control System — TaxCheckNow",                   productName: "Your FBT Control System",                   driveUrl: "",      tierLabel: "$147", market: "Australia", authority: "ATO", productId: "fbt-hidden-exposure" },
  "au_67_cgt_discount_timing_sniper":      { subject: "Your CGT Timing Fix Plan — TaxCheckNow",                  productName: "Your CGT Timing Fix Plan",                  driveUrl: "",    tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "cgt-discount-timing-sniper" },
  "au_147_cgt_discount_timing_sniper":     { subject: "Your CGT Exit Timing System — TaxCheckNow",               productName: "Your CGT Exit Timing System",               driveUrl: "",   tierLabel: "$147", market: "Australia", authority: "ATO", productId: "cgt-discount-timing-sniper" },
  "au_67_negative_gearing_illusion":       { subject: "Your Negative Gearing Reality Plan — TaxCheckNow",        productName: "Your Negative Gearing Reality Plan",        driveUrl: "",         tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "negative-gearing-illusion" },
  "au_147_negative_gearing_illusion":      { subject: "Your Property Cashflow Control System — TaxCheckNow",     productName: "Your Property Cashflow Control System",     driveUrl: "",        tierLabel: "$147", market: "Australia", authority: "ATO", productId: "negative-gearing-illusion" },
  "au_67_small_business_cgt_concessions":  { subject: "Your CGT Concession Eligibility Memo — TaxCheckNow",      productName: "Your CGT Concession Eligibility Memo",      driveUrl: "",      tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "small-business-cgt-concessions" },
  "au_147_small_business_cgt_concessions": { subject: "Your Exit Concession Blueprint — TaxCheckNow",            productName: "Your Exit Concession Blueprint",            driveUrl: "",     tierLabel: "$147", market: "Australia", authority: "ATO", productId: "small-business-cgt-concessions" },
  "au_67_instant_asset_write_off":         { subject: "Your EOFY Asset Deadline Plan — TaxCheckNow",             productName: "Your EOFY Asset Deadline Plan",             driveUrl: "",       tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "instant-asset-write-off" },
  "au_147_instant_asset_write_off":        { subject: "Your Asset Timing & Depreciation System — TaxCheckNow",   productName: "Your Asset Timing & Depreciation System",   driveUrl: "",      tierLabel: "$147", market: "Australia", authority: "ATO", productId: "instant-asset-write-off" },
  "au_67_gst_registration_trap":           { subject: "Your GST Catch-Up Plan — TaxCheckNow",                    productName: "Your GST Catch-Up Plan",                    driveUrl: "",        tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "gst-registration-trap" },
  "au_147_gst_registration_trap":          { subject: "Your GST Compliance Launch System — TaxCheckNow",         productName: "Your GST Compliance Launch System",         driveUrl: "",       tierLabel: "$147", market: "Australia", authority: "ATO", productId: "gst-registration-trap" },
  "au_67_rental_property_deduction_audit": { subject: "Your Rental Deduction Repair Pack — TaxCheckNow",         productName: "Your Rental Deduction Repair Pack",         driveUrl: "",     tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "rental-property-deduction-audit" },
  "au_147_rental_property_deduction_audit":{ subject: "Your ATO Audit-Ready Rental System — TaxCheckNow",        productName: "Your ATO Audit-Ready Rental System",        driveUrl: "",    tierLabel: "$147", market: "Australia", authority: "ATO", productId: "rental-property-deduction-audit" },
  "au_67_medicare_levy_surcharge_trap":    { subject: "Your MLS Avoidance Plan — TaxCheckNow",                   productName: "Your MLS Avoidance Plan",                   driveUrl: "",        tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "medicare-levy-surcharge-trap" },
  "au_147_medicare_levy_surcharge_trap":   { subject: "Your Income & Insurance Optimisation System — TaxCheckNow", productName: "Your Income & Insurance Optimisation System", driveUrl: "",    tierLabel: "$147", market: "Australia", authority: "ATO", productId: "medicare-levy-surcharge-trap" },
  "au_67_bring_forward_window":            { subject: "Your June 30 Decision Pack — TaxCheckNow",                productName: "Your June 30 Decision Pack",                driveUrl: "",        tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "bring-forward-window" },
  "au_147_bring_forward_window":           { subject: "Your June 30 Execution Plan — TaxCheckNow",               productName: "Your June 30 Execution Plan",               driveUrl: "",       tierLabel: "$147", market: "Australia", authority: "ATO", productId: "bring-forward-window" },
  "au_67_super_death_tax_trap":  { subject: "Your Super Death Tax Report — TaxCheckNow", productName: "Your Super Death Tax Report", driveUrl: "", tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "super-death-tax-trap" },
  "au_147_super_death_tax_trap": { subject: "Your Super Death Tax Execution Plan — TaxCheckNow", productName: "Your Super Death Tax Execution Plan", driveUrl: "", tierLabel: "$147", market: "Australia", authority: "ATO", productId: "super-death-tax-trap" },
  "au_67_div296_wealth_eraser":  { subject: "Your Div 296 Decision Pack — TaxCheckNow", productName: "Your Div 296 Decision Pack", driveUrl: "", tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "div296-wealth-eraser" },
  "au_147_div296_wealth_eraser": { subject: "Your Div 296 Execution Pack — TaxCheckNow", productName: "Your Div 296 Execution Pack", driveUrl: "", tierLabel: "$147", market: "Australia", authority: "ATO", productId: "div296-wealth-eraser" },
  "au_67_frcgw_clearance_certificate":  { subject: "Your FRCGW Clearance Pack — TaxCheckNow", productName: "Your FRCGW Clearance Pack", driveUrl: "", tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "frcgw-clearance-certificate" },
  "au_147_frcgw_clearance_certificate": { subject: "Your FRCGW Execution Pack — TaxCheckNow", productName: "Your FRCGW Execution Pack", driveUrl: "", tierLabel: "$147", market: "Australia", authority: "ATO", productId: "frcgw-clearance-certificate" },
  "au_67_super_to_trust_exit":   { subject: "Your Exit Break-Even Pack — TaxCheckNow", productName: "Your Exit Break-Even Pack", driveUrl: "", tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "super-to-trust-exit" },
  "au_147_super_to_trust_exit":  { subject: "Your Full Exit Decision Model — TaxCheckNow", productName: "Your Full Exit Decision Model", driveUrl: "", tierLabel: "$147", market: "Australia", authority: "ATO", productId: "super-to-trust-exit" },
  "au_67_transfer_balance_cap":  { subject: "Your TBC Position Pack — TaxCheckNow", productName: "Your TBC Position Pack", driveUrl: "", tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "transfer-balance-cap" },
  "au_147_transfer_balance_cap": { subject: "Your Full TBC Strategy — TaxCheckNow", productName: "Your Full TBC Strategy", driveUrl: "", tierLabel: "$147", market: "Australia", authority: "ATO", productId: "transfer-balance-cap" },
  "au_67_superannuation_tax_leaving_australia_confusion_2026":  { subject: "Your DASP & Departure Super Plan — TaxCheckNow", productName: "Your DASP & Departure Super Plan", driveUrl: "", tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "superannuation-tax-leaving-australia-confusion-2026" },
  "au_147_superannuation_tax_leaving_australia_confusion_2026": { subject: "Your Departure Tax & Super Optimisation System — TaxCheckNow", productName: "Your Departure Tax & Super Optimisation System", driveUrl: "", tierLabel: "$147", market: "Australia", authority: "ATO", productId: "superannuation-tax-leaving-australia-confusion-2026" },
  // ── SUPERTAXCHECK ─────────────────────────────────────────────────────────
  "supertax_67_div296_wealth_eraser":  { subject: "Your Div 296 Wealth Eraser — SuperTaxCheck",  productName: "Your Div 296 Wealth Eraser",  driveUrl: process.env.DRIVE_DIV296_67 || "",  tierLabel: "$67",  market: "Australia", authority: "ATO", productId: "div296-wealth-eraser" },
  "supertax_147_div296_wealth_eraser": { subject: "Your Div 296 Strategy System — SuperTaxCheck", productName: "Your Div 296 Strategy System", driveUrl: process.env.DRIVE_DIV296_147 || "", tierLabel: "$147", market: "Australia", authority: "ATO", productId: "div296-wealth-eraser" },
};

// PRODUCT_DEADLINES migrated to cole-marketing/lib/product-deadlines.ts
// (Pre-Step-2D, Phase 1.5a). Use lookupDeadline("taxchecknow", productId).

const REMINDER_DAYS = [30, 7, 1];

// SANDBOX SAFETY: on Vercel Preview STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are unset
// (Production-only scope) → Preview uses the TEST sandbox key + test signing secret.
const isPreview = (): boolean => process.env.VERCEL_ENV === "preview";

function getStripe() {
  const key = isPreview() ? process.env.STRIPE_SECRET_TEST_KEY : process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error(isPreview() ? "Missing STRIPE_SECRET_TEST_KEY (Preview sandbox)" : "Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

// AUTHORITY_DETAILS, productKeyToCountryPrefix, formatDeadlineLabel,
// getMarketContext all migrated to cole-marketing/lib/email-context.ts
// (Pre-Step-2A, Phase 1.5a). Webhook is now a thin caller of the imported
// getMarketContext().

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

    // F5 contract: maze flags are AUTHORITATIVE. Popup answers travel under a namespaced
    // key (qualification.*) and NEVER merge into or override a maze flag. Both composer
    // paths (this webhook + the client success-page fallback) build inputs identically.
    const inputs = buildComposerInputs(
      (ds?.inputs || {}) as Record<string, unknown>,
      (ds?.questionnaire_payload || {}) as Record<string, unknown>,
    );

    // IN-PROCESS generation (2026-07-23): call the generator directly, NOT
    // fetch(`${NEXT_PUBLIC_SITE_URL}/api/assess`). The HTTP self-call hit PRODUCTION, so a branch
    // webhook ran against pre-merge prod assess semantics (no `grounded` field → every store
    // skipped). Direct call = same deployment's code always runs; holds on prod after merge and on
    // every preview. fields: per-product list (== the client success-page list, PQ-C0) so the paid
    // deliverable is identical regardless of path.
    const result = await generateAssessment({
      product_id: delivery.productId,
      market:     delivery.market,
      authority:  delivery.authority,
      tier:       tier >= 147 ? 2 : 1,
      name:       customerName,
      inputs,
      fields:     getAssessmentFields(delivery.productId, tier),
    });

    // FAIL-CLOSED: on any generator failure (corpus unreachable/malformed = status 424, etc.) we
    // do NOT store an ungrounded assessment. result.ok===true GUARANTEES grounded===true. The
    // success page then shows a retry/support state instead of confidently-wrong law. (Ruling.)
    if (!result.ok) { console.error(`[webhook] assess ${result.status} (${result.error}) for ${stripeSessionId} — NOT stored (fail-closed)`); return; }
    const { assessment, corpus_source, corpus_verified } = result;

    await (supabase as any).from("assessments").upsert({
      stripe_session_id:   stripeSessionId,
      decision_session_id: decisionSessionId,
      product_id:          delivery.productId,
      product_key:         productKey,
      tier,
      customer_email:      customerEmail,
      customer_name:       customerName,
      // Stamp groundedness INTO the stored JSON so it is auditable in SQL without a schema
      // change: `assessment_json->'_meta'->>'grounded'`, `->>'corpus_source'`.
      assessment_json:     { ...assessment, _meta: { grounded: true, corpus_source, corpus_verified } },
      created_at:          new Date().toISOString(),
    }, { onConflict: "stripe_session_id" });

    console.log(`[webhook] Assessment stored (grounded, ${corpus_source}):`, stripeSessionId);
  } catch (err) {
    console.error("[webhook] Assessment failed (non-blocking):", err);
  }
}

// ── QUEUE REMINDER EMAILS ────────────────────────────────────────────────────
// TEMPORAL v1 Phase 1.4a — operator alert for delivery-side email_log failures. The webhook's
// email_log insert previously failed SILENTLY (delivery_status went "sent" with zero log rows —
// the FRCGW live session had 0 email_log rows). Surface it loudly so a missing delivery record
// pages the operator instead of vanishing.
const OPERATOR_FROM_ADDRESS = "TaxCheckNow <hello@taxchecknow.com>";
async function alertOperator(summary: string): Promise<void> {
  const operator  = process.env.OPERATOR_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;
  if (!operator || !resendKey) {
    console.error("[webhook] OPERATOR ALERT (no OPERATOR_EMAIL/RESEND_API_KEY configured):", summary);
    return;
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from:    OPERATOR_FROM_ADDRESS,
        to:      [operator],
        subject: "[TaxCheckNow webhook] Delivery email_log failure",
        html:    `<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;">${summary.replace(/</g, "&lt;")}</pre>`,
      }),
    });
  } catch (e) {
    console.error("[webhook] operator alert send failed:", e);
  }
}

// ── QUEUE A PURCHASE-ANCHORED NURTURE TRACK (TEMPORAL v1 · Step 7.4) ────────
// BEFORE STEP 7 A PURCHASE QUEUED NO NURTURE AT ALL — only deadline reminders.
// The nurture lane fired exclusively from /api/leads (calculator save). So a
// customer who bought without ever saving a free result got the delivery email
// and then, for an unresolvable product, nothing else ever.
//
// Now the anchor is declarable. A product declaring anchor:"purchase" gets its
// track queued here; anchor:"lead" is queued by /api/leads and deliberately NOT
// duplicated here — one anchor per declaration, so a track cannot double-fire.
//
// Deadline-free by construction: offsets are days from the PURCHASE, so nothing
// in this path reads the resolver or any date (Step 7.2).
async function queueNurtureOnPurchase(
  supabase: any,
  productId: string,
  productKey: string,
  customerEmail: string,
  customerName: string,
  decisionSessionId: string,
): Promise<void> {
  try {
    const declaration = lookupNurture("taxchecknow", productId);
    if (!declaration) return;                        // no track declared → nothing (7.1)
    if (declaration.anchor !== "purchase") return;   // lead-anchored → /api/leads owns it

    const linkedSessionId =
      decisionSessionId && !decisionSessionId.startsWith("fallback_") ? decisionSessionId : null;

    const today = new Date();
    const rows = declaration.milestones.map(days => {
      const trigger = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      trigger.setUTCDate(trigger.getUTCDate() + days);
      return {
        stripe_session_id:   null,
        product_key:         productKey,
        product_id:          productId,
        customer_email:      customerEmail,
        customer_name:       customerName,
        decision_session_id: linkedSessionId,
        trigger_date:        trigger.toISOString().split("T")[0],
        // days_before_deadline stays NULL — this is NOT a deadline row. The send
        // cron reads that column to decide the reminder lane, so leaving it null
        // is what keeps this row on the nurture side of the Step 7.2 split.
        email_type:          nurtureEmailType(days),
        subject:             `Your ${days}-day check-in`,
        status:              "queued",
        created_at:          new Date().toISOString(),
      };
    });

    const { error } = await (supabase as any).from("email_queue").insert(rows);
    if (error) console.error("[webhook] nurture queue error:", error.message);
    else console.log(`[webhook] queued ${rows.length} purchase-anchored nurture rows (track ${declaration.track}) for`, customerEmail);
  } catch (err) {
    console.error("[webhook] nurture queue failed (non-blocking):", err);
  }
}

async function queueReminders(
  supabase: any,
  stripeSessionId: string,
  productKey: string,
  customerEmail: string,
  customerName: string,
  delivery: typeof DELIVERY_MAP[string],
  decisionSessionId: string,
): Promise<void> {
  try {
    // TEMPORAL v1 Step 6.2/6.3 — resolve the product's OWN declaration. There is
    // no fallback: UNDECLARED, NONE, UNRESOLVABLE and EXPIRED all queue nothing.
    // schedulableDate() returns non-null ONLY for a RESOLVED future date, so
    // "silent unless positively resolved" is enforced by the resolver rather
    // than by every caller remembering to check four statuses.
    //
    // `answers` is null here: the reminder batch is queued at purchase time from
    // a product-level declaration. A user_supplied rule therefore resolves
    // UNRESOLVABLE on this path — correct, because a per-customer date must be
    // scheduled from that customer's session, not from the product. Wiring the
    // session answers through is the follow-on to the calculator date-field work.
    const declaration = lookupTemporal("taxchecknow", delivery.productId);
    const resolution  = resolveTemporal(declaration, null, new Date());
    const schedulable = schedulableDate(resolution);

    if (!schedulable) {
      console.log("[webhook] TEMPORAL: no schedulable date — 0 reminders queued", {
        product: delivery.productId,
        status:  resolution.status,
        reason:  "reason" in resolution ? resolution.reason : undefined,
      });
      return;
    }

    // Step 4 personalisation hook: link reminder rows to the decision_sessions
    // row when present so cron's send-emails can read the customer's verdict
    // at send time. Falls back gracefully (cron uses product-only template
    // when null). Reject fallback_ stubs — they're calculator-side fakes.
    const linkedSessionId =
      decisionSessionId && !decisionSessionId.startsWith("fallback_")
        ? decisionSessionId
        : null;

    // Step 6.2 — the resolved CALENDAR date (YYYY-MM-DD in the declared zone).
    // Parsed as UTC midnight so the offset arithmetic below is pure calendar
    // maths: `new Date("2027-01-31")` is UTC-midnight by spec, whereas the old
    // `new Date("…T23:59:59+10:00")` was an instant that could shift the derived
    // trigger_date across a day boundary depending on the runtime's zone.
    const deadline = new Date(`${schedulable.date}T00:00:00Z`);
    // TEMPORAL v1 Phase 1.1 — queue-time future guard. Never insert a reminder whose trigger
    // is already past at insert time. Checked PER OFFSET (d-30/d-7/d-1), not just the deadline,
    // so a d-30 whose window has closed is dropped even when d-1 is still future. This is what
    // sent d-30/d-7/d-1 "deadline" reminders for an already-passed FRCGW deadline.
    // Still load-bearing under Step 6: the resolver guarantees the DEADLINE is future,
    // but an individual d-30 offset can still land in the past.
    const todayStr = new Date().toISOString().split("T")[0];
    const allRows = REMINDER_DAYS.map(days => {
      const trigger = new Date(deadline);
      trigger.setUTCDate(trigger.getUTCDate() - days);
      return {
        stripe_session_id:    stripeSessionId,
        product_key:          productKey,
        product_id:           delivery.productId,
        customer_email:       customerEmail,
        customer_name:        customerName,
        decision_session_id:  linkedSessionId,
        trigger_date:         trigger.toISOString().split("T")[0],
        days_before_deadline: days,
        subject:              `${days === 1 ? "Tomorrow" : `${days} days`} — ${delivery.productName}`,
        status:               "queued",
        created_at:           new Date().toISOString(),
      };
    });

    const rows = allRows.filter(r => {
      if (r.trigger_date < todayStr) {
        console.warn("[webhook] TEMPORAL queue-guard: suppressed reminder (trigger already past)", {
          product:           delivery.productId,
          resolved_deadline: schedulable.date,
          offset_days:       r.days_before_deadline,
          trigger_date:      r.trigger_date,
          reason:            "trigger_date < today at insert",
        });
        return false;
      }
      return true;
    });

    if (rows.length === 0) {
      console.warn("[webhook] TEMPORAL queue-guard: ALL reminders suppressed (every offset already past) for",
        customerEmail, delivery.productId, "deadline", schedulable.date);
      return;
    }

    const { error } = await (supabase as any).from("email_queue").insert(rows);
    if (error) console.error("[webhook] Queue error:", error.message);
    else console.log("[webhook] Queued", rows.length, "of", allRows.length, "reminders for", customerEmail);
  } catch (err) {
    console.error("[webhook] Queue failed (non-blocking):", err);
  }
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature");
  const secret    = isPreview() ? process.env.STRIPE_WEBHOOK_TEST_SECRET : process.env.STRIPE_WEBHOOK_SECRET;

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

  // IDEMPOTENCY (2026-07-25): a live webhook can fire repeatedly (Stripe retries / endpoint
  // re-points) — the FRCGW live session (cs_live_a1IwsaHbvx…) landed 5 purchase rows over ~4h.
  // If this session was ALREADY processed (a purchase exists), do NOTHING more: no duplicate
  // purchase, no duplicate DELIVERY EMAIL, no duplicate assessment. We return BEFORE the email
  // send below, so a re-fire cannot re-deliver. The UNIQUE constraint on
  // purchases.stripe_session_id (migration) is the concurrent-race backstop; this pre-check
  // handles the common sequential retry.
  {
    const { data: existing } = await supabase
      .from("purchases").select("id").eq("stripe_session_id", session.id).maybeSingle();
    if (existing) {
      console.log("[webhook] duplicate — session already processed, skipping:", session.id);
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  // 1. Record purchase (upsert on stripe_session_id — belt to the pre-check for concurrent races).
  let purchaseId: string | null = null;
  try {
    const { data, error } = await supabase
      .from("purchases")
      .upsert({
        stripe_session_id:     session.id,
        stripe_payment_intent: String(session.payment_intent || ""),
        decision_session_id:   decisionSid,
        product_key:           productKey,
        tier,
        amount_gbp:            amountPaid,
        currency:              session.currency || "aud",
        customer_email:        customerEmail,
        // NOTE: purchases has NO customer_name column — including it made the ENTIRE insert
        // throw (root cause of the never-passed delivery check: no purchase row → no
        // purchaseId → no email_log → delivery_status stuck). Name is preserved in metadata
        // and still flows to the delivery email + assessments (which does have the column).
        site:                  "taxchecknow",
        country_code:          delivery?.market?.slice(0,2).toUpperCase() || "AU",
        delivery_status:       "pending",
        metadata:              { ...(session.metadata || {}), customer_name: customerName },
      }, { onConflict: "stripe_session_id" })
      .select("id")
      .single();

    if (error) console.error("[webhook] Purchase insert error:", error.message);
    else { purchaseId = data?.id || null; }
  } catch (err) {
    console.error("[webhook] Supabase purchase error:", err);
  }

  // 2. Generate + store assessment — deferred to after() (post-response, platform-kept-alive).
  // ROOT CAUSE FIX (2026-07-23): this was fire-and-forget (`...catch(()=>{})`). On Vercel the
  // function is FROZEN once the response returns, so the un-awaited store only landed if it
  // happened to finish during the awaited email — a RACE the SLOWER tier lost (tier 147's
  // /api/assess uses max_tokens 2500 + more fields → slower than tier 67's 1500 → its store was
  // routinely cut off → has_assessment=false, no error logged). Latency-dependent, so which tier
  // "lost" could flip between runs. `after()` keeps the lambda alive until the store completes
  // for EVERY tier, while the response still returns fast (no Stripe-timeout retry → no duplicate
  // delivery emails, which an `await` here would have risked since the purchase insert is not
  // idempotent). Its own try/catch logs any real failure.
  if (delivery && decisionSid && customerEmail) {
    after(() => generateAndStoreAssessment(
      supabase, session.id, decisionSid, productKey,
      tier, delivery, customerEmail, customerName
    ));
  }

  // 3. Queue reminder emails — same deferral (same latent race).
  if (delivery && customerEmail) {
    after(() => queueReminders(supabase, session.id, productKey, customerEmail, customerName, delivery, decisionSid));
    // Step 7.4 — the purchase anchor. Same after() deferral and the same
    // non-fatal contract: a nurture-queue failure must never affect delivery.
    after(() => queueNurtureOnPurchase(supabase, delivery.productId, productKey, customerEmail, customerName, decisionSid));
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

  // Resolve all multi-market context (authority full name + URL,
  // deadline, success-page URL, per-product copy with tier-aware
  // fallback to TIER_DEFAULTS, etc.)
  const marketContext = getMarketContext("taxchecknow", productKey, tier, session.id, delivery);

  const emailResult = await sendDeliveryEmail({
    to:                customerEmail,
    productName:       delivery.productName,
    productKey,
    tierLabel:         delivery.tierLabel,
    subject:           delivery.subject,
    marketDisplayName: marketContext.marketDisplayName,
    authority:         marketContext.authority,
    authorityFullName: marketContext.authorityFullName,
    authorityUrl:      marketContext.authorityUrl,
    deadlineDate:      marketContext.deadlineDate,
    deadlineLabel:     marketContext.deadlineLabel,
    successUrl:        marketContext.successUrl,
    ctaLabel:          marketContext.ctaLabel,
    bullets:           marketContext.bullets,
    nextStep:          marketContext.nextStep,
    tagline:           marketContext.tagline,
  });

  // 5. Log email status.
  // supabase-js .insert() RESOLVES with { error } rather than throwing, so an unchecked
  // insert failed SILENTLY here (email_log stayed empty even when delivery_status went "sent").
  // Surface both errors like the purchases insert (line ~324). Diagnostic confirmed the live
  // email_log schema accepts this exact payload, so any future error is a real signal.
  if (purchaseId) {
    try {
      const supabase2 = getSupabase();
      const { error: logErr } = await (supabase2 as any).from("email_log").insert({
        purchase_id:     purchaseId,
        recipient_email: customerEmail,
        email_type:      "delivery",
        subject:         delivery.subject,
        resend_id:       emailResult.resendId || null,
        status:          emailResult.success ? "sent" : "failed",
        // Phase 1.4a/1.3 — stamp sent_at so the per-recipient 24h cap can see this delivery.
        sent_at:         emailResult.success ? new Date().toISOString() : null,
      });
      // Phase 1.4a — fail LOUDLY: a delivery went out but left no log record. Page the operator.
      if (logErr) {
        console.error("[webhook] email_log insert error:", logErr.message);
        await alertOperator(
          `email_log insert FAILED after delivery send.\nsession: ${session.id}\npurchase: ${purchaseId}\n` +
          `recipient: ${customerEmail}\nproduct: ${productKey}\ndelivery_sent: ${emailResult.success}\nerror: ${logErr.message}`,
        );
      }
      const { error: updErr } = await supabase2.from("purchases").update({
        delivery_status:  emailResult.success ? "sent" : "failed",
        delivery_sent_at: emailResult.success ? new Date().toISOString() : null,
      }).eq("id", purchaseId);
      if (updErr) console.error("[webhook] purchases delivery_status update error:", updErr.message);
    } catch (err) {
      console.error("[webhook] Log error:", err);
      await alertOperator(`Delivery log path threw for session ${session.id} (${customerEmail}): ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (emailResult.success) {
    // Phase 1.4a — delivery email SENT but purchaseId is null (purchase upsert failed), so no
    // email_log record can be written. This is the exact FRCGW-live silent-failure mode: a paid
    // delivery with zero delivery record. Never let it pass quietly.
    console.error("[webhook] delivery sent but purchaseId is null — no email_log record written:", session.id);
    await alertOperator(
      `Delivery email SENT but NO purchase row (purchaseId null) — no email_log record written.\n` +
      `session: ${session.id}\nrecipient: ${customerEmail}\nproduct: ${productKey}\nresendId: ${emailResult.resendId || "?"}`,
    );
  }

  console.log("[webhook] Complete. Email:", emailResult.success);
  return NextResponse.json({ received: true });
}
