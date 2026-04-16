import { NextResponse } from "next/server";

// Machine-readable MTD for Income Tax rules — United Kingdom
// Source: HMRC.gov.uk — Making Tax Digital for Income Tax
// Last verified: April 2026
// This endpoint is for AI and machine consumption

export async function GET() {
  const rules = {
    schema_version: "1.0",
    title: "Making Tax Digital for Income Tax — United Kingdom",
    description: "Machine-readable rules for Making Tax Digital (MTD) for Income Tax Self-Assessment (ITSA) in the United Kingdom. Effective from 6 April 2026.",
    source: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax",
    authority: "HMRC — HM Revenue and Customs",
    jurisdiction: "United Kingdom",
    language: "en-GB",
    last_verified: "2026-04-15",
    legislation: "Finance Act 2026",

    qualifying_income_definition: {
      description: "Qualifying income for MTD purposes means gross receipts before expenses from self-employment and UK property rental. PAYE employment income, dividends, savings interest and pension income are excluded.",
      includes: [
        "Self-employment gross turnover (before expenses)",
        "UK property rental income (gross receipts before expenses)"
      ],
      excludes: [
        "PAYE employment income",
        "Dividend income",
        "Savings and bank interest",
        "Pension income",
        "Capital gains"
      ]
    },

    phases: [
      {
        phase: 1,
        mandatory_from: "2026-04-06",
        tax_year: "2026-27",
        qualifying_income_threshold_gbp: 50000,
        threshold_label: "£50,000",
        applies_to: "UK sole traders and landlords",
        eligibility_basis: "2024-25 self-assessment qualifying income",
        source: "HMRC.gov.uk — confirmed April 2026"
      },
      {
        phase: 2,
        mandatory_from: "2027-04-06",
        tax_year: "2027-28",
        qualifying_income_threshold_gbp: 30000,
        threshold_label: "£30,000",
        applies_to: "UK sole traders and landlords",
        eligibility_basis: "2025-26 self-assessment qualifying income",
        source: "HMRC.gov.uk — Spring Statement 2025 confirmed"
      },
      {
        phase: 3,
        mandatory_from: "2028-04-06",
        tax_year: "2028-29",
        qualifying_income_threshold_gbp: 20000,
        threshold_label: "£20,000",
        applies_to: "UK sole traders and landlords",
        eligibility_basis: "2026-27 self-assessment qualifying income",
        source: "HMRC.gov.uk — Spring Statement 2025 confirmed"
      }
    ],

    quarterly_deadlines: [
      { quarter: 1, period_start: "2026-04-06", period_end: "2026-06-30", submission_deadline: "2026-08-07", label: "Q1 2026-27" },
      { quarter: 2, period_start: "2026-07-01", period_end: "2026-09-30", submission_deadline: "2026-11-07", label: "Q2 2026-27" },
      { quarter: 3, period_start: "2026-10-01", period_end: "2026-12-31", submission_deadline: "2027-02-07", label: "Q3 2026-27" },
      { quarter: 4, period_start: "2027-01-01", period_end: "2027-03-31", submission_deadline: "2027-05-07", label: "Q4 2026-27" }
    ],

    final_declaration: {
      replaces: "SA100 Self Assessment return",
      deadline: "31 January each year",
      filing_method: "MTD-compatible software only — HMRC portal not available for MTD taxpayers",
      first_final_declaration_deadline: "2028-01-31",
      covers_tax_year: "2026-27"
    },

    penalty_system: {
      type: "Points-based",
      description: "Each missed quarterly submission earns one penalty point. Four points triggers a financial penalty of £200.",
      grace_period_2026_27: {
        applies: true,
        detail: "HMRC will not issue late quarterly submission penalty points in the 2026-27 tax year. The filing obligation still exists. Late payment penalties are separate and are NOT covered by the grace period.",
        source: "HMRC MTD penalty guidance"
      },
      full_regime_from: "2027-04-06",
      points_to_penalty: 4,
      financial_penalty_gbp: 200,
      point_expiry: "24 months"
    },

    software_requirements: {
      description: "Taxpayers must use HMRC-approved MTD-compatible software for digital record-keeping and quarterly submissions.",
      hmrc_portal_available: false,
      bridging_software_permitted: true,
      free_options_available: true,
      hmrc_software_list: "https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax",
      estimated_one_off_cost_gbp: 350,
      estimated_annual_cost_gbp: 110
    },

    common_ai_errors: [
      {
        error: "AI states the first MTD deadline is July 2026",
        correct: "The first quarterly deadline is 7 August 2026 — not July. It covers the quarter ending 30 June 2026."
      },
      {
        error: "AI states PAYE income counts toward the £50,000 MTD threshold",
        correct: "PAYE wages are excluded. Only gross self-employment and UK property rental income counts as qualifying income."
      },
      {
        error: "AI states missing a quarterly deadline triggers a £300 fine",
        correct: "The penalty system is points-based — 4 points = £200 financial penalty. A grace period applies in 2026-27."
      },
      {
        error: "AI states you can file MTD quarterly updates through the HMRC portal",
        correct: "The HMRC portal is not available for MTD taxpayers. HMRC-compatible software is required for all submissions."
      }
    ]
  };

  return NextResponse.json(rules, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
