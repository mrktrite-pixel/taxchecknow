# Terminal-native product playbook

How to migrate a COLE product from *one pack for everybody* to *a pack that reflects the answers
the buyer actually gave*.

Everything described here already exists and ships. It was built during the FRCGW rebuild
(`au-19-frcgw-clearance-certificate`, commits `870a542` → `0098c1d`, August 2026), and FRCGW is
currently the only product using any of it. That is deliberate: **every mechanism is generic and
every piece of data is per-product**, so the other 46 products render byte-identically to before
these modules existed, and will keep doing so until someone writes their entry.

This document is the instruction for writing that entry.

---

## 0 · Why this exists — the defect class

FRCGW had ten terminals. A buyer answered five questions, the engine routed them to a terminal,
and then every single surface of the paid pack ignored it:

- one hardcoded red strip: *"Certificate must reach the buyer's solicitor BEFORE settlement · Lodge ≥28 days out"*
- one hardcoded calendar, including an event literally titled `SET TO YOUR ACTUAL SETTLEMENT DATE`
- one hardcoded file order and a hardcoded *"Start with File 02"*
- document bodies that asserted `$900,000 sale = $135,000 withheld` to a buyer who never gave a sale price

A buyer whose settlement had **already passed without a certificate** was told to lodge 28 days
out and handed a calendar event saying *apply now*. Not merely unhelpful — wrong for their
position, on a page they had paid $147 for.

None of that was a bug in the sense of a broken line of code. It was the absence of any mechanism
by which a deliverable could say something about the person reading it. This playbook is that
mechanism, in ten parts.

### The three invariants

Everything below obeys all three. If your migration breaks one of them, it is wrong.

**1 · Mechanism generic, data per-product.**
No product-specific `if` in shared code. Each mechanism is a lookup keyed by `productId` into a
registry, with a neutral fallback. `TERMINAL_PRESENTATION[unmapped]` → `defaultPresentation()`,
which reproduces exactly the unconditional behaviour. Adopting a mechanism is *adding a row*, and
adding a row can only affect that product.

**2 · Omission, never assertion.**
When you do not know something, remove content — never substitute a plausible-looking value. A
document may say *"we don't have your sale price — here is the method"*. It may never say
`$900,000` to someone who did not say `$900,000`. A settlement-anchored calendar event with no
settlement date is **dropped**, not defaulted. This has a syntactic consequence in the flag
vocabulary (see §1) and a semantic one in the template engine (see §4).

**3 · Prove it by enumeration, not by naming.**
Tests that name the files, fields or terminals they check can only ever find what someone
remembered. Every test in this rebuild that found a real defect found it by iterating the whole
set. See §11.

---

## 1 · Terminal presentation map and the docFlags vocabulary

**File:** `lib/terminal-presentation.ts`
**Registry:** `TERMINAL_PRESENTATION: Record<productId, Record<terminalId, TerminalPresentation>>`

```ts
interface TerminalPresentation {
  strip:     { tone: "green"|"amber"|"red"|"blue"; headline: string; badge: string };
  calendar:  PackCalendarEvent[];
  spine:     string[];   // file slugs in display order
  startHere: string;     // slug to badge START HERE
  docFlags:  string[];   // flags handed to {{#if}} in document bodies
}
```

`getTerminalPresentation(productId, terminalId, fallback)` returns the mapped entry, or
`defaultPresentation(fallback)` built from the caller's own copy — which is what every unmapped
product gets, and is byte-equivalent to the pre-existing hardcoded behaviour.

`resolveSpine(presentation, availableSlugs)` filters the spine to the files the buyer's tier
actually has, appends any file the spine forgot (so a new file can never silently vanish), and
falls back to the first available slug if `startHere` is not in the tier.

### The flag vocabulary — three namespaces, and the rule

This is the part that is easy to get wrong, and getting it wrong caused five separate live
defects (W1/W5).

| Namespace | Means | Mutually exclusive? |
|---|---|---|
| `state:*` | **Where the buyer is.** A fact about their situation: `state:pending`, `state:settled`, `state:have_cert` | yes, within a product |
| `section:*` | **Which content to include.** `section:recovery`, `section:variation`, `section:per_vendor` | no, several at once |
| `suppress:*` | **Which content to remove.** Deliberately coarse. `suppress:apply_now`, `suppress:28_day` | no |

> **The rule: to say something POSITIVE about the buyer's situation, branch on `state:*` or a
> specific `section:*`. Reserve `suppress:*` for omission.**

Why. `suppress:apply_now` is true for pending, certificate-provided **and** settled buyers. As
*"do not print apply-now steps"* that is exactly right. As *"they have already lodged"* it is
nonsense, because two of those three never lodged anything. Files 02 and 06 branched on it to
decide what to *say*, and told a buyer whose settlement had passed without a certificate to go and
check the status of an application they never made.

A `suppress:` flag is a coarse union. It is a correct instruction to delete and a wrong premise to
assert from.

### Calendar anchors

```ts
interface PackCalendarEvent {
  uid: string; summary: string; description: string;
  anchor: "today" | "settlement" | "lodgeBy";
  offsetDays: number;
  relativeLabel: string;   // chip shown when there is no real date
}
```

`anchor: "today"` always resolves. `settlement` and `lodgeBy` resolve only when the buyer supplied
a real date (§9) and are **dropped otherwise** — invariant 2. `relativeLabel` is what the chip
shows in that case (`"Today"`, `"At the next return"`). `buildIcs` additionally refuses to emit a
`VEVENT` with no `isoDate`, so an undated event cannot leak into a calendar file either.

Watch for a terminal whose events are *all* settlement-anchored: with no date it renders an empty
calendar box. That was D9 finding 3. Give every terminal at least one `today`-anchored event.

### Adopting it

1. List your terminals from `engine.json` (or the calculator's result map for non-engine products).
2. For each, write the four surfaces. Ask of each one: *what does this person actually have to do
   next?* If the answer is "nothing, it already happened", the strip says that.
3. Assign `docFlags` using the table above. Write `state:` first, then the `section:`s the
   documents will branch on, then the `suppress:`s.
4. Enumerate: assert that every terminal in `engine.json` has an entry, and that every
   `section:`/`state:` flag you emit is actually consumed by at least one document body — and vice
   versa. A flag nobody reads and a `{{#if}}` nobody sets are both dead code that reads as coverage.

---

## 2 · terminalFlags — the one merged bag

**File:** `lib/terminal-presentation.ts`

```ts
terminalFlags(productId, ctx): string[]      // ctx.flags ∪ presentation.docFlags
isPastSettlement(productId, ctx): boolean    // state:settled || section:recovery
```

There are **two** flag bags in the system and they contain different things:

- `BuyerContext.flags` — engine answers (`q4_residency:resident`), plus `terminal:<id>`,
  `tier:<n>`, `has:<value>`, `settlement:past|inside_28|outside_28`
- `TerminalPresentation.docFlags` — the `state:`/`section:`/`suppress:` vocabulary from §1

They have never overlapped. The tier-2 checklist heading read `ctx.flags` looking for
`section:recovery`, which lives in the *other* bag, so it returned "before settlement" on every
path including a perfect session — and the test that "passed" only regex-matched the page source
for the string it hoped would render (§11).

**Never read either bag directly. Call `terminalFlags`.** Document rendering, labels, the
checklist heading, and the key-dates note all consult the same merged set, so a label and the body
beneath it cannot disagree about which terminal they are on.

`isPastSettlement` is the same idea one level up: a *predicate* rather than an inline flag check,
because the moment two surfaces each decide "is this buyer's settlement behind them?" for
themselves, one of them forgets a flag. Add sibling predicates rather than inline checks.

---

## 3 · Retired-terminal aliasing

**File:** `lib/terminal-presentation.ts` — `RETIRED_TERMINALS: Record<productId, Record<oldId, newId>>`

```ts
"frcgw-clearance-certificate": {
  "certificate-pending-at-settlement":   "certificate-pending-unsure-residency",
  "no-certificate-withholding-applies":  "no-certificate-unsure-residency",
},
```

`resolveTerminalId` maps an old id forward; unknown ids pass through unchanged.

**Why you cannot skip this.** `decision_sessions` rows are immutable history. When you split or
rename a terminal, every stored row still names the old id, and those buyers can revisit their
success page at any time. Without an alias they silently fall to the neutral default and lose
every conditional surface — the failure is invisible because nothing errors.

Rule: **never delete a terminal id, alias it.** Add the row in the same commit that renames it.

---

## 4 · R1 — the document template pass

**File:** `lib/doc-template.ts` (pure: no React, no DOM, no I/O — runs at build, on the server, and
in the client, and is unit-testable)

```
{{bind:key}}                     value, or the DEFAULT honest line if unbound
{{bind:key|we don't have this}}  value, or this author-written fallback if unbound
{{#if flag}}…{{/if}}             kept when the flag is present
{{#unless flag}}…{{/unless}}     kept when the flag is absent
```

Blocks nest. **Conditionals resolve before binds**, so a bind inside a dropped block is never
evaluated and cannot emit a fallback line into content nobody sees.

```ts
renderDocTemplate(src, { values, flags })
isTemplated(src)        // does this body use the syntax at all?
bindKeys(src)           // every {{bind:…}} key — for enumeration tests
conditionalFlags(src)   // every {{#if}}/{{#unless}} flag — for enumeration tests
```

### The rules that matter

**An unbound value never renders a number.** It renders `DEFAULT_UNBOUND_LINE` —
`"(you didn't give us this — see the method below)"` — or the author's own fallback. Deliberately
not a blank: a silent blank reads as *"nothing to say here"*, which is a different and also wrong
claim from *"you didn't tell us this"*.

**Write real fallbacks.** The default line is a backstop, not a target. FRCGW's File 01 says:

> `{{bind:sale_price|this check did not ask for your sale price, so we have not put a figure here. Multiply your contract price by 0.15 to get the amount that would be withheld.}}`

That is a paid deliverable being honest and still useful. Every bind in a body you charge for
should have an authored fallback.

**Bound values are escaped, fallbacks are not.** Bound values originate in customer answers, so
treating them as HTML would be an injection vector on a page served back to that same customer.
Author-written fallbacks are part of the template — same trust level as the body.

**A body with no markers renders byte-identically to before.** That is why introducing this was a
no-op for the other products, and it is how you migrate a body incrementally.

### Adopting it

Move the body from `cole/config/<product>.ts` into templated form, one file at a time. For each:

1. Every number that is not from the corpus → `{{bind:…}}` with an authored fallback.
2. Every paragraph that is only true for some terminals → wrap in `{{#if state:…}}` /
   `{{#unless …}}`.
3. Regenerate and diff. A file you have not templated yet must be byte-identical.

Then enumerate (§11): for every terminal × every file, assert that no `{{`/`}}` survives the
render, that no fallback line appears where a value was available, and that the *paired* blocks
are exhaustive — `{{#unless state:settled}}…{{/unless}}` with no `{{#if state:settled}}` companion
means settled buyers get a hole where a heading should be.

---

## 5 · Terminal-conditioned labels

**File:** `lib/terminal-labels.ts`
**Registries:** `DOC_LABELS[productId][slug]`, `FIELD_LABELS[productId][fieldKey]` — ordered
`LabelRule[]`, first match wins.

```ts
interface LabelRule { when: string; name?: string; desc?: string }
resolveDocLabel(productId, slug, flags, fallback)   // → { name, desc }
resolveFieldLabel(productId, key, flags, fallback)  // → string
```

`when` is a flag from `terminalFlags`. The special value `terminal:*` matches whenever any terminal
is known — a default that still requires a resolved context.

**The defect this exists for.** W6 and D9 made document *bodies* terminal-aware and left their
names, descriptions and assessment field labels as static config strings. Measured on a live $147
buy, two lines apart:

```
File 06 of 8 — Your Pre-Settlement Plan
What to do, in order, between now and settlement.
Your recovery plan — Your settlement has already happened.
```

The body was right and the label above it contradicted it. Because labels resolve through the same
`terminalFlags` set the bodies branch on, that class of disagreement is now structurally
impossible rather than merely fixed.

**Wire all the surfaces or none.** There are more than you expect. For FRCGW: the pack list, the
upsell block, the print header, the standalone document page header, and the field label on both
success pages. A label fixed on four of five surfaces is worse than one fixed nowhere, because it
looks done.

No entry ⇒ `resolveDocLabel` returns the caller's own strings. Prove it: resolve every document
label for every unmapped product under every flag combination and assert zero drift. That check
covered 376 labels across 47 configs when D14 landed.

---

## 6 · Assessment fields registry

**File:** `lib/assessment-fields.ts`

```ts
PRODUCT_ASSESSMENT_FIELDS[productId] = { tier1: [...], tier2: [...] }
getAssessmentFields(productId, tier)   // per-product when registered, else GENERIC_FIELDS
resolveDisplayFields(assessment, productId, tier, preferred?)
humaniseFieldKey(key)                  // "withholdingExposure" → "Withholding exposure"
```

Registered products get per-product assessment keys (`salePrice`, `withholdingExposure`, …)
instead of the generic set (`status`, `keyFinding`, `firstAction`, …). Six products are registered
today.

**`resolveDisplayFields` is the migration story, and it has a trap.** Registering a product fixes
the deliverable from the next purchase onward. It does *not* rewrite assessments already in the
table, and a page that renders only the per-product keys shows those earlier buyers an empty block
forever. So the page renders whichever list the assessment it was handed actually populates.

The trap: the two lists can **overlap**. FRCGW's per-product tier-1 list and `GENERIC_FIELDS.tier1`
both contain `firstAction`. A "per-product wins if it matches anything" rule therefore looked at a
legacy generic assessment, found its one shared key, and rendered a **one-row** position block —
barely better than the empty one it replaced. Compare *coverage*, not *any match*. Ties go to
per-product so a fresh assessment is never displayed through the generic list.

When you register a product, verify the list element-by-element against the `fields:` array the
emitted success pages actually POST. Two products were registered this way (7/13 and 8/12,
identical on both sides). One product — `medicare-levy-surcharge-trap` — is registered with 11/15
fields while its config now says 9/9; see §13.

---

## 7 · Fact rules registry

**File:** `lib/fact-rules.ts` — `PRODUCT_FACT_RULES[productId]: string[]`, read by
`getFactRules(productId)`.

Short imperative statements of how a product's facts must be *phrased*, injected verbatim into the
assessment prompt directly beneath the corpus, under the heading
`HOW THIS PRODUCT'S FACTS MUST BE STATED — NON-NEGOTIABLE`.

### Why this is not just more corpus

The corpus states what the law **is**. It cannot say which true-adjacent paraphrase is wrong.
*"Processing takes 1–4 weeks"* contradicts no single corpus figure — the ATO does say allow up to
28 days — but it is the wrong shape of claim, and it is what the model reached for every time. A
fact rule pairs the wrong phrasing with the right one, which is the form that actually displaces
it. Corpus grounding alone never caught any of these.

### Why a registry and not a config field

The authoring home is `ProductConfig.factRules`, but `cole/` is excluded from the Next build and
`lib/` cannot import it. More importantly, **the Stripe webhook builds its own `AssessInput` and is
out of scope to edit**. A rule that travelled only as an explicit argument would reach the client
success-page fallback and miss every real purchase — exactly the divergence that left every stored
FRCGW assessment carrying generic field keys.

So `generateAssessment()` resolves them itself, from the registry, for **both** callers:

```ts
const rules_ = factRules?.length ? factRules : getFactRules(product_id);
```

Explicit argument wins; otherwise the registry. **This is the load-bearing pattern of the whole
rebuild** — anything the webhook must inherit is resolved *inside* `generateAssessment` by
`product_id`, never passed in. Fact rules, conflict detection and the rules-slug map all work this
way.

The two copies (config + registry) must agree; a behaviour test deep-equals them.

### The nine FRCGW rules, as the worked example

Each names the wrong phrasing **and** the right one. Copy the shape, not the content.

| # | Rule | The wrong phrasing it displaces |
|---|---|---|
| 1 | **PROCESSING TIME** — "most certificates issue within days; the ATO says allow up to 28" | "1-4 weeks" — presents the outer manual-check allowance as the expected wait, so sellers think they have missed their chance |
| 2 | **THE MONEY IS NOT LOST** — withheld *and credited* to the vendor | "lose it", "locked up", "tied up", "stuck", "forfeited" |
| 3 | **WHO WITHHOLDS** — the *purchaser* withholds and remits | "the ATO withholds" (the ATO receives); money "held by the buyer's solicitor" or in a trust account |
| 4 | **RECOVERY TIMING** — claimed in the return for the income year the *contract* was signed; can reach ~15 months | an invented "6-18 months" range |
| 5 | **RESIDENTS ARE NOT EXEMPT** — they could have *prevented* it; they were never exempt | "the withholding should not have applied" / "it was an error" |
| 6 | **THE CERTIFICATE** — free, 12 months, no obligation, one per *vendor* not per property | one per property |
| 7 | **FORM NAMES** — describe the *instrument*, never name a form/number/menu path absent from the corpus | invented `NAT`-style identifiers that read as precise |
| 8 | **FOREIGN RESIDENTS** — cannot get a clearance certificate; the instrument is a variation *notice*, 0–14.99% | "variation certificate" |
| 9 | **THE PURCHASER'S SIDE — LEAD WITH THE ASK** — open with the thing to request | "there is no instruction", "there is nothing to send", "this no longer applies" |

Rule 9 is worth calling out as a category: **negation openers**. On a terminal where the standard
action no longer applies, the model's instinct is to open by saying so. The buyer paid for the
wording, so lead with what *does* apply and demote the negation to the end. The measured before and
after, same field, same terminal:

> ~~"There is no instruction to give the buyer's solicitor at this stage."~~
> **"Contact the purchaser's conveyancer or solicitor and request the payment notification they
> submitted to the ATO, the exact amount withheld, and the date it was remitted."**

Harvest your own rules from live output, not from imagination. Every one of the nine was written
after reading a real generated assessment and finding the sentence wrong.

---

## 8 · CONFLICT_RULES and the maze-wins doctrine

**File:** `lib/buyer-context.ts` — `CONFLICT_RULES[productId]: ConflictRule[]`, evaluated by
`detectConflicts(productId, mazeLabels, qualLabels)`.

```ts
interface ConflictRule {
  id: string;
  mazeMatches: RegExp;   // tested against every maze answer
  qualMatches: RegExp;   // tested against every pre-checkout qualification answer
  note: string;          // the instruction handed to the model
}
```

Buyers answer twice: once in the checker (the maze) and once in the pre-checkout qualification
popup. They routinely disagree — the checker is deliberate and the popup is a click on the way to
paying.

### The doctrine

1. **The maze wins.** It is the considered answer and it is what routed the terminal, so the whole
   pack is already built on it. `authoritative` is always the maze answer.
2. **The discrepancy is named, never silently resolved.** A reader who has answered inconsistently
   cannot act on advice that quietly picks one side, because they will not know which answer the
   advice was built on.
3. **Named in the first two sentences of the first field.** Not later, not only in an action step,
   not implied. The prompt block is mandatory and conditional:

   ```
   A CONTRADICTION WAS DETECTED IN THIS CUSTOMER'S ANSWERS — NAMING IT IS MANDATORY.
   … You MUST state the discrepancy explicitly, in your own words, in the FIRST TWO SENTENCES
   of the very first field you write. …
   This is not optional and it is not satisfied by merely writing advice consistent with the
   authoritative answer.
   ```

   That last line closes a loophole that was measured live: the model received the conflict, wrote
   advice consistent with the authoritative answer, and never told the reader their answers
   disagreed.

### Detection lives inside the generator

Same reason as fact rules. It used to live in `buildComposerInputs(maze, qual, productId?)`; the
webhook calls that with **two** arguments and is out of scope to edit, so `productId` was
`undefined` on the real purchase path and no stored assessment could ever carry a note.

`generateAssessment` now splits the composed inputs back apart on the `qualification.` namespace
and detects there, so both callers inherit it with no new plumbing. Notes are injected as
`_conflict.N` inputs. **Keep detection in exactly one place** — a test fails if `composer-inputs`
regains a copy.

### Writing the rules

Enumerate the full grid: every maze answer × every qualification answer. For each cell decide
*contradiction*, *compatible*, or *no axis*, and write that decision down — including the "no
axis" ones, so nobody adds a rule for them later. FRCGW's grid is 8 maze answers × 11 qualification
answers: 5 rules covering 13 contradicting pairs, 75 correctly silent.

Two hard-won points:

- **Widen an existing rule before adding a new one.** `detectConflicts` takes the *first* matching
  qual entry per rule, so one disagreement yields one note. A second rule with the same
  `mazeMatches` emits two near-identical notes for a buyer who got two qual answers wrong — and
  rule 3 above then requires both be named in the first two sentences.
- **Compatible is a real verdict.** "Application still pending" + "already settled" is not a
  contradiction — the certificate simply never arrived in time. Leaving it silent is correct.

---

## 9 · Dates: DATE_ANSWER_FIELD and stored-path resolution

**File:** `lib/buyer-context.ts`

```ts
SETTLEMENT_DATE_FIELD = "q6_settlement_date"
DATE_ANSWER_FIELD: Record<productId, string>   // productId → the raw-answer key holding its date
dateAnswerField(productId): string | null
LODGE_LEAD_DAYS = 28                            // the corpus lead time
parseIsoDate · addDaysIso · daysUntilIso · formatIsoDate
```

When `buildBuyerContext` finds a parseable date at that key it derives, in one place:
`settlement_date`, `settlement_date_iso`, `lodge_by_date` (= date − `LODGE_LEAD_DAYS`),
`lodge_by_date_iso`, `days_to_settlement`, the flag `has:settlement_date`, and exactly one of
`settlement:past` / `settlement:inside_28` / `settlement:outside_28`.

No date ⇒ none of those exist, `{{#if has:settlement_date}}` is false, settlement-anchored calendar
events are dropped, and the prompt gets the `NO DATE WAS CAPTURED — USE RELATIVE LANGUAGE ONLY`
block instead of the absolute-dates one. A model asked for "a specific deadline date" with no date
in its inputs **will** invent one; it did, and it rendered LLM-authored dates in a red urgency chip
on a product that captured no date at all.

### The stored path is not the client path

`sessionStorage` is empty on every visit that is not the checkout tab — the receipt-email link,
another device, a reopened browser. Two things must therefore be resolved **server-side** and
passed in:

```ts
buyerContextFromSession(productId, tier, terminalIdOverride, settlementDateOverride)
```

`/api/get-assessment` reads the linked `decision_sessions` row and returns
`output.terminal_id` and `output.raw_answers[dateAnswerField(product_id)]`. Without the terminal
override, every terminal-conditioned surface degrades to the neutral default on those visits.
Without the date override, every dated surface silently vanishes.

**Inject the raw date, not the derived values.** `settlementDateOverride` goes into the *raw
answers*, so the formatted date, lodge-by, days-to-settlement and the settlement:* flag are all
computed by exactly the code the client path runs. Setting derived values directly would let the
two paths drift; deriving them from the same input makes them identical by construction.

Precedence is unchanged by any of this: a settled terminal still suppresses lodge-by even when a
date is present.

> **Note on the source of truth.** `DATE_ANSWER_FIELD` duplicates something the product's own
> `temporal.rule.field` already names. That would be the generic source, but
> `lib/temporal-registry.ts` is a generated snapshot and has drifted (§13). The small explicit map
> is the zero-blast-radius equivalent and follows the same registry pattern as everything else
> here. Collapse the two when the registry is regenerated.

---

## 10 · geoClaims

**File:** `cole/types/product-config.ts` (optional field), emitted by
`cole/generators/generate-gate-page.ts`.

```ts
geoClaims?: {
  bullets: string[];    // short self-contained factual claims, one per <li>
  provenance: string;   // one line naming the authority and the legal instrument
};
```

Absent ⇒ `geoClaimsBlock()` returns `""` and the template collapses to exactly the markup it
produced before the field existed.

**Why it is here at all**, and the lesson worth more than the field: FRCGW's gate page carried
exactly this markup **hand-written straight onto the emitted page** by an earlier commit. It was in
no config and no generator, and it existed on exactly one gate page in the repo — so the next
regeneration would have silently deleted it with nothing to restore it from.

> **Before regenerating any emitted page, diff the emitted file against what the generator
> produces from the config.** Anything present in the first and absent from the second is
> hand-written content that a regen will destroy. Promote it to a config field first.

The proof obligation for a new optional generator field: hash the emit for **all** configs before
and after the generator change and assert byte-identical. That was 48/48 when `geoClaims` landed.

---

## 11 · Test doctrine

Four rules. Every real defect in this rebuild was found by one of them, and several were found by
tests written to check something else.

### 11.1 Enumerate, don't name

A test that names the files it checks can only find defects in the files someone remembered.

D9 finding 1: Files 01 and 06 wrapped their dates box in `{{#unless state:settled}}`. File 02 did
not — the string `state:settled` appeared nowhere in it — so a settled buyer with a date got
*"Lodge by: 3 November 2026 to allow the full 28 days"* on a sale that had already completed. The
existing precedence test asserted on File 01 and File 06 **by name** and never looked at File 02.

The replacement iterates: *every file whose body contains a lodge-by bind must guard it*. Write the
test as a property over the whole set, and let the set come from the product's own data —
`config.files`, `engine.json`, the registry, or `docs.json` where the product emits one (today only
FRCGW does) — rather than from a literal array in the test.

### 11.2 Negative controls, always

A green test proves nothing until you have watched it go red.

- **New test?** `git stash` the fix and confirm it fails. If it passes against the pre-fix tree it
  is a regression guard, not a proof — which is fine, but say so rather than claiming it caught
  the bug. Of D16's eight tests, five failed pre-fix; the three that passed were guards.
- **Scanner reporting "clean"?** Inject each banned phrase and confirm it is caught. An 11-item
  banned-phrase scan reporting 0/11 is worthless until you have shown it reports 11/11 on injected
  text.
- **Beware your own scanner.** A fact-rule check "failed" on a live PDF because the phrase wrapped
  across a line and the regex was matching unflattened text. Normalise whitespace before matching
  extracted text, and treat a surprising failure as suspect tooling until proven otherwise.

### 11.3 Both-paths parity

Anything that reaches the buyer must be asserted on **both** the client success-page path and the
webhook purchase path, because they are different callers with different inputs.

The canonical test composes the same answers through `buildComposerInputs`, asserts the two calls
are deep-equal, asserts neither carries a `_conflict.` note (detection is the generator's job), and
then runs the generator's own split-and-detect on both. Plus a structural assertion that the
webhook's call site passes no product identifier — because the day it does, the premise of the
whole fix has changed and someone should be told.

If a mechanism can only be reached by passing an argument, the webhook does not have it. Resolve it
from a registry by `product_id` inside `generateAssessment` instead (§7).

### 11.4 No source-regex tests

**A test that greps a page's source for a string it hopes will render is not a test.**

The checklist-heading test did exactly that. It passed for weeks while the heading returned
"before settlement" on every path, including a perfect session, because the code read the wrong
flag bag and the test never executed the code — it only checked that the string existed somewhere
in the file.

Call the real function with real inputs and assert on the return value. Where a component genuinely
cannot be imported (a `.tsx` using the `@/` alias, which the CommonJS ts-node test project does not
resolve), the acceptable compromise is:

- extract the decision into a plain `lib/` function (this is why `isPastSettlement` exists),
- test that function exhaustively against real registry data,
- and add a *narrow* structural assertion that the component calls it — never a broad "the string
  appears somewhere".

The same applies to config/registry drift: compare **module values**, not source text. Config
strings are concatenated across several literals, so a substring search of the file fails on a rule
that is in fact present.

### 11.5 Snapshots are not behaviour

`cole/__tests__/*.snapshot.test.ts` locks generator output so a change is visible in review. It
cannot tell you the new behaviour is *correct* — a wrong answer snapshots just as happily as a right
one. Behaviour claims go in `*.behaviour.test.ts` and assert against the real shipped modules.

When a mechanical change churns snapshots (D14 updated 384), state the count and prove the churn is
mechanical — e.g. every diff is a static string becoming `resolveDocLabel(..., <that same string>)`.

---

## 12 · Per-product migration checklist

In order. Each step is independently shippable and each leaves the product green.

**Phase 0 — measure before you touch anything**

1. Read the live product: `engine.json` (or the calculator), the config's `files` array, both
   success pages, and the emitted pages under `app/files/<market>/<slug>/`. List every terminal.
   (`docs.json` is emitted for FRCGW only; do not expect one.)
2. Build the input→render matrix: for each terminal × each surface (strip, calendar, spine,
   START HERE, each document body, each assessment field, each label), what renders today?
   Anything identical across all terminals is a candidate defect.
3. Buy the product at both tiers on a preview and read the PDFs. Every rule in §7 was written from
   live output.
4. Diff each emitted page against a fresh generator run **before** you regenerate anything (§10).

**Phase 1 — presentation**

5. Write `TERMINAL_PRESENTATION[productId]` (§1). One entry per terminal, `state:`/`section:`/
   `suppress:` assigned by the rule. Check no terminal has an all-settlement-anchored calendar.
6. Add `RETIRED_TERMINALS` entries for any id that has ever been renamed (§3).
7. Route every surface through `terminalFlags` (§2). Grep for direct reads of `ctx.flags` and
   `docFlags` and remove them.

**Phase 2 — content**

8. Template the document bodies (§4), one file at a time, diffing for byte-identity on untouched
   files. Authored fallbacks for every bind.
9. Write `DOC_LABELS` / `FIELD_LABELS` (§5) and wire **all** the surfaces. Prove unmapped products
   are byte-identical.
10. Register `PRODUCT_ASSESSMENT_FIELDS` (§6), verified element-by-element against the `fields:`
    array the success pages POST.

**Phase 3 — the model**

11. Harvest `factRules` from live output (§7). Author in the config, mirror in
    `lib/fact-rules.ts`, and add the deep-equal drift test.
12. Enumerate the maze × qualification grid and write `CONFLICT_RULES` (§8). Record the
    "compatible" and "no axis" verdicts in a comment.

**Phase 4 — dates and the gate**

13. If the product captures a date: add `DATE_ANSWER_FIELD`, verify the raw-answer key against a
    real `decision_sessions` row, and wire the stored-path overrides in `/api/get-assessment` (§9).
14. If the gate page carries hand-written GEO content, promote it to `geoClaims` **before**
    regenerating (§10).

**Phase 5 — prove it**

15. Behaviour tests per §11: enumerated, negative-controlled, both-paths, no source-regex.
16. `npx tsc --noEmit` → 0 · `npm run build` green · `npm run test:snap` green. `prebuild` runs
    `sync-cole-lib`; if it reports drift, prove the bodies are byte-identical before running
    `npm run sync:cole-lib -- --write`.
17. Walk all terminals read-only on a preview: render the full presentation for every terminal on
    both the client and stored paths, and diff the two. They must agree.
18. Buy at both tiers, extract the PDFs, and run the battery: strip, heading, spine, ordering, tier
    scaling with zero cross-tier leaks, banned-phrase scan **with positive controls**, every fact
    rule, conflict naming, and the labels.

**Do not skip 17 and 18.** Every finding in this rebuild after the first commit came from one of
them, not from the test suite.

---

## 13 · Known estate items

Measured, outside the scope they were found in, and deliberately left. Each needs its own dispatch.

**1 · Stripe webhook endpoint pinned to a July preview.** MEASURED from Vercel runtime logs
(17 Aug, both test buys): `POST /api/stripe/webhook` is served by
`dpl_7XNAGi413nE6S1zSisbpBEmYRscN` — commit `2f7d8fb`, branch `stepG/au-09-regenerate-pages`,
built 31 July. Not production (`b1b6dfd`), not the branch alias. It is an **immutable deployment
URL**, so it will serve that build forever regardless of what merges or is promoted. Consequence:
every stored assessment is generated by a build predating the FRCGW registration — generic field
keys, no fact rules, no conflict detection. **Fix: repoint the endpoint in the Stripe dashboard.**
Merging does not help.

**2 · 42-product UK-disclaimer regen.** 386 emitted document pages across 42 products say
*"consult a qualified UK tax adviser"* while citing the ATO, the IRS, the CRA and the IRD. The
**generator is already fixed** — `generate-product-files.ts` derives the demonym from `country`
(the controlled code the rest of the pipeline routes on) rather than from free-prose `market`.
What remains is regenerating the 42 products. FRCGW is clean because it was regenerated.

**3 · `lib/temporal-registry.ts` drift.** A generated snapshot that still carries FRCGW's pre-E3
`kind: "unresolvable"` declaration, with no rule and no field. Regenerating rewrites every
product's entry and changes what the webhook's reminder path reads platform-wide. Until then
`DATE_ANSWER_FIELD` (§9) is the local stand-in; collapse the two afterwards.

**4 · `medicare-levy-surcharge-trap` registry drift.** Registered in
`PRODUCT_ASSESSMENT_FIELDS` with 11/15 fields while its config now says 9/9 — the config was
narrowed and the entry was not. Same divergence class as the one §6 exists to prevent. Correcting
it changes a live paid deliverable, so it wants its own dispatch.

**5 · Engine `any_unsure` sweep.** The hedge test used to be `flag.startsWith("unsure:")`, a
namespace no engine has ever used — every engine namespaces flags by question id. Measured across
**all six** engine-native products: all six ship "not sure" options and none could ever raise the
flag, so the confidence badge read HIGH on paths whose defining answer was "I'm not sure", and the
$147→$67 demotion could never fire. The mechanism is fixed platform-wide (`isHedgeOption` reads an
explicit `unsure` boolean, authoritative in both directions, else the shared `isHedge` matcher).
**What remains is the data:** each engine should mark its decisive-but-hedge-sounding options
`unsure: false` explicitly, as FRCGW's *"I don't know what a clearance certificate is"* now is —
that is a statement about what the seller knows, not doubt about their facts, and it routes to a
fully-determined position.

**6 · N1 — negation openers on other fields.** Fact rule 9 (§7) fixed the field it names. The same
shape survives elsewhere on the FRCGW recovery terminal: `applicationUrgency` opens *"There is no
urgency around a clearance certificate application now"* and `preSettlementExecutionPlan` opens
*"Since settlement has passed, pre-settlement actions no longer apply"*. The rule wants
generalising from one field to all of them.

**7 · N2 — every purchase generates the assessment twice.** `GET /api/get-assessment` 404s a few
seconds after the webhook starts (the webhook's row does not land until the LLM call returns,
~30s), so the success page falls back to `POST /api/assess` and generates a second time. The
on-screen pack and the stored/returned-to pack are therefore two different generations — and while
item 1 stands, from two different builds. A buyer who closes the tab and comes back gets the stale
one.

**8 · N3 — qualification answers not always persisted.** MEASURED on the 17 Aug $67 buy:
`decision_sessions.questionnaire_payload = {}`, `tier_intended = null`, `updated_at == created_at`
— the qualification update never fired, while the $147 session 47 seconds later persisted all
three answers. The client render states facts the stored assessment does not contain, so
`sessionStorage` held answers the database never received. Consequence: the emailed pack was
written from two maze answers, and conflict detection on the stored path had nothing to compare
against.

---

## Appendix · File map

| Concern | File | Registry / entry point |
|---|---|---|
| Terminal presentation, flags, spine, calendar | `lib/terminal-presentation.ts` | `TERMINAL_PRESENTATION`, `RETIRED_TERMINALS`, `terminalFlags`, `isPastSettlement`, `resolveSpine`, `resolveCalendar` |
| Document templating | `lib/doc-template.ts` | `renderDocTemplate`, `bindKeys`, `conditionalFlags` |
| Labels | `lib/terminal-labels.ts` | `DOC_LABELS`, `FIELD_LABELS` |
| Assessment field keys | `lib/assessment-fields.ts` | `PRODUCT_ASSESSMENT_FIELDS`, `resolveDisplayFields` |
| Fact rules | `lib/fact-rules.ts` | `PRODUCT_FACT_RULES` (mirrored in `ProductConfig.factRules`) |
| Conflicts, dates, buyer context | `lib/buyer-context.ts` | `CONFLICT_RULES`, `DATE_ANSWER_FIELD`, `buildBuyerContext`, `buyerContextFromSession` |
| The one generator, both callers | `lib/assess-core.ts` | `generateAssessment` |
| Stored-path terminal + date | `app/api/get-assessment/route.ts` | — |
| Gate-page GEO claims | `cole/types/product-config.ts`, `cole/generators/generate-gate-page.ts` | `geoClaims` |
| Behaviour tests | `cole/__tests__/frcgw-rebuild.behaviour.test.ts` | `npm run test:snap -- --test-name-pattern frcgw-rebuild` |
