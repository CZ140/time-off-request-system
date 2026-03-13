#!/usr/bin/env bash
# check-bundle-secrets.sh
# Pre-deploy gate: verifies no secret variable names appear in the client bundle.
# Run this before every production deploy: bash scripts/check-bundle-secrets.sh
#
# What it checks: The NAMES of secret env vars (e.g. SUPABASE_SERVICE_ROLE_KEY) must
# not appear in .next/static JS files. If a name appears there, the variable was
# referenced in client-side code — a security violation (SEC-02).
#
# NOTE: .next/server/ intentionally contains secret names (server-side code). Only
# .next/static/ (the client bundle) is the security concern. Never grep .next/ root.

set -euo pipefail

echo "Building project..."
npm run build

echo ""
echo "Checking client bundle for leaked secret names..."

# Guard: confirm build output exists
if [ ! -d ".next/static" ]; then
  echo "FAIL: .next/static directory not found after build."
  exit 1
fi

FOUND=0

SECRETS=(
  "SUPABASE_SERVICE_ROLE_KEY"
  "APPROVAL_SECRET"
  "ADMIN_PASSWORD"
  "RESEND_API_KEY"
)

for SECRET in "${SECRETS[@]}"; do
  if grep -r -l "$SECRET" .next/static --include="*.js" 2>/dev/null | grep -q .; then
    echo "FAIL: Found '$SECRET' in client bundle (.next/static)"
    FOUND=1
  fi
done

echo ""
if [ "$FOUND" -eq 0 ]; then
  echo "PASS: No secret names found in client bundle."
  exit 0
else
  echo "FAIL: Secret leak detected. Audit NEXT_PUBLIC_ prefix usage in client components."
  exit 1
fi
