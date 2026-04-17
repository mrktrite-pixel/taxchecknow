// ── ICS Calendar File Generator ──────────────────────────────────────────
// Generates .ics files for MTD deadline reminders
// Works with Apple Calendar, Google Calendar, Outlook

function formatDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function makeEvent(params: {
  uid: string;
  summary: string;
  description: string;
  date: Date;
  allDay?: boolean;
}): string {
  const { uid, summary, description, date, allDay } = params;
  const dtStamp = formatDate(new Date());

  if (allDay) {
    const dateStr = date.toISOString().split("T")[0].replace(/-/g, "");
    return [
      "BEGIN:VEVENT",
      `UID:${uid}@taxchecknow.com`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;VALUE=DATE:${dateStr}`,
      `DTEND;VALUE=DATE:${dateStr}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    ].join("\r\n");
  }

  return [
    "BEGIN:VEVENT",
    `UID:${uid}@taxchecknow.com`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${formatDate(date)}`,
    `DTEND:${formatDate(new Date(date.getTime() + 3600000))}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
  ].join("\r\n");
}

export function generateMTDCalendar(params: {
  firstName: string;
  tier: "67" | "127";
  softwareRec?: string;
}): string {
  const { firstName, tier, softwareRec = "your MTD software" } = params;
  const name = firstName !== "there" ? firstName : "You";
  const isAction = tier === "127";

  const events: string[] = [];

  // ── ACTION REMINDERS (£127 only) ──────────────────────────────────────
  if (isAction) {
    const week1 = new Date("2026-06-20T09:00:00Z");
    events.push(makeEvent({
      uid: "mtd-week1",
      summary: `MTD: Set up ${softwareRec}`,
      description: `${name} — set up your MTD software and connect your bank feed this week.\n\nThis is your most urgent action.\n\nSee your MTD Action Plan at taxchecknow.com`,
      date: week1,
    }));

    const week2 = new Date("2026-06-27T09:00:00Z");
    events.push(makeEvent({
      uid: "mtd-week2",
      summary: "MTD: Register with HMRC",
      description: `${name} — register for MTD at gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax\n\nTakes 10 minutes. Do it today.\n\nSee File 03 in your MTD Action Plan.`,
      date: week2,
    }));

    const week3 = new Date("2026-07-04T09:00:00Z");
    events.push(makeEvent({
      uid: "mtd-week3",
      summary: "MTD: Reconcile Q1 records",
      description: `${name} — enter and reconcile all Q1 transactions (6 April to 30 June 2026).\n\nYour Q1 submission is due 7 August 2026.\n\nSee File 07 in your MTD Action Plan.`,
      date: week3,
    }));

    const week4 = new Date("2026-07-25T09:00:00Z");
    events.push(makeEvent({
      uid: "mtd-week4",
      summary: "MTD: Submit Q1 — deadline 7 August",
      description: `${name} — submit your Q1 quarterly update through your MTD software.\n\nDeadline: 7 August 2026. Do not miss this.\n\nSee File 07 — First Submission Checklist.`,
      date: week4,
    }));
  }

  // ── MTD QUARTERLY DEADLINES (both tiers) ─────────────────────────────
  events.push(makeEvent({
    uid: "mtd-q1-deadline",
    summary: "🔴 MTD Q1 Deadline — 7 August 2026",
    description: `${name} — Q1 quarterly submission due today.\nCovers: 6 April to 30 June 2026.\nSubmit through your MTD software — NOT the HMRC portal.\n\nSource: HMRC.gov.uk · taxchecknow.com`,
    date: new Date("2026-08-07T08:00:00Z"),
    allDay: true,
  }));

  events.push(makeEvent({
    uid: "mtd-q2-deadline",
    summary: "MTD Q2 Deadline — 7 November 2026",
    description: `${name} — Q2 quarterly submission due today.\nCovers: 1 July to 30 September 2026.\nSubmit through your MTD software.\n\nSource: HMRC.gov.uk · taxchecknow.com`,
    date: new Date("2026-11-07T08:00:00Z"),
    allDay: true,
  }));

  events.push(makeEvent({
    uid: "mtd-q3-deadline",
    summary: "MTD Q3 Deadline — 7 February 2027",
    description: `${name} — Q3 quarterly submission due today.\nCovers: 1 October to 31 December 2026.\nSubmit through your MTD software.\n\nSource: HMRC.gov.uk · taxchecknow.com`,
    date: new Date("2027-02-07T08:00:00Z"),
    allDay: true,
  }));

  events.push(makeEvent({
    uid: "mtd-q4-deadline",
    summary: "MTD Q4 Deadline — 7 May 2027",
    description: `${name} — Q4 quarterly submission due today.\nCovers: 1 January to 31 March 2027.\nSubmit through your MTD software.\n\nSource: HMRC.gov.uk · taxchecknow.com`,
    date: new Date("2027-05-07T08:00:00Z"),
    allDay: true,
  }));

  events.push(makeEvent({
    uid: "mtd-final-declaration",
    summary: "MTD Final Declaration — 31 January 2028",
    description: `${name} — MTD final declaration due today.\nThis replaces your SA100 self-assessment return.\nMust be filed through MTD software — not the HMRC portal.\n\nSource: HMRC.gov.uk · taxchecknow.com`,
    date: new Date("2028-01-31T08:00:00Z"),
    allDay: true,
  }));

  // ── ASSEMBLE ICS FILE ─────────────────────────────────────────────────
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TaxCheckNow//MTD Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:MTD Deadlines ${new Date().getFullYear()}`,
    "X-WR-TIMEZONE:Europe/London",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return ics;
}

export function downloadICS(ics: string, filename: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
