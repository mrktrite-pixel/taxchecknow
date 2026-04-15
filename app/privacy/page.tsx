import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | SuperTaxCheck",
  description: "How SuperTaxCheck collects, uses and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <nav className="border-b border-neutral-200 bg-white px-6 py-3.5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="font-serif text-lg font-bold text-neutral-950">SuperTaxCheck</Link>
          <Link href="/" className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← Home</Link>
        </div>
      </nav>
      <main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">Last updated: April 2026</p>
          <h1 className="mt-2 font-serif text-4xl font-bold text-neutral-950">Privacy Policy</h1>
        </div>

        {[
          {
            title: "Who we are",
            body: "SuperTaxCheck (supertaxcheck.com.au) provides decision-support tools for Australian SMSF trustees. We are committed to protecting your personal information in accordance with the Australian Privacy Principles (APPs) contained in the Privacy Act 1988 (Cth).",
          },
          {
            title: "What information we collect",
            body: "We collect information you provide directly: your email address, approximate super balance, and any inputs you enter into our calculators. We also collect standard website usage data (pages visited, time on site) via analytics. We do not collect your name, address, tax file number, or SMSF details unless you voluntarily provide them.",
          },
          {
            title: "How we use your information",
            body: "We use your email to send you the personalised Div 296 risk summary you requested, and deadline reminders before June 30 2026. We use calculator inputs solely to generate your personalised result. We do not sell your information to third parties. We do not share your information with financial advisers, brokers, or lead generation networks.",
          },
          {
            title: "Email communications",
            body: "If you provide your email address, you may receive a personalised summary and a small number of deadline reminders as June 30 2026 approaches. Every email includes an unsubscribe link. We comply with the Spam Act 2003 (Cth).",
          },
          {
            title: "Data storage and security",
            body: "Your data is stored securely in Supabase (Sydney region, ap-southeast-2). We use industry-standard encryption in transit and at rest. We retain email and calculator data for 12 months after your last interaction, after which it is deleted.",
          },
          {
            title: "Cookies and analytics",
            body: "We use minimal analytics to understand how visitors use the site. We do not use advertising cookies or tracking pixels. We do not use Google Ads, Facebook Pixel, or similar advertising tracking tools.",
          },
          {
            title: "Your rights",
            body: "You have the right to access, correct, or delete your personal information at any time. To exercise these rights, contact us at hello@supertaxcheck.com.au. We will respond within 30 days.",
          },
          {
            title: "Contact",
            body: "For privacy enquiries: hello@supertaxcheck.com.au",
          },
        ].map((section) => (
          <div key={section.title}>
            <h2 className="font-serif text-xl font-bold text-neutral-950">{section.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{section.body}</p>
          </div>
        ))}
      </main>
    </div>
  );
}
