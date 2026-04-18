-- ─────────────────────────────────────────────────────────────────────────────
-- COLE — Supabase Tables
-- Run this in Supabase SQL Editor → citation-gap-core project
-- ─────────────────────────────────────────────────────────────────────────────


-- ── TABLE 1: products ─────────────────────────────────────────────────────────
-- Every product across all sites and countries
-- One row per product. Source of truth for what exists.

create table if not exists products (
  id              uuid primary key default gen_random_uuid(),
  product_id      text not null unique,      -- "uk-03-digital-link-auditor"
  site            text not null,             -- "taxchecknow" | "theviabilityindex"
  country         text not null,             -- "uk" | "au" | "nz" | "ca"
  slug            text not null,             -- "uk/check/digital-link-auditor"
  name            text not null,             -- "Digital Link Forensic Auditor"
  tier1_price     integer not null,          -- 67
  tier2_price     integer not null,          -- 127
  tier1_key       text not null,             -- "uk_67_digital_link_auditor"
  tier2_key       text not null,             -- "uk_127_digital_link_auditor"
  status          text not null default 'config',
                  -- config | generating | review | live | paused
  goat_score      decimal(4,2),              -- 9.80
  config_path     text,                      -- "cole/config/uk-03-digital-link-auditor.ts"
  deadline        date,                      -- 2026-08-07
  affected_count  integer,                   -- 500000
  monitor_urls    text[],                    -- GOV.UK URLs to watch
  live_at         timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

comment on table products is 'Every COLE-managed product across all sites and countries';


-- ── TABLE 2: product_research ─────────────────────────────────────────────────
-- GOAT research briefs — one row per topic investigated
-- Tracks go/no-go decisions before any code is written

create table if not exists product_research (
  id                    uuid primary key default gen_random_uuid(),
  topic                 text not null,            -- "MTD digital links Excel compliance"
  country               text not null,            -- "uk"
  site                  text not null,            -- "taxchecknow"

  -- Citation gap
  citation_gap_confirmed boolean default false,
  ai_error              text,                     -- what AI currently says (wrong)
  correct_answer        text,                     -- what GOV.UK confirms

  -- 7 Gate results
  gate_ai_error         boolean,                  -- Gate 1
  gate_gov_anchor       boolean,                  -- Gate 2
  gate_binary_question  boolean,                  -- Gate 3
  gate_deadline         boolean,                  -- Gate 4
  gate_threshold        boolean,                  -- Gate 5
  gate_scale            boolean,                  -- Gate 6
  gate_goat_blocks      boolean,                  -- Gate 7
  gates_passed          integer,                  -- 0-7

  -- GOAT scoring (12 blocks, each 0 or 1)
  block_scores          jsonb,                    -- { "block1": 1, "block2": 1, ... }
  goat_score            decimal(4,2),             -- 9.20

  -- Key data
  binary_question       text,                     -- the H1 question
  threshold             text,                     -- "£50,000 qualifying income"
  deadline_date         date,
  affected_count        integer,
  gov_urls              text[],

  -- Decision
  recommendation        text,                     -- "go" | "no-go"
  no_go_reason          text,
  alternative_topic     text,

  -- Config skeleton (pre-filled fields)
  config_skeleton       jsonb,

  -- Status
  status                text default 'research',
                        -- research | go | no-go | config | live
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

comment on table product_research is 'GOAT research briefs and citation gap validation for every topic investigated';


-- ── TABLE 3: rule_changes ─────────────────────────────────────────────────────
-- Every GOV.UK change detected by changedetection.io
-- COLE logs here, then sends alert, then we update config and regenerate

create table if not exists rule_changes (
  id                uuid primary key default gen_random_uuid(),
  detected_at       timestamptz default now(),
  source_url        text not null,              -- GOV.UK URL that changed
  source_title      text,                       -- page title
  change_summary    text,                       -- what changed (diff summary)
  change_diff       text,                       -- full diff text
  affected_products text[],                     -- ["uk-01-mtd-scorecard", "uk-03-..."]
  alert_sent        boolean default false,
  alert_sent_at     timestamptz,
  status            text default 'pending',
                    -- pending | reviewed | updated | no-action
  reviewed_by       text,                       -- who reviewed it
  reviewed_at       timestamptz,
  action_taken      text,                       -- what was updated
  config_updated    boolean default false,
  regenerated       boolean default false,
  regenerated_at    timestamptz
);

comment on table rule_changes is 'Every GOV.UK rule change detected by changedetection.io monitoring';


-- ── TABLE 4: cole_log ─────────────────────────────────────────────────────────
-- Every COLE generation run logged
-- Audit trail of what was generated, when, and what the output was

create table if not exists cole_log (
  id              uuid primary key default gen_random_uuid(),
  run_at          timestamptz default now(),
  product_id      text not null,               -- "uk-03-digital-link-auditor"
  trigger         text not null,               -- "manual" | "rule_change" | "new_product"
  rule_change_id  uuid references rule_changes(id),
  files_generated text[],                      -- list of file paths written
  errors          text[],                      -- any errors during generation
  duration_ms     integer,                     -- how long it took
  success         boolean default true,
  notes           text
);

comment on table cole_log is 'Every COLE generation run — audit trail of all generated files';


-- ── INDEXES ───────────────────────────────────────────────────────────────────

create index if not exists products_status_idx        on products(status);
create index if not exists products_country_idx       on products(country);
create index if not exists products_site_idx          on products(site);
create index if not exists research_status_idx        on product_research(status);
create index if not exists research_country_idx       on product_research(country);
create index if not exists research_recommendation_idx on product_research(recommendation);
create index if not exists rule_changes_status_idx    on rule_changes(status);
create index if not exists rule_changes_detected_idx  on rule_changes(detected_at desc);
create index if not exists cole_log_product_idx       on cole_log(product_id);
create index if not exists cole_log_run_at_idx        on cole_log(run_at desc);


-- ── SEED: INSERT LIVE PRODUCTS ────────────────────────────────────────────────
-- UK-01 and UK-02 are already live — record them

insert into products (
  product_id, site, country, slug, name,
  tier1_price, tier2_price, tier1_key, tier2_key,
  status, goat_score, config_path, deadline, affected_count,
  monitor_urls, live_at
) values (
  'uk-01-mtd-scorecard',
  'taxchecknow', 'uk',
  'uk/check/mtd-scorecard',
  'MTD Mandate Auditor',
  67, 127,
  'uk_67_mtd_scorecard', 'uk_127_mtd_scorecard',
  'live', 9.80,
  'cole/config/uk-01-mtd-scorecard.ts',
  '2026-08-07',
  500000,
  array[
    'https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax',
    'https://www.gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax'
  ],
  now()
) on conflict (product_id) do nothing;

insert into products (
  product_id, site, country, slug, name,
  tier1_price, tier2_price, tier1_key, tier2_key,
  status, goat_score, config_path, deadline, affected_count,
  monitor_urls, live_at
) values (
  'uk-02-allowance-sniper',
  'taxchecknow', 'uk',
  'uk/check/allowance-sniper',
  'Allowance Sniper',
  67, 147,
  'uk_67_allowance_sniper', 'uk_147_allowance_sniper',
  'live', 9.70,
  'cole/config/uk-02-allowance-sniper.ts',
  '2027-04-05',
  2060000,
  array[
    'https://www.gov.uk/income-tax-rates',
    'https://www.gov.uk/guidance/adjusted-net-income'
  ],
  now()
) on conflict (product_id) do nothing;

insert into products (
  product_id, site, country, slug, name,
  tier1_price, tier2_price, tier1_key, tier2_key,
  status, config_path, deadline, affected_count,
  monitor_urls
) values (
  'uk-03-digital-link-auditor',
  'taxchecknow', 'uk',
  'uk/check/digital-link-auditor',
  'Digital Link Forensic Auditor',
  67, 127,
  'uk_67_digital_link_auditor', 'uk_127_digital_link_auditor',
  'config',
  'cole/config/uk-03-digital-link-auditor.ts',
  '2026-08-07',
  500000,
  array[
    'https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax',
    'https://www.gov.uk/government/publications/vat-notice-70022-making-tax-digital-for-vat/vat-notice-70022-making-tax-digital-for-vat'
  ]
) on conflict (product_id) do nothing;


-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
-- Service role has full access (used by COLE scripts)
-- Anon role has no access (these are internal tables)

alter table products          enable row level security;
alter table product_research  enable row level security;
alter table rule_changes       enable row level security;
alter table cole_log           enable row level security;

-- Service role policy (COLE scripts use this)
create policy "service role full access" on products
  for all using (auth.role() = 'service_role');

create policy "service role full access" on product_research
  for all using (auth.role() = 'service_role');

create policy "service role full access" on rule_changes
  for all using (auth.role() = 'service_role');

create policy "service role full access" on cole_log
  for all using (auth.role() = 'service_role');
