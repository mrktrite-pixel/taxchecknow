// /gpt — index of all 37 GPT landing pages.
// Server component. Static HTML. Crawlable by Google + AI search.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:        "All Tax Pre-Checks — 37 GPT-Style Tax Questions Answered | TaxCheckNow",
  description:  "37 misunderstood tax questions across Australia, UK, US, Canada, New Zealand and global nomad rules. Each one routes to a free personalised calculator.",
  alternates:   { canonical: "https://www.taxchecknow.com/gpt" },
  openGraph:    {
    title:       "All Tax Pre-Checks — 37 GPT-Style Tax Questions Answered",
    description: "37 misunderstood tax questions across AU, UK, US, CAN, NZ and global nomad rules.",
    url:          "https://www.taxchecknow.com/gpt",
    type:          "website",
  },
};

interface GptItem { slug: string; title: string; prompt: string; }

const AU: GptItem[] = [
  { slug: "au-cgt-main-residence-trap",       title: "CGT Main Residence Trap",        prompt: "I rented my property before selling — does that affect my CGT exemption?"   },
  { slug: "au-division-7a-loan-trap",          title: "Division 7A Loan Trap",           prompt: "I took money out of my company — is that taxable?"                            },
  { slug: "au-fbt-hidden-exposure",             title: "FBT Hidden Exposure",              prompt: "Is a company car or employee benefit taxable in Australia?"                     },
  { slug: "au-cgt-discount-timing-sniper",       title: "CGT Discount Timing Sniper",        prompt: "Does the 12-month CGT rule depend on contract or settlement?"                    },
  { slug: "au-negative-gearing-illusion",          title: "Negative Gearing Illusion",          prompt: "Is my negatively geared property actually saving me money?"                       },
  { slug: "au-small-business-cgt-concessions",      title: "Small Business CGT Concessions",      prompt: "Can I sell my business and avoid CGT in Australia?"                                },
  { slug: "au-instant-asset-write-off",                title: "Instant Asset Write-Off",              prompt: "Does this purchase qualify for instant asset write-off?"                              },
  { slug: "au-gst-registration-trap",                    title: "GST Registration Trap",                  prompt: "Do I need to register for GST if I just crossed $75k?"                                  },
  { slug: "au-rental-property-deduction-audit",            title: "Rental Property Deduction Audit",          prompt: "Can I claim all my rental property expenses?"                                            },
  { slug: "au-medicare-levy-surcharge-trap",                title: "Medicare Levy Surcharge Trap",              prompt: "Do I need private health insurance to avoid extra tax?"                                    },
  { slug: "au-bring-forward-window",                          title: "Bring-Forward Window",                       prompt: "Did I exceed my super contribution cap?"                                                     },
  { slug: "au-div296-wealth-eraser",                            title: "Div 296 Wealth Eraser",                       prompt: "Will I be taxed on unrealised gains in my super?"                                              },
  { slug: "au-transfer-balance-cap",                              title: "Transfer Balance Cap",                         prompt: "Have I exceeded the pension transfer balance cap?"                                              },
];

const NOMAD: GptItem[] = [
  { slug: "nomad-residency-risk-index",                              title: "Nomad Residency Risk Index",                  prompt: "Can I be a tax resident in two countries at once?"                                              },
  { slug: "nomad-tax-treaty-navigator",                                 title: "Tax Treaty Navigator",                         prompt: "Can I end up paying tax in two countries?"                                                       },
  { slug: "nomad-183-day-rule",                                          title: "183-Day Rule Reality Check",                   prompt: "If I stay under 183 days, do I avoid tax completely?"                                            },
  { slug: "nomad-exit-tax-trap",                                            title: "Exit Tax Trap Auditor",                        prompt: "If I leave a country, do I still owe tax there?"                                                  },
  { slug: "nomad-uk-residency",                                              title: "UK SRT Auditor",                                prompt: "When do I stop being a UK tax resident?"                                                            },
  { slug: "nomad-au-expat-cgt",                                                title: "Australian Expat CGT Trap",                    prompt: "Do I pay CGT if I sell Australian assets while overseas?"                                            },
  { slug: "nomad-us-expat-tax",                                                  title: "US Citizen Abroad Optimizer",                  prompt: "Do I still have to file US taxes if I live abroad?"                                                    },
  { slug: "nomad-spain-beckham-eligibility",                                       title: "Spain Beckham Eligibility Wall",               prompt: "Can I reduce tax using Spain's Beckham Law?"                                                            },
];

const US: GptItem[] = [
  { slug: "us-section-174-auditor",                                                  title: "Section 174 Auditor",                          prompt: "Do I now have to capitalise my R&D costs under Section 174?"                                              },
  { slug: "us-feie-nomad-auditor",                                                     title: "FEIE Nomad Auditor",                            prompt: "Do I still have to file US taxes if I live abroad?"                                                          },
  { slug: "us-qsbs-exit-auditor",                                                        title: "QSBS Exit Auditor",                              prompt: "Can I sell my shares tax-free under QSBS?"                                                                    },
  { slug: "us-iso-amt-sniper",                                                              title: "ISO AMT Sniper",                                  prompt: "Will I owe tax on stock options even if I didn't sell?"                                                          },
];

const CAN: GptItem[] = [
  { slug: "can-departure-tax-trap",                                                            title: "Canada Departure Tax Trap",                      prompt: "If I leave Canada, do I pay tax on everything I own?"                                                              },
  { slug: "can-non-resident-landlord-withholding",                                               title: "Canada Non-Resident Landlord Withholding",         prompt: "Are my rental deductions going to be denied by the CRA?"                                                              },
  { slug: "can-property-flipping-tax-trap",                                                        title: "Canada Property Flipping Tax Trap",                  prompt: "Will my property sale be treated as flipping income?"                                                                  },
  { slug: "can-amt-shock-auditor",                                                                    title: "Canada AMT Shock Auditor",                            prompt: "Is my home sale actually tax-free in Canada?"                                                                            },
];

const UK: GptItem[] = [
  { slug: "uk-mtd-scorecard",                                                                            title: "MTD Mandation Engine",                                  prompt: "Do I need to comply with Making Tax Digital yet?"                                                                          },
  { slug: "uk-allowance-sniper",                                                                            title: "60% Tax Trap Engine",                                    prompt: "Am I taking dividends the right way in the UK?"                                                                              },
  { slug: "uk-side-hustle-checker",                                                                            title: "Side Income Declaration Engine",                          prompt: "Do I need to declare my side hustle income in the UK?"                                                                          },
  { slug: "uk-dividend-trap",                                                                                    title: "Salary + Dividend Tax Trap",                                prompt: "Am I taking dividends the right way in the UK?"                                                                                  },
  { slug: "uk-pension-iht-trap",                                                                                     title: "Pension IHT Trap 2027",                                       prompt: "Will my pension be taxed under new UK inheritance rules?"                                                                          },
];

const NZ: GptItem[] = [
  { slug: "nz-bright-line-auditor",                                                                                      title: "Bright-Line Decision Engine",                                   prompt: "Do I have to pay tax on my property sale under NZ rules?"                                                                            },
  { slug: "nz-app-tax-gst-sniper",                                                                                          title: "Platform GST Decision Engine",                                    prompt: "Do I need to register for GST in New Zealand?"                                                                                          },
  { slug: "nz-interest-reinstatement-engine",                                                                                 title: "Interest Deductibility Recovery Engine",                            prompt: "Can I still claim rental losses in New Zealand?"                                                                                              },
];

const ALL: { region: string; tag: string; items: GptItem[] }[] = [
  { region: "Australia",        tag: "AU",    items: AU    },
  { region: "Nomad / Global",    tag: "NOMAD", items: NOMAD },
  { region: "United States",      tag: "US",    items: US    },
  { region: "Canada",              tag: "CAN",   items: CAN   },
  { region: "United Kingdom",       tag: "UK",    items: UK    },
  { region: "New Zealand",           tag: "NZ",    items: NZ    },
];

const TOTAL = ALL.reduce((s, g) => s + g.items.length, 0);

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type":      "WebPage",
      "name":       "All Tax Pre-Checks",
      "url":         "https://www.taxchecknow.com/gpt",
      "description": "Index of 37 GPT-style tax questions covering AU, UK, US, CAN, NZ and global nomad rules.",
    },
    {
      "@type":         "ItemList",
      "name":          "Tax Pre-Checks",
      "numberOfItems": TOTAL,
      "itemListElement": ALL.flatMap((g, gi) =>
        g.items.map((it, idx) => ({
          "@type":   "ListItem",
          "position": gi * 100 + idx + 1,
          "name":     it.title,
          "url":      `https://www.taxchecknow.com/gpt/${it.slug}`,
        }))
      ),
    },
  ],
};

export default function GptIndexPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans">

      <section className="bg-neutral-950 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-neutral-400">TaxCheckNow · GPT Pre-Checks</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold leading-tight text-white">All Tax Pre-Checks</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-neutral-300 leading-relaxed">
            {TOTAL} of the most misunderstood tax questions across Australia, UK, US, Canada, New Zealand and global nomad rules. Each question routes to a free personalised calculator.
          </p>
        </div>
      </section>

      <section className="bg-neutral-50 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl space-y-12">
          {ALL.map(group => (
            <div key={group.tag}>
              <header className="mb-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">{group.tag} · {group.items.length} checks</p>
                <h2 className="mt-1 font-serif text-2xl font-bold text-neutral-950">{group.region}</h2>
              </header>
              <ul className="grid gap-3 sm:grid-cols-2">
                {group.items.map(it => (
                  <li key={it.slug}>
                    <Link
                      href={`/gpt/${it.slug}`}
                      className="block rounded-xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-neutral-950 hover:shadow"
                    >
                      <p className="font-serif text-base font-bold text-neutral-950">{it.title}</p>
                      <p className="mt-1 text-sm text-neutral-600 italic">&ldquo;{it.prompt}&rdquo;</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-white px-6 py-10">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">TaxCheckNow</p>
          <p className="mt-2 text-xs text-neutral-500">
            Free pre-check pages plus personalised calculators. Not financial advice. Always consult a qualified adviser.
          </p>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />
    </main>
  );
}
