export default function Page() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gift Aid Alternative — TaxCheckNow</title>
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
    <p class="file-label">Allowance Sniper · File 04 of 8</p>
    <h1>Gift Aid Alternative</h1>
    <p class="subtitle">How Gift Aid reduces ANI alongside or instead of SIPP.</p>
  </div>
  <div class="deadline-bar">🔴 Tax year end deadline: 5 April 2027 · Act before this date to escape the 60% trap</div>
  <button class="print-btn no-print" onclick="window.print()">⬇ Save as PDF</button>
  
<h2>Gift Aid and the 60% Trap</h2>
<p>Gift Aid donations to registered UK charities can also reduce adjusted net income — the same way pension contributions do. This provides an additional or alternative route to escape the trap.</p>

<h2>How Gift Aid Reduces ANI</h2>
<div class="action-box">
  <h3>The Mechanism</h3>
  <p>You donate £800 net to a charity. The charity claims 20% basic rate relief from HMRC (£200), making the gross donation £1,000.</p>
  <p>Your ANI is reduced by the gross donation amount: £1,000.</p>
  <p>You claim the additional 20% higher-rate relief (£200) via self-assessment.</p>
</div>

<h2>Gift Aid vs SIPP — Key Differences</h2>
<table>
  <tr><th>Factor</th><th>Gift Aid</th><th>Personal SIPP</th></tr>
  <tr><td>ANI reduction</td><td>Gross donation amount</td><td>Gross contribution amount</td></tr>
  <tr><td>Money goes to</td><td>Charity</td><td>Your pension</td></tr>
  <tr><td>Self-assessment needed</td><td>Yes — to claim extra relief</td><td>Yes — to claim extra relief</td></tr>
  <tr><td>Annual limit</td><td>None (must be genuine donations)</td><td>£60,000 annual allowance</td></tr>
  <tr><td>Flexibility</td><td>Donate to any eligible charity</td><td>Invest for retirement</td></tr>
</table>

<h2>Combined Strategy</h2>
<p>In some cases, a combination of pension contribution and Gift Aid is the most efficient approach — particularly if the annual allowance has already been used or is limited.</p>

<div class="info-box">
  <strong>Example:</strong><br>
  ANI of £110,000. Annual allowance mostly used.<br>
  SIPP contribution: £5,000 gross → ANI reduced to £105,000<br>
  Gift Aid donation: £4,000 gross → ANI reduced to £101,000<br>
  Still in the trap but significantly less exposure.
</div>

<div class="warning-box">
  <strong>The Gift Aid declaration rule:</strong> You must have paid enough income tax and/or capital gains tax to cover the basic rate tax the charity claims. At income above £100,000, this is almost always satisfied.
</div>

<h2>What to Check</h2>
<ul class="checklist">
  <li>Do I already make Gift Aid donations? If yes, are these included in my ANI calculation?</li>
  <li>Is my annual pension allowance fully used? Gift Aid has no annual limit.</li>
  <li>Can a combination of SIPP and Gift Aid pull ANI below £100,000?</li>
  <li>Am I claiming Gift Aid additional relief on my self-assessment return?</li>
</ul>

<p>Source: <a href="https://www.gov.uk/donating-to-charity/gift-aid">GOV.UK — Gift Aid</a> · <a href="https://www.gov.uk/guidance/adjusted-net-income">GOV.UK — Adjusted net income</a></p>

  <div class="disclaimer"><strong>General information only.</strong> This document is for general guidance only and does not constitute financial, tax, or legal advice. TaxCheckNow is not a regulated financial adviser. Always consult a qualified UK tax adviser before making pension or investment decisions. Based on HMRC guidance April 2026. HMRC.gov.uk is the authoritative source for all tax rules.</div>
  <div class="nav-row no-print"><span>TaxCheckNow · taxchecknow.com</span><span>File 04 of 8 · Allowance Sniper</span></div>
</body>
</html>`;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
