export default function Page() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SIPP vs Salary Sacrifice Guide — TaxCheckNow</title>
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
    <p class="file-label">Allowance Sniper · File 03 of 8</p>
    <h1>SIPP vs Salary Sacrifice Guide</h1>
    <p class="subtitle">Which route works for your employer and situation.</p>
  </div>
  <div class="deadline-bar">🔴 Tax year end deadline: 5 April 2027 · Act before this date to escape the 60% trap</div>
  <button class="print-btn no-print" onclick="window.print()">⬇ Save as PDF</button>
  
<h2>Two Routes to the Same Goal</h2>
<p>Both personal SIPP contributions and salary sacrifice reduce adjusted net income. The right choice depends on your employer, your income structure, and your timeline.</p>

<h2>Comparison</h2>
<table>
  <tr><th>Factor</th><th>Personal SIPP</th><th>Salary Sacrifice</th></tr>
  <tr><td>ANI reduction</td><td>Yes — via tax relief</td><td>Yes — reduces gross salary</td></tr>
  <tr><td>Employer required</td><td>No — direct to SIPP</td><td>Yes — employer must offer it</td></tr>
  <tr><td>NI saving (employee)</td><td>No</td><td>Yes — 2% on contributions</td></tr>
  <tr><td>NI saving (employer)</td><td>No</td><td>Yes — 13.8%</td></tr>
  <tr><td>Self-assessment needed</td><td>Yes — to claim extra relief</td><td>No — relief automatic</td></tr>
  <tr><td>Flexibility</td><td>High — contribute any time</td><td>Requires HR agreement</td></tr>
  <tr><td>Best for</td><td>Self-employed, or where employer does not offer SS</td><td>Employees with cooperative employer</td></tr>
</table>

<h2>If Your Employer Offers Salary Sacrifice</h2>
<div class="action-box">
  <h3>How to use it to escape the trap</h3>
  <p>1. Calculate how much salary to sacrifice (gross amount = ANI minus £100,000)</p>
  <p>2. Submit a salary sacrifice arrangement request to HR</p>
  <p>3. The sacrifice reduces your contracted salary — and therefore your ANI</p>
  <p>4. No self-assessment claim needed — relief is automatic</p>
  <p>5. You also save employee NI at 2% on the sacrificed amount</p>
</div>

<div class="warning-box">
  <strong>Timing risk:</strong> Salary sacrifice requires an agreement with your employer before the income is earned. You cannot sacrifice salary retrospectively. Plan before the bonus or income arrives.
</div>

<h2>If You Must Use Personal SIPP</h2>
<ol>
  <li>Open a SIPP if you do not already have one (see File 01 for recommendations)</li>
  <li>Make the net contribution (80% of your gross target) before 5 April 2027</li>
  <li>Keep the contribution confirmation as evidence for self-assessment</li>
  <li>Include the gross contribution on your 2026-27 self-assessment return</li>
  <li>Claim the additional 20% higher-rate relief</li>
</ol>

<h2>The Question to Ask HR This Week</h2>
<div class="info-box">
  "Does our company offer salary sacrifice for pension contributions? If so, what is the process to set this up, and by when must I request it for the current tax year?"
</div>

<p>Source: <a href="https://www.gov.uk/tax-on-your-private-pension/overview">GOV.UK — Tax on your private pension</a></p>

  <div class="disclaimer"><strong>General information only.</strong> This document is for general guidance only and does not constitute financial, tax, or legal advice. TaxCheckNow is not a regulated financial adviser. Always consult a qualified UK tax adviser before making pension or investment decisions. Based on HMRC guidance April 2026. HMRC.gov.uk is the authoritative source for all tax rules.</div>
  <div class="nav-row no-print"><span>TaxCheckNow · taxchecknow.com</span><span>File 03 of 8 · Allowance Sniper</span></div>
</body>
</html>`;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
