export default function Page() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Year-by-Year Contribution Schedule — TaxCheckNow</title>
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
    <p class="file-label">Allowance Sniper Action Plan · File 06 of 8</p>
    <h1>Year-by-Year Contribution Schedule</h1>
    <p class="subtitle">Multi-year plan as frozen thresholds affect more people each year.</p>
  </div>
  <div class="deadline-bar">🔴 Tax year end deadline: 5 April 2027 · Act before this date to escape the 60% trap</div>
  <button class="print-btn no-print" onclick="window.print()">⬇ Save as PDF</button>
  
<h2>Why a Multi-Year Plan Matters</h2>
<p>The personal allowance threshold of £100,000 is frozen until April 2031. This means:</p>
<ul>
  <li>More people fall into the trap each year as salaries rise</li>
  <li>Those already in the trap face the same or higher hidden costs unless they act</li>
  <li>The escape contribution needed grows as income rises</li>
</ul>

<div class="action-box">
  <h3>The Frozen Threshold Problem</h3>
  <p>If your salary rises 5% per year:</p>
  <p>2026-27: ANI £110,000 — escape cost: ~£6,000 net</p>
  <p>2027-28: ANI £115,500 — escape cost: ~£9,300 net</p>
  <p>2028-29: ANI £121,275 — escape cost: ~£12,852 net</p>
  <p>Each year you wait: costs more to escape.</p>
</div>

<h2>Year-by-Year Planning Framework</h2>
<table>
  <tr><th>Tax Year</th><th>Action</th><th>Deadline</th></tr>
  <tr><td>2026-27</td><td>Make SIPP contribution to pull ANI below £100,000</td><td>5 April 2027</td></tr>
  <tr><td>2026-27</td><td>Claim extra relief via self-assessment</td><td>31 January 2028</td></tr>
  <tr><td>2027-28</td><td>Review ANI early — check if salary rise has increased exposure</td><td>October 2027</td></tr>
  <tr><td>2027-28</td><td>Make SIPP contribution for 2027-28 year</td><td>5 April 2028</td></tr>
  <tr><td>2028-29 onward</td><td>Annual review — thresholds frozen to April 2031</td><td>Each April</td></tr>
</table>

<h2>When to Review Each Year</h2>
<ol>
  <li><strong>October/November:</strong> Estimate current year ANI. Identify if you will breach £100,000.</li>
  <li><strong>January/February:</strong> Confirm final ANI estimate. Make any remaining SIPP contribution.</li>
  <li><strong>March (2 weeks before year end):</strong> Make the contribution. Allow processing time.</li>
  <li><strong>April–January:</strong> File self-assessment and claim extra relief.</li>
</ol>

<div class="info-box">
  <strong>Important:</strong> Pension contributions must actually be received by the SIPP provider before 5 April. Allow at least 3-5 working days for processing. Do not leave it to the last day.
</div>

<p>Source: <a href="https://www.gov.uk/government/publications/maintaining-income-tax-and-equivalent-national-insurance-contributions-thresholds-until-5-april-2031">GOV.UK — Threshold freeze to April 2031</a></p>

  <div class="disclaimer"><strong>General information only.</strong> This document is for general guidance only and does not constitute financial, tax, or legal advice. TaxCheckNow is not a regulated financial adviser. Always consult a qualified UK tax adviser before making pension or investment decisions. Based on HMRC guidance April 2026. HMRC.gov.uk is the authoritative source for all tax rules.</div>
  <div class="nav-row no-print"><span>TaxCheckNow · taxchecknow.com</span><span>File 06 of 8 · Allowance Sniper Action Plan</span></div>
</body>
</html>`;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
