export default function Page() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Accountant Brief — TaxCheckNow</title>
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
    <p class="file-label">Allowance Sniper · File 05 of 8</p>
    <h1>Your Accountant Brief</h1>
    <p class="subtitle">Print this and take it to your next meeting.</p>
  </div>
  <div class="deadline-bar">🔴 Tax year end deadline: 5 April 2027 · Act before this date to escape the 60% trap</div>
  <button class="print-btn no-print" onclick="window.print()">⬇ Save as PDF</button>
  
<div class="info-box">
  <strong>How to use this brief:</strong> Print or forward to your accountant before your next meeting. It gives them the context they need to confirm your ANI and agree the most efficient escape route.
</div>

<h2>Client Tax Trap Status Summary</h2>
<table>
  <tr><th>Item</th><th>Detail</th></tr>
  <tr><td>Issue</td><td>Personal allowance taper — 60% effective marginal rate</td></tr>
  <tr><td>Taper start</td><td>£100,000 adjusted net income</td></tr>
  <tr><td>Taper end</td><td>£125,140 adjusted net income</td></tr>
  <tr><td>Personal allowance 2026-27</td><td>£12,570 (before taper)</td></tr>
  <tr><td>Tax year end</td><td><strong>5 April 2027</strong></td></tr>
  <tr><td>Pension annual allowance</td><td>£60,000 for most taxpayers</td></tr>
</table>

<h2>Five Questions to Raise</h2>

<div class="action-box">
  <h3>Question 1</h3>
  <p>"What is my exact adjusted net income for 2026-27 after all income sources and any pension contributions already made?"</p>
  <p><em style="color:#9ca3af;">Why: The trap operates on ANI, not gross salary. Need the correct figure to calculate the escape contribution.</em></p>
</div>

<h3>Question 2</h3>
<p>"What is the most efficient route for me — personal SIPP, salary sacrifice, or Gift Aid?"</p>
<p><em>Why: The right route depends on employer setup, annual allowance remaining, and income structure.</em></p>

<h3>Question 3</h3>
<p>"Do I have unused annual allowance from previous years that I can carry forward?"</p>
<p><em>Why: If the gross contribution needed exceeds this year's remaining allowance, carry-forward may allow a larger contribution.</em></p>

<h3>Question 4</h3>
<p>"Do I need to file self-assessment to claim the additional higher-rate pension relief?"</p>
<p><em>Why: Basic rate relief is claimed automatically by the SIPP provider. Additional relief at 20-25% must be claimed via self-assessment.</em></p>

<h3>Question 5</h3>
<p>"Is my income approaching the £200,000 threshold income test for the tapered annual allowance?"</p>
<p><em>Why: Earnings above £200,000 can trigger a reduced annual allowance — creating a pension planning constraint alongside the trap.</em></p>

<h2>Action Items to Agree</h2>
<ul class="checklist">
  <li>Confirm exact ANI figure for 2026-27</li>
  <li>Confirm pension contributions already made this year</li>
  <li>Agree the escape route: SIPP / salary sacrifice / Gift Aid / combination</li>
  <li>Agree the gross contribution amount</li>
  <li>Agree deadline for making the contribution</li>
  <li>Confirm self-assessment process for claiming extra relief</li>
</ul>

<p>Source: <a href="https://www.gov.uk/income-tax-rates">GOV.UK — Income Tax rates 2026-27</a> · <a href="https://www.gov.uk/guidance/adjusted-net-income">GOV.UK — Adjusted net income</a> · Last verified April 2026</p>

  <div class="disclaimer"><strong>General information only.</strong> This document is for general guidance only and does not constitute financial, tax, or legal advice. TaxCheckNow is not a regulated financial adviser. Always consult a qualified UK tax adviser before making pension or investment decisions. Based on HMRC guidance April 2026. HMRC.gov.uk is the authoritative source for all tax rules.</div>
  <div class="nav-row no-print"><span>TaxCheckNow · taxchecknow.com</span><span>File 05 of 8 · Allowance Sniper</span></div>
</body>
</html>`;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
