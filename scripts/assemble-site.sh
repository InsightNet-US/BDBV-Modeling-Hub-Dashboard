#!/usr/bin/env bash
# Assemble the static site: the live dashboard at the root (this checkout's index.html, assets/, data/)
# and the gated preview copy at /preview/, staged from <preview_dir> (a checkout of the preview branch
# with its own data/ built) or, without one, from this checkout.
# usage: PREVIEW_PASSPHRASE=... scripts/assemble-site.sh <out_dir> [asset_stamp] [preview_dir] [preview_stamp]
# <out_dir> is resolved against the repository root (give an absolute path to be safe); it is replaced.
set -euo pipefail
out=${1:?out dir}; stamp=${2:-dev}; pvdir=${3:-}; pvstamp=${4:-$stamp}
if [ -n "$pvdir" ]; then
  pvdir=$(cd "$pvdir" && pwd)
  for f in index.html assets data; do [ -e "$pvdir/$f" ] || { echo "assemble-site: $pvdir has no $f" >&2; exit 1; }; done
fi
cd "$(dirname "$0")/.."
src=${pvdir:-$PWD}
# gate hash: SHA-256 of the test phrase (default "testme"); the page compares it with what the visitor types
hash=$(python3 -c 'import hashlib, os, sys; print(hashlib.sha256(os.environ.get("PREVIEW_PASSPHRASE", "testme").strip().encode()).hexdigest())')
[[ $hash =~ ^[0-9a-f]{64}$ ]] || { echo "assemble-site: could not hash the preview passphrase" >&2; exit 1; }
rm -rf "$out"; mkdir -p "$out/preview"
cp index.html "$out/"; cp -r assets data "$out/"
cp "$src/index.html" "$out/preview/"; cp -r "$src/assets" "$src/data" "$out/preview/"
# cache-bust local assets so browsers pick up new JS/CSS on every deploy
sed -i.bak "s/?v=dev/?v=$stamp/g" "$out/index.html"
sed -i.bak "s/?v=dev/?v=$pvstamp/g" "$out/preview/index.html"
# mark the preview copy with the gate hash (sed exits 0 on a miss, so check the result explicitly)
sed -i.bak "s/name=\"bdbv-preview\" content=\"\"/name=\"bdbv-preview\" content=\"$hash\"/" "$out/preview/index.html"
rm -f "$out/index.html.bak" "$out/preview/index.html.bak"
grep -q "name=\"bdbv-preview\" content=\"$hash\"" "$out/preview/index.html" || { echo "assemble-site: preview marker not set (index.html changed?)" >&2; exit 1; }
grep -q 'name="bdbv-preview" content=""' "$out/index.html" || { echo "assemble-site: the live page must carry an empty preview marker" >&2; exit 1; }
# what the preview copy was built from; the Action overwrites this with the run's full record
python3 - "$([ -n "$pvdir" ] && echo preview || echo main)" "$([ -n "$pvdir" ] && echo "$pvstamp")" <<'EOF' > "$out/preview/status.json"
import json, sys, datetime
src, sha = sys.argv[1:3]
print(json.dumps({"ok": True, "source": src, "branch": "preview", "commit": sha or None,
                  "built": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                  "run_url": None, "reason": None}))
EOF
echo "site: $(du -sh "$out" | cut -f1) total (live root from $PWD, preview copy from $src)"
