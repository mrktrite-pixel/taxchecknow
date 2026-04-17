export default function Page() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your SIPP Escape Calculation — TaxCheckNow</title>
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
    <p class="file-label">Allowance Sniper · File 02 of 8</p>
    <h1>Your SIPP Escape Calculation</h1>
    <p class="subtitle">The exact gross contribution needed and the net cost after tax relief.</p>
  </div>
  <div class="deadline-bar">🔴 Tax year end deadline: 5 April 2027 · Act before this date to escape the 60% trap</div>
  <button class="print-btn no-print" onclick="window.print()">⬇ Save as PDF</button>
  
<h2>The Escape Mechanism</h2>
<p>A personal SIPP contribution reduces your adjusted net income by the gross contribution amount. This can restore lost personal allowance at a rate of 50p per £1 contributed into the taper zone.</p>

<div class="action-box">
  <h3>The Maths — How It Works</h3>
  <p>ANI before contribution: £110,000</p>
  <p>Gross SIPP contribution: £10,000</p>
  <p>ANI after contribution: £100,000 (escaped)</p>
  <p>Personal allowance restored: £12,570 (full)</p>
</div>

<h2>Your Contribution Calculation</h2>
<table>
  <tr><th>Starting ANI</th><th>Gross contribution needed</th><th>Net payment (80%)</th><th>Extra relief via SA</th><th>Net cost</th></tr>
  <tr><td>£105,000</td><td>£5,000</td><td>£4,000</td><td>£1,000</td><td>£3,000</td></tr>
  <tr><td>£110,000</td><td>£10,000</td><td>£8,000</td><td>£2,000</td><td>£6,000</td></tr>
  <tr><td>£115,000</td><td>£15,000</td><td>£12,000</td><td>£3,000</td><td>£9,000</td></tr>
  <tr><td>£120,000</td><td>£20,000</td><td>£16,000</td><td>£4,000</td><td>£12,000</td></tr>
  <tr><td>£125,140</td><td>£25,140</td><td>£20,112</td><td>£5,028</td><td>£15,084</td></tr>
</table>

<div class="info-box">
  <strong>How relief-at-source works:</strong><br><br>
  You pay 80% (the net amount). The SIPP provider claims 20% basic rate relief from HMRC and adds it to your pension.<br><br>
  You then claim the additional 20% higher-rate relief via self-assessment. This is the "extra relief via SA" column above.
</div>

<h2>The Annual Allowance Check</h2>
<div class="warning-box">
  <strong>Important:</strong> The pension annual allowance is £60,000 for 2026-27 (or 100% of your earnings if lower). Include all pension contributions — employer and personal — when checking you are within the limit.
</div>

<h2>Carry-Forward</h2>
<p>If you have unused annual allowance from the previous three tax years, you may be able to carry it forward. This allows larger contributions than £60,000 in a single year. Discuss with your accountant.</p>

<h2>What to Do</h2>
<ul class="checklist">
  <li>Confirm your exact ANI figure for 2026-27</li>
  <li>Calculate the gross contribution needed (ANI minus £100,000)</li>
  <li>Check total pension contributions do not exceed annual allowance</li>
  <li>Make the net payment (80% of gross) to your SIPP before 5 April 2027</li>
  <li>Claim the additional relief via self-assessment by 31 January 2028</li>
</ul>

<p>Source: <a href="https://www.gov.uk/tax-on-your-private-pension/annual-allowance">GOV.UK — Pension annual allowance</a> · <a href="https://www.gov.uk/guidance/adjusted-net-income">GOV.UK — Adjusted net income</a></p>

  <div class="disclaimer"><strong>General information only.</strong> This document is for general guidance only and does not constitute financial, tax, or legal advice. TaxCheckNow is not a regulated financial adviser. Always consult a qualified UK tax adviser before making pension or investment decisions. Based on HMRC guidance April 2026. HMRC.gov.uk is the authoritative source for all tax rules.</div>
  <div class="nav-row no-print"><span>TaxCheckNow · taxchecknow.com</span><span>File 02 of 8 · Allowance Sniper</span></div>
</body>
</html>`;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
