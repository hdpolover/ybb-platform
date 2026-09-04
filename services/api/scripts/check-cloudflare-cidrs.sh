#!/usr/bin/env bash
# scripts/check-cloudflare-cidrs.sh
#
# Diff the CLOUDFLARE_CIDRS snapshot in src/shared/utils/client-ip.ts against
# Cloudflare's live published ranges (N4).
#
# Run it when you touch client-ip.ts, or periodically. It is deliberately NOT a
# jest test: a test that reaches the public internet fails whenever Cloudflare
# is unreachable, and would turn "Cloudflare added a range" into a red build on
# somebody else's unrelated PR. A stale list is not a security hole — an
# unrecognised edge address falls back to the plain x-forwarded-for handling,
# which is safe everywhere, just coarser behind the CDN. So this is a check you
# run, not a gate that runs you.
#
# Exit 0 = snapshot matches. Exit 1 = it drifted, and the diff says how.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC="src/shared/utils/client-ip.ts"

live=$(mktemp); ours=$(mktemp)
trap 'rm -f "$live" "$ours"' EXIT

# Both files can arrive without a trailing newline, which silently joins the
# last v4 range to the first v6 one. The explicit echo between them is what
# stops that; it cost a confusing diff the first time this was run by hand.
{
  curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4; echo
  curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6; echo
} | tr -d '\r' | grep -E '^[0-9a-fA-F][0-9a-fA-F.:]*/[0-9]+$' | sort -u > "$live"

# Pull the quoted entries out of the array literal only, so an unrelated
# quoted string elsewhere in the file cannot leak in.
awk '/^const CLOUDFLARE_CIDRS = \[/{f=1;next} /^\];/{f=0} f' "$SRC" \
  | grep -oE "'[^']+'" | tr -d "'" | sort -u > "$ours"

if diff -q "$live" "$ours" >/dev/null; then
  echo "CLOUDFLARE_CIDRS is current ($(wc -l < "$live" | tr -d ' ') ranges)."
  exit 0
fi

echo "CLOUDFLARE_CIDRS has drifted from the published list."
echo
echo "Published but MISSING from $SRC (these edges degrade to the XFF fallback):"
comm -23 "$live" "$ours" | sed 's/^/  + /' || true
echo
echo "In $SRC but no longer published (harmless, just stale):"
comm -13 "$live" "$ours" | sed 's/^/  - /' || true
exit 1
