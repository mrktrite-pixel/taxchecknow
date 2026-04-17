export default function Page() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ANI Position Assessment — TaxCheckNow</title>
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
    <p class="file-label">Allowance Sniper · File 01 of 8</p>
    <h1>Your ANI Position Assessment</h1>
    <p class="subtitle">Your exact adjusted net income, trap status, and personal allowance remaining.</p>
  </div>
  <div class="deadline-bar">🔴 Tax year end deadline: 5 April 2027 · Act before this date to escape the 60% trap</div>
  <button class="print-btn no-print" onclick="window.print()">⬇ Save as PDF</button>
  
<h2>Your Adjusted Net Income — What It Is and Why It Matters</h2>
<p>The 60% tax trap does not use your payslip salary. It uses <strong>adjusted net income (ANI)</strong> — a specific HMRC calculation that can be reduced by pension contributions and Gift Aid.</p>

<div class="action-box">
  <h3>The Taper Rule — HMRC confirmed</h3>
  <p>Personal allowance of £12,570 tapers by £1 for every £2 of ANI above £100,000.</p>
  <p>At £125,140 ANI: personal allowance is zero.</p>
  <p>Effective marginal rate in the taper zone: 60%</p>
</div>

<h2>What Counts as Your ANI</h2>
<table>
  <tr><th>Included in ANI</th><th>Reduces ANI</th></tr>
  <tr><td>Employment income (salary + bonuses)</td><td>Gross pension contributions</td></tr>
  <tr><td>Self-employment profits</td><td>Gift Aid donations (grossed up)</td></tr>
  <tr><td>UK rental income</td><td>Trading losses</td></tr>
  <tr><td>Dividend income</td><td></td></tr>
  <tr><td>Savings interest</td><td></td></tr>
</table>

<h2>Your Trap Position at a Glance</h2>
<table>
  <tr><th>ANI</th><th>PA remaining</th><th>Effective rate</th><th>Hidden extra tax</th></tr>
  <tr><td>£100,000</td><td>£12,570</td><td>40%</td><td>£0</td></tr>
  <tr><td>£105,000</td><td>£10,070</td><td>60%</td><td>£500</td></tr>
  <tr><td>£110,000</td><td>£7,570</td><td>60%</td><td>£1,000</td></tr>
  <tr><td>£115,000</td><td>£5,070</td><td>60%</td><td>£1,500</td></tr>
  <tr><td>£120,000</td><td>£2,570</td><td>60%</td><td>£2,000</td></tr>
  <tr><td>£125,140</td><td>£0</td><td>60%</td><td>£2,514</td></tr>
</table>

<h2>How to Calculate Your ANI</h2>
<ol>
  <li>Start with your total gross income from all sources</li>
  <li>Add: employer pension contributions if salary sacrifice</li>
  <li>Subtract: gross personal pension contributions</li>
  <li>Subtract: gross Gift Aid donations</li>
  <li>The result is your adjusted net income</li>
</ol>

<div class="highlight">
  <strong>Key point:</strong> Your PAYE tax code may not reflect pension contributions made outside your employer scheme. You may need to claim relief via self-assessment.
</div>

<h2>Your Next Step</h2>
<div class="action-box">
  <h3>Ask your accountant this week</h3>
  <p>"What is my exact adjusted net income for 2026-27 after all income sources and any pension contributions already made?"</p>
</div>

<p>Source: <a href="https://www.gov.uk/guidance/adjusted-net-income">GOV.UK — Adjusted net income guidance</a> · <a href="https://www.gov.uk/income-tax-rates">GOV.UK — Income Tax rates 2026-27</a></p>

  <div class="disclaimer"><strong>General information only.</strong> This document is for general guidance only and does not constitute financial, tax, or legal advice. TaxCheckNow is not a regulated financial adviser. Always consult a qualified UK tax adviser before making pension or investment decisions. Based on HMRC guidance April 2026. HMRC.gov.uk is the authoritative source for all tax rules.</div>
  <div class="nav-row no-print"><span>TaxCheckNow · taxchecknow.com</span><span>File 01 of 8 · Allowance Sniper</span></div>
</body>
</html>`;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
