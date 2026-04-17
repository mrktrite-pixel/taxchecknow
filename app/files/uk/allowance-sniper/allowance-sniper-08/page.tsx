export default function Page() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Implementation Checklist — TaxCheckNow</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.7; color: #111; background: #fff; max-width: 720px; margin: 0 auto; padding: 40px 32px; }
    .header { border-bottom: 3px solid #0a0a0a; padding-bottom: 20px; margin-bottom: 32px; }
    .brand { font-family: monospace; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #666; margin-bottom: 8px; }
    .file-label { font-family: monospace; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #999; background: #f5f5f5; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 12px; }
    h1 { font-size: 26px; font-weight: 700; line-height: 1.2; margin-bottom: 6px; }
    .subtitle { font-size: 14px; color: #555; }
    .deadline-bar { background: #dc2626; color: white; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-bottom: 32px; }
    h2 { font-size: 18px; font-weight: 700; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
    h3 { font-size: 15px; font-weight: 700; margin: 20px 0 8px; }
    p { margin-bottom: 12px; }
    ul, ol { margin: 0 0 16px 20px; } li { margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    th { background: #f5f5f5; padding: 8px 12px; text-align: left; font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #e5e7eb; }
    td { padding: 8px 12px; border: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background: #fafafa; }
    .highlight { background: #fef3c7; border-left: 3px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    .info-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 14px 16px; border-radius: 8px; margin: 16px 0; }
    .warning-box { background: #fef2f2; border: 1px solid #fecaca; padding: 14px 16px; border-radius: 8px; margin: 16px 0; }
    .action-box { background: #0a0a0a; color: white; padding: 16px 20px; border-radius: 10px; margin: 20px 0; }
    .action-box h3 { color: #fff; margin-top: 0; } .action-box p { color: #ccc; }
    .checklist { list-style: none; margin-left: 0; }
    .checklist li { padding: 6px 0; padding-left: 24px; position: relative; }
    .checklist li:before { content: "☐"; position: absolute; left: 0; color: #999; }
    .disclaimer { background: #f9fafb; border: 1px solid #e5e7eb; padding: 14px 16px; border-radius: 8px; margin-top: 32px; font-size: 11px; color: #888; line-height: 1.6; }
    .print-btn { display: inline-block; background: #0a0a0a; color: white; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; margin-bottom: 24px; }
    .nav-row { display: flex; justify-content: space-between; padding: 12px 0; border-top: 1px solid #e5e7eb; margin-top: 32px; font-size: 12px; color: #999; }
    @media print {
      .no-print { display: none !important; }
      a[href]:after { content: " (" attr(href) ")"; font-size: 9px; color: #555; word-break: break-all; }
      a[href^="#"]:after { content: ""; }
    }
  </style>
</head>
<body>
  <div class="header">
    <p class="brand">TaxCheckNow · United Kingdom · 60% Tax Trap 2026</p>
    <p class="file-label">Allowance Sniper Action Plan · File 08 of 8</p>
    <h1>Your Implementation Checklist</h1>
    <p class="subtitle">Every step before 5 April 2027.</p>
  </div>
  <div class="deadline-bar">🔴 Tax year end deadline: 5 April 2027 · Act before this date to escape the 60% trap</div>
  <button class="print-btn no-print" onclick="window.print()">⬇ Save as PDF</button>
  
<div class="action-box">
  <h3>Tax Year End Deadline: 5 April 2027</h3>
  <p>Pension contributions for 2026-27 must be received by your SIPP provider before midnight on 5 April 2027.</p>
  <p>Allow at least 5 working days for processing. Target: 28 March 2027.</p>
</div>

<h2>Part 1 — Confirm Your Position (Do This Week)</h2>
<ul class="checklist">
  <li>Confirm your adjusted net income with your accountant</li>
  <li>Confirm all pension contributions already made this tax year (employer and personal)</li>
  <li>Calculate remaining annual allowance (£60,000 minus contributions to date)</li>
  <li>Calculate gross SIPP contribution needed (ANI minus £100,000)</li>
  <li>Confirm gross contribution does not exceed remaining annual allowance</li>
</ul>

<h2>Part 2 — Choose and Set Up Your Route</h2>
<ul class="checklist">
  <li>Decide: personal SIPP, salary sacrifice, Gift Aid, or combination</li>
  <li>If salary sacrifice: request HR arrangement before income is received</li>
  <li>If personal SIPP: open SIPP if not already done (allow 2-5 days for setup)</li>
  <li>If Gift Aid: confirm eligible donations and gross amount</li>
  <li>Confirm your chosen SIPP provider accepts relief-at-source contributions</li>
</ul>

<h2>Part 3 — Make the Contribution</h2>
<ul class="checklist">
  <li>Calculate net payment amount (gross contribution × 80%)</li>
  <li>Transfer net amount to your SIPP by 28 March 2027 at the latest</li>
  <li>Confirm the contribution has been received by the provider</li>
  <li>Keep the confirmation receipt or statement</li>
  <li>Verify the gross contribution is showing in your pension account</li>
</ul>

<h2>Part 4 — Claim the Additional Relief</h2>
<ul class="checklist">
  <li>File your 2026-27 self-assessment return by 31 January 2028</li>
  <li>Enter gross pension contributions in the pension section</li>
  <li>HMRC will calculate and apply the additional 20% higher-rate relief</li>
  <li>Verify your final tax calculation reflects the contributions</li>
  <li>Check your 2027-28 PAYE tax code is correct for next year</li>
</ul>

<h2>Part 5 — Plan Next Year Now</h2>
<ul class="checklist">
  <li>Note the contribution made this year for carry-forward records</li>
  <li>Set a calendar reminder for October 2027 to review your ANI position</li>
  <li>Ask your employer to review your tax code for 2027-28</li>
  <li>Consider whether your income will rise above £100,000 again next year</li>
</ul>

<div class="highlight">
  <strong>The most common mistake:</strong> Waiting until the last week of the tax year. SIPP providers can take 3-5 working days to process contributions. 28 March 2027 is your real deadline.
</div>

<p>Source: <a href="https://www.gov.uk/income-tax-rates">GOV.UK — Income Tax rates 2026-27</a> · <a href="https://www.gov.uk/tax-on-your-private-pension/annual-allowance">GOV.UK — Pension annual allowance</a></p>

  <div class="disclaimer"><strong>General information only.</strong> This document is for general guidance only and does not constitute financial, tax, or legal advice. TaxCheckNow is not a regulated financial adviser. Always consult a qualified UK tax adviser before making pension or investment decisions. Based on HMRC guidance April 2026. HMRC.gov.uk is the authoritative source for all tax rules.</div>
  <div class="nav-row no-print"><span>TaxCheckNow · taxchecknow.com</span><span>File 08 of 8 · Allowance Sniper Action Plan</span></div>
</body>
</html>`;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
