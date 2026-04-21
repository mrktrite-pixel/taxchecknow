import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — TaxCheckNow",
  description: "Terms of service for TaxCheckNow — tax position check tools and personalised reports.",
  robots: { index: true, follow: true },
};

export default function TermsOfService() {
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
          <h1 className="font-serif text-3xl font-bold text-neutral-950 mb-2">Terms of Service</h1>
          <p className="text-sm text-neutral-500">Effective date: 1 April 2026 · Last updated: 21 April 2026</p>
        </div>

        <p className="text-neutral-700 leading-relaxed">
          By using TaxCheckNow (&quot;Service&quot;) at taxchecknow.com, you agree to these terms.
          Please read them carefully. If you do not agree, do not use the Service.
        </p>

        {[
          {
            title: "1. What TaxCheckNow is",
            items: [
              "TaxCheckNow provides free tax position calculators and paid personalised tax reference documents.",
              "Our tools help you understand your position relative to published tax rules from HMRC (UK), ATO (Australia), IRD (New Zealand), and IRS (USA).",
              "TaxCheckNow is an information service. We are not a tax adviser, accountant, financial adviser, or law firm.",
              "Nothing on this site or in our products constitutes tax, financial, or legal advice.",
            ],
          },
          {
            title: "2. Not professional advice",
            items: [
              "Our calculators produce estimates based on the information you provide and published authority guidance.",
              "Results are indicative only. Your actual tax position depends on facts specific to your circumstances that our calculator cannot fully assess.",
              "Always consult a qualified tax adviser or accountant before making financial decisions.",
              "TaxCheckNow is not liable for any financial loss arising from reliance on our calculators or reports.",
            ],
          },
          {
            title: "3. Purchased products",
            items: [
              "Paid products are digital documents delivered by email and/or accessible via a link.",
              "Products are personalised reference documents — not professional advice.",
              "Delivery is by email within minutes of confirmed payment. If you do not receive your product within 1 hour, contact hello@taxchecknow.com.",
              "Products are licensed for personal use only. You may not resell, redistribute, or publish our documents.",
            ],
          },
          {
            title: "4. Refund policy",
            items: [
              "Because our products are digital and personalised, we do not offer refunds once the document has been generated and delivered.",
              "If you have not received your product due to a technical error, contact us within 48 hours and we will resolve it.",
              "If the product contains a material error (factually incorrect information), we will provide a corrected version or refund at our discretion.",
              "Contact: hello@taxchecknow.com",
            ],
          },
          {
            title: "5. Accuracy and currency of information",
            items: [
              "We verify our content against published authority sources and display the last verified date on every page.",
              "Tax rules change. We update our content regularly but cannot guarantee real-time accuracy.",
              "Always verify thresholds and rates directly with HMRC, ATO, IRD, or IRS before taking action.",
              "The last verified date on each page indicates when we last reviewed the content.",
            ],
          },
          {
            title: "6. Intellectual property",
            items: [
              "All content on TaxCheckNow — including calculators, reports, templates, and copy — is owned by TaxCheckNow.",
              "You may not copy, reproduce, or publish our content without written permission.",
              "Purchased documents are licensed for your personal use only.",
            ],
          },
          {
            title: "7. Acceptable use",
            items: [
              "You must not use TaxCheckNow for unlawful purposes.",
              "You must not attempt to reverse-engineer, scrape, or automate our calculators.",
              "You must not submit false information to our calculators.",
              "We reserve the right to refuse service to anyone at any time.",
            ],
          },
          {
            title: "8. Limitation of liability",
            items: [
              "To the maximum extent permitted by law, TaxCheckNow is not liable for any indirect, incidental, or consequential loss arising from use of the Service.",
              "Our total liability to you for any claim is limited to the amount you paid for the relevant product.",
              "Nothing in these terms limits liability for fraud, death, or personal injury caused by negligence.",
            ],
          },
          {
            title: "9. Payments",
            items: [
              "Payments are processed by Stripe. By purchasing, you agree to Stripe's terms of service.",
              "Prices are displayed in the currency relevant to your market (AUD, GBP, USD, NZD).",
              "All prices include applicable taxes where required.",
            ],
          },
          {
            title: "10. Changes to these terms",
            items: [
              "We may update these terms from time to time.",
              "Continued use of the Service after changes constitutes acceptance of the new terms.",
              "Material changes will be communicated by email to registered users.",
            ],
          },
          {
            title: "11. Governing law",
            items: [
              "For Australian users: these terms are governed by the laws of Western Australia, Australia.",
              "For UK users: these terms are governed by the laws of England and Wales.",
              "For US users: these terms are governed by the laws of Delaware, USA.",
              "For all users: you agree to the exclusive jurisdiction of the relevant courts.",
            ],
          },
          {
            title: "12. Contact",
            items: [
              "For any questions about these terms: hello@taxchecknow.com",
              "For privacy matters: privacy@taxchecknow.com",
            ],
          },
        ].map((section) => (
          <div key={section.title} className="border-t border-neutral-100 pt-6">
            <h2 className="font-serif text-xl font-bold text-neutral-950 mb-3">{section.title}</h2>
            <ul className="space-y-2">
              {section.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-neutral-700 leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="border-t border-neutral-200 pt-6 flex gap-6 text-xs text-neutral-500">
          <Link href="/privacy" className="hover:text-neutral-950 transition">Privacy Policy</Link>
          <Link href="/" className="hover:text-neutral-950 transition">← Back to TaxCheckNow</Link>
        </div>
      </main>
    </div>
  );
}
