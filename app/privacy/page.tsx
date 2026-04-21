import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — TaxCheckNow",
  description: "How TaxCheckNow collects, uses, and protects your personal data.",
  robots: { index: true, follow: true },
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-neutral-200 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="font-serif text-lg font-bold text-neutral-950">TaxCheckNow</Link>
          <span className="font-mono text-xs text-neutral-400">Last updated: April 2026</span>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">Legal</p>
          <h1 className="font-serif text-3xl font-bold text-neutral-950 mb-2">Privacy Policy</h1>
          <p className="text-sm text-neutral-500">Effective date: 1 April 2026 · Last updated: 21 April 2026</p>
        </div>

        <p className="text-neutral-700 leading-relaxed">
          TaxCheckNow (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates taxchecknow.com. This policy explains what data we collect,
          how we use it, and your rights. We are committed to protecting your privacy and complying with
          applicable data protection laws including the UK GDPR, Australian Privacy Act 1988, and CCPA.
        </p>

        {[
          {
            title: "1. What data we collect",
            content: [
              "Email address — when you save your result or purchase a product",
              "Calculator answers — your inputs to our tax position calculators (income bands, status selections). We do not collect exact income figures.",
              "Payment data — processed entirely by Stripe. We never see or store your card details.",
              "Session data — anonymous identifiers to link your calculator session to your purchase",
              "Usage data — page views, browser type, country via Vercel analytics. No cross-site tracking.",
            ],
          },
          {
            title: "2. How we use your data",
            content: [
              "To deliver your purchased product via email (Resend)",
              "To generate your personalised tax assessment using Claude AI (Anthropic)",
              "To send deadline reminder emails you have opted into at purchase",
              "To improve our calculators and products — aggregated, never individually identifiable",
              "To comply with legal obligations",
            ],
          },
          {
            title: "3. Third parties we share data with",
            content: [
              "Stripe — payment processing. Stripe's privacy policy: stripe.com/privacy",
              "Resend — transactional email delivery. Resend's privacy policy: resend.com/privacy",
              "Supabase — database storage (purchase records, assessments). Hosted in AWS.",
              "Anthropic (Claude AI) — generates your personalised assessment. Your inputs are sent to Claude to produce your report. Anthropic's privacy policy: anthropic.com/privacy",
              "Vercel — website hosting and analytics. Vercel's privacy policy: vercel.com/legal/privacy-policy",
            ],
          },
          {
            title: "4. Data retention",
            content: [
              "Purchase records: retained for 7 years for tax and accounting purposes",
              "Assessment data: retained for 2 years so you can access your report",
              "Email addresses: retained until you unsubscribe or request deletion",
              "Calculator session data: retained for 90 days then deleted",
            ],
          },
          {
            title: "5. Cookies",
            content: [
              "We use essential cookies only — required for the site to function",
              "We use Vercel analytics (privacy-first, no cross-site tracking, no fingerprinting)",
              "We do not use advertising cookies or third-party tracking pixels",
              "You can disable cookies in your browser settings — the site will still function",
            ],
          },
          {
            title: "6. Your rights",
            content: [
              "Access: request a copy of the data we hold about you",
              "Correction: request we correct inaccurate data",
              "Deletion: request we delete your data (subject to legal retention requirements)",
              "Portability: request your data in a machine-readable format",
              "Objection: object to processing for direct marketing at any time",
              "To exercise any right: email privacy@taxchecknow.com",
            ],
          },
          {
            title: "7. Security",
            content: [
              "All data is encrypted in transit (HTTPS/TLS)",
              "Database access is restricted to authenticated services only",
              "Payment data is handled entirely by Stripe — PCI DSS Level 1 certified",
              "We conduct regular reviews of our data practices",
            ],
          },
          {
            title: "8. International transfers",
            content: [
              "Our services are provided globally. Data may be processed in the US (Stripe, Anthropic, Vercel) and EU (Supabase options).",
              "Where data is transferred outside your country, we ensure appropriate safeguards are in place.",
            ],
          },
          {
            title: "9. Children",
            content: [
              "TaxCheckNow is not directed at children under 16. We do not knowingly collect data from children.",
            ],
          },
          {
            title: "10. Changes to this policy",
            content: [
              "We may update this policy from time to time. Material changes will be communicated by email to registered users.",
              "The effective date at the top of this page indicates when it was last updated.",
            ],
          },
          {
            title: "11. Contact",
            content: [
              "For privacy questions or to exercise your rights: privacy@taxchecknow.com",
              "Response time: within 30 days",
            ],
          },
        ].map((section) => (
          <div key={section.title} className="border-t border-neutral-100 pt-6">
            <h2 className="font-serif text-xl font-bold text-neutral-950 mb-3">{section.title}</h2>
            <ul className="space-y-2">
              {section.content.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-neutral-700 leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="border-t border-neutral-200 pt-6 flex gap-6 text-xs text-neutral-500">
          <Link href="/terms" className="hover:text-neutral-950 transition">Terms of Service</Link>
          <Link href="/" className="hover:text-neutral-950 transition">← Back to TaxCheckNow</Link>
        </div>
      </main>
    </div>
  );
}
