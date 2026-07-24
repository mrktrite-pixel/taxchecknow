#!/usr/bin/env bash
# diff-scope-assert.sh — MACHINE diff-scope green flag for a PANELBEAT update branch.
# The operator does NOT eyeball scope. Run this; paste the verdict into the PR body.
#
# Usage:  scripts/diff-scope-assert.sh <product-slug> [base-ref]
#   e.g.  scripts/diff-scope-assert.sh frcgw-clearance-certificate origin/main
#
# ALLOWED:
#   - app/<country>/check/<slug>/**                  (the product being updated)
#   - app/api/rules/<...>/**                         (its corpus route, incl. resolver-aliased)
#   - declared shared/checkout/assess/core:
#       app/api/create-checkout-session/route.ts, app/api/get-session/route.ts,
#       app/api/assess/route.ts, app/api/stripe/webhook/route.ts,
#       lib/assess-core.ts, lib/composer-inputs.ts, lib/assessment-fields.ts,
#       app/_components/Engine*.tsx  (shared engine components)
#   - cole/generators/generate-success-pages.ts, cole/scripts/cole-generate.ts  (tripwire/emit)
# HARD FAIL (any one = FAIL):
#   - cole/config/**            (config must not change in an update)
#   - STRIPE_* / .env* files    (commerce/env must not change in an update)
# Anything else → REVIEW (surfaces for a human ruling; does not auto-pass or auto-fail).
set -euo pipefail

SLUG="${1:?usage: diff-scope-assert.sh <product-slug> [base-ref]}"
BASE_REF="${2:-origin/main}"
BASE="$(git merge-base "$BASE_REF" HEAD)"

FAILS=0; REVIEWS=0; OK=0
echo "DIFF-SCOPE ASSERTION — HEAD vs ${BASE_REF} (merge-base ${BASE:0:9}) · slug=${SLUG}"
echo "----------------------------------------------------------------------"
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in
    cole/config/*)                                        echo "  HARD-FAIL  (cole/config)       $f"; FAILS=$((FAILS+1));;
    *.env|*.env.*|.env|.env.*|*STRIPE_*)                  echo "  HARD-FAIL  (STRIPE_/env)       $f"; FAILS=$((FAILS+1));;
    app/*/check/"$SLUG"/*)                                echo "  allowed    (product)           $f"; OK=$((OK+1));;
    app/api/rules/*)                                      echo "  allowed    (corpus route)      $f"; OK=$((OK+1));;
    app/api/create-checkout-session/route.ts|app/api/get-session/route.ts|app/api/assess/route.ts|app/api/stripe/webhook/route.ts) echo "  allowed    (declared shared)   $f"; OK=$((OK+1));;
    lib/assess-core.ts|lib/composer-inputs.ts|lib/assessment-fields.ts) echo "  allowed    (declared core)     $f"; OK=$((OK+1));;
    app/_components/Engine*.tsx)                          echo "  allowed    (shared engine)     $f"; OK=$((OK+1));;
    cole/generators/generate-success-pages.ts|cole/scripts/cole-generate.ts) echo "  allowed    (cole tripwire/emit) $f"; OK=$((OK+1));;
    *)                                                    echo "  REVIEW     (undeclared)        $f"; REVIEWS=$((REVIEWS+1));;
  esac
done < <(git diff --name-only "$BASE"..HEAD)

echo "----------------------------------------------------------------------"
echo "allowed=${OK}  review=${REVIEWS}  hard-fail=${FAILS}"
if [ "$FAILS" -gt 0 ]; then
  echo "VERDICT: FAIL — ${FAILS} forbidden file(s) (cole/config or STRIPE_/env). Merge blocked."
  exit 1
elif [ "$REVIEWS" -gt 0 ]; then
  echo "VERDICT: PASS-WITH-REVIEW — 0 hard-fails; ${REVIEWS} undeclared file(s) need a human ruling before merge."
  exit 0
else
  echo "VERDICT: PASS — 0 hard-fails, 0 undeclared. Scope clean."
  exit 0
fi
