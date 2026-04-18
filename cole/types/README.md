# COLE — Citation Operations & Legal Engine

## What COLE Is

COLE is the operating system of taxchecknow.com.

Every product is defined by a single config file.
COLE reads the config and generates every file automatically.
COLE monitors GOV.UK for rule changes.
COLE updates files when the law changes.

**One config file → one push → live product.**

---

## Folder Structure

```
cole/
├── types/
│   └── product-config.ts        The TypeScript interface every config follows
│
├── config/
│   ├── uk-01-mtd-scorecard.ts   UK-01 product config
│   ├── uk-02-allowance-sniper.ts
│   ├── uk-03-digital-link-auditor.ts
│   ├── uk-04-side-hustle-checker.ts
│   └── uk-05-dividend-trap.ts
│
├── generators/
│   ├── generate-gate-page.ts    Reads config → writes page.tsx
│   ├── generate-calculator.ts   Reads config → writes [X]Calculator.tsx
│   ├── generate-success-pages.ts Reads config → writes assess + plan pages
│   ├── generate-product-files.ts Reads config → writes all 8 product files
│   └── generate-rules-route.ts  Reads config → writes /api/rules/[x]/route.ts
│
├── scripts/
│   └── cole-generate.ts         Entry point — run this to generate a product
│
├── templates/
│   └── (shared HTML/TSX partials used by generators)
│
├── monitoring/
│   └── (changedetection.io webhook handlers)
│
├── research/
│   └── (GOAT research briefs and citation gap validation)
│
└── README.md                    This file
```

---

## How to Generate a New Product

```bash
npx ts-node cole/scripts/cole-generate.ts uk-03
```

This will:
1. Read `cole/config/uk-03-digital-link-auditor.ts`
2. Generate all files to the correct paths
3. Output the Stripe env vars needed
4. Output the Vercel env vars needed
5. Output the monitor URLs for changedetection.io

Then:
```bash
git add .
git commit -m "feat: uk-03 digital-link-auditor"
git push
```

---

## The Seven Layers

| Layer | What It Does | Status |
|-------|-------------|--------|
| 1 | Folder structure | ✅ Done |
| 2 | Supabase tables | ← Next |
| 3 | README | ✅ This file |
| 4 | ProductConfig interface | ✅ Done |
| 5 | Config files (data) | 🔄 In progress |
| 6 | Generators (engine) | ← Building |
| 7 | Scripts (runner) | ← Building |
| 8 | Monitoring (watcher) | ← Building |
| 9 | Research module | ← Building |

---

## Config File Convention

```
cole/config/[country]-[nn]-[product-slug].ts
```

Examples:
- `uk-01-mtd-scorecard.ts`
- `uk-03-digital-link-auditor.ts`
- `au-01-div296-wealth-eraser.ts`
- `nz-01-bright-line-test.ts`

---

## File Path Convention (generated output)

```
Gate page:      app/[country]/check/[id]/page.tsx
Calculator:     app/[country]/check/[id]/[Pascal]Calculator.tsx
Success tier1:  app/[country]/check/[id]/success/assess/page.tsx
Success tier2:  app/[country]/check/[id]/success/plan/page.tsx
Product files:  app/files/[country]/[id]/[id]-01/page.tsx
Rules route:    app/api/rules/[id]/route.ts
```

---

## Env Var Convention

```
Stripe:   STRIPE_[COUNTRY]_[PRODUCT]_[TIER]
Drive:    NEXT_PUBLIC_DRIVE_[COUNTRY]_[PRODUCT]_[TIER]

Examples:
STRIPE_UK_MTD_67
STRIPE_UK_DLA_127
NEXT_PUBLIC_DRIVE_UK_DLA_67
```

---

## COLE Monitoring

changedetection.io watches all `monitorUrls` from each config.
When a change is detected it calls:
`POST taxchecknow.com/api/cole/monitor`

COLE then:
1. Logs the change to Supabase `rule_changes` table
2. Identifies affected products
3. Sends an alert email via Resend
4. You update the config and re-run the generator

---

## The GOAT Standard

Every generated product must score 9.0+ on the GOAT framework:

- Block 1: Answer-first strike (specific number above fold)
- Block 2: Extraction table (AI citation bait)
- Block 3: Formula lock (calculable logic)
- Block 4: Worked examples (4 real people)
- Block 5: Definition lock (precise HMRC definition)
- Block 6: Calculator (bracket buttons, instant result)
- Block 7: Result moment (personal £ figure)
- Block 8: Progress arc (before/after score)
- Block 9: Product justification (links to their result)
- Block 10: Quick answer AI bait (bullet facts)
- Block 11: FAQ (12 questions, AI-intent aligned)
- Block 12: Trust layer (source + date + Act)

Never push below 9.0. A 7/10 page damages the brand.

---

*COLE built by TaxCheckNow · taxchecknow.com*
