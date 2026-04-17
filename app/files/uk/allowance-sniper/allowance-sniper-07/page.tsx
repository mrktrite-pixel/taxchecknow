export default function Page() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bonus Timing Guide — TaxCheckNow</title>
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
    <p class="file-label">Allowance Sniper Action Plan · File 07 of 8</p>
    <h1>Bonus Timing Guide</h1>
    <p class="subtitle">When to take bonuses to minimise trap exposure.</p>
  </div>
  <div class="deadline-bar">🔴 Tax year end deadline: 5 April 2027 · Act before this date to escape the 60% trap</div>
  <button class="print-btn no-print" onclick="window.print()">⬇ Save as PDF</button>
  
<h2>Why Bonus Timing Matters</h2>
<p>A bonus paid in the wrong month can push ANI into or deeper into the 60% trap. A bonus paid in the right context — with a SIPP contribution already in place — can be entirely neutral.</p>

<h2>The Problem</h2>
<div class="warning-box">
  <strong>Example:</strong><br>
  Base salary £95,000. ANI before bonus: £95,000 — CLEAR of trap.<br>
  Bonus paid: £20,000. ANI with bonus: £115,000 — DEEP IN TRAP.<br>
  Hidden extra tax cost: £1,500.<br>
  Had no SIPP contribution been made before year end, this £1,500 is lost.
</div>

<h2>The Solution — Two Approaches</h2>

<h3>Approach 1 — Make the SIPP contribution first</h3>
<ol>
  <li>Receive the bonus (ANI rises above £100,000)</li>
  <li>Calculate the gross SIPP contribution needed</li>
  <li>Make the contribution before 5 April</li>
  <li>ANI falls back to or below £100,000</li>
  <li>No hidden tax cost</li>
</ol>

<h3>Approach 2 — Salary sacrifice the bonus</h3>
<div class="info-box">
  Some employers allow bonus sacrifice — directing all or part of a bonus into the pension rather than taking it as cash.<br><br>
  This must be agreed <strong>before the bonus is contractually due</strong>. You cannot sacrifice a bonus after it has been promised to you in cash.
</div>

<h2>Bonus Timing Options</h2>
<table>
  <tr><th>Scenario</th><th>Risk</th><th>Best Action</th></tr>
  <tr><td>Bonus before SIPP contribution</td><td>ANI spikes into trap</td><td>Make SIPP contribution before 5 April</td></tr>
  <tr><td>Bonus after SIPP contribution in place</td><td>Low — ANI already managed</td><td>No further action needed</td></tr>
  <tr><td>Bonus can be sacrificed</td><td>None if handled correctly</td><td>Sacrifice into pension before bonus is due</td></tr>
  <tr><td>Bonus deferred to next tax year</td><td>Kicks the issue forward</td><td>Only useful if next year will be lower income</td></tr>
</table>

<h2>What to Ask Your Employer</h2>
<ul class="checklist">
  <li>Can I sacrifice all or part of my bonus into my pension?</li>
  <li>By when must I request a bonus sacrifice arrangement?</li>
  <li>Will the bonus show as income on my P60 if sacrificed?</li>
</ul>

<p>Source: <a href="https://www.gov.uk/guidance/adjusted-net-income">GOV.UK — Adjusted net income</a></p>

  <div class="disclaimer"><strong>General information only.</strong> This document is for general guidance only and does not constitute financial, tax, or legal advice. TaxCheckNow is not a regulated financial adviser. Always consult a qualified UK tax adviser before making pension or investment decisions. Based on HMRC guidance April 2026. HMRC.gov.uk is the authoritative source for all tax rules.</div>
  <div class="nav-row no-print"><span>TaxCheckNow · taxchecknow.com</span><span>File 07 of 8 · Allowance Sniper Action Plan</span></div>
</body>
</html>`;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
