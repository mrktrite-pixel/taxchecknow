import Link from "next/link";

export const metadata = {
  title: "Terms of Use | SuperTaxCheck",
  description: "Terms and conditions for using SuperTaxCheck decision-support tools.",
};

export default function TermsPage() {
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
          <h1 className="mt-2 font-serif text-4xl font-bold text-neutral-950">Terms of Use</h1>
        </div>

        {[
          {
            title: "General advice warning",
            body: "The information on this website is general in nature and does not constitute personal financial, tax, or legal advice. SuperTaxCheck provides decision-support tools based on publicly available legislation. The output of our calculators is an estimate only. You should always engage a qualified SMSF specialist, tax agent, or financial adviser before making any decision regarding your superannuation, including the cost-base reset election.",
          },
          {
            title: "Not a financial services provider",
            body: "SuperTaxCheck does not hold an Australian Financial Services Licence (AFSL). We do not provide personal financial advice as defined under the Corporations Act 2001 (Cth). Our tools are decision-support aids based on publicly available legislation — specifically the Treasury Laws Amendment (Building a Stronger and Fairer Super System) Act, enacted 10 March 2026.",
          },
          {
            title: "Accuracy of information",
            body: "We make every effort to ensure the information on this site reflects the enacted legislation as at 10 March 2026. However, regulations, ATO guidance, and administrative practice may change after publication. We last verified our content in April 2026. You should verify any time-sensitive information against current ATO guidance before acting.",
          },
          {
            title: "Products and payment",
            body: "Our paid products ($67 and $147) are document packs and decision-support guides. They are not financial advice, legal opinions, or tax agent services. Payments are processed securely via Stripe. All prices are in Australian dollars (AUD) and include GST where applicable.",
          },
          {
            title: "Refund policy",
            body: "Because our products are delivered digitally and immediately upon payment, we do not offer refunds once a document pack has been accessed. If you have a technical issue preventing access to your purchased documents, contact us at hello@supertaxcheck.com.au and we will resolve it promptly.",
          },
          {
            title: "Consumer guarantees",
            body: "Nothing in these terms limits any rights you may have under the Australian Consumer Law (ACL), including consumer guarantees that cannot be excluded by contract.",
          },
          {
            title: "Intellectual property",
            body: "All content on this website, including calculators, document templates, and written content, is the intellectual property of SuperTaxCheck. You may not reproduce, distribute, or resell our content without written permission.",
          },
          {
            title: "Limitation of liability",
            body: "To the maximum extent permitted by law, SuperTaxCheck is not liable for any loss or damage arising from your use of, or reliance on, information or tools provided on this site. This includes but is not limited to tax assessments, penalties, or missed elections resulting from reliance on our calculators.",
          },
          {
            title: "Governing law",
            body: "These terms are governed by the laws of New South Wales, Australia. Any disputes are subject to the exclusive jurisdiction of the courts of New South Wales.",
          },
          {
            title: "Contact",
            body: "For terms enquiries: hello@supertaxcheck.com.au",
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
