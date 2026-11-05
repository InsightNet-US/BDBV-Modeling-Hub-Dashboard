#!/usr/bin/env bash
# Assemble the static site from one build: the live dashboard at the root (data/) and the gated preview
# copy at /preview/ (same code, same data, features under development switched on).
# usage: PREVIEW_PASSPHRASE=... scripts/assemble-site.sh <out_dir> [asset_stamp]
# <out_dir> is resolved against the repository root (give an absolute path to be safe); it is replaced.
set -euo pipefail
out=${1:?out dir}; stamp=${2:-dev}
cd "$(dirname "$0")/.."
# gate hash: SHA-256 of the test phrase (default "testme"); the page compares it with what the visitor types
hash=$(python3 -c 'import hashlib, os, sys; print(hashlib.sha256(os.environ.get("PREVIEW_PASSPHRASE", "testme").strip().encode()).hexdigest())')
[[ $hash =~ ^[0-9a-f]{64}$ ]] || { echo "assemble-site: could not hash the preview passphrase" >&2; exit 1; }
rm -rf "$out"; mkdir -p "$out/preview"
cp index.html "$out/"; cp -r assets data "$out/"
cp index.html "$out/preview/"; cp -r assets data "$out/preview/"
# cache-bust local assets so browsers pick up new JS/CSS on every deploy
sed -i.bak "s/?v=dev/?v=$stamp/g" "$out/index.html" "$out/preview/index.html"
# mark the preview copy with the gate hash (sed exits 0 on a miss, so check the result explicitly)
sed -i.bak "s/name=\"bdbv-preview\" content=\"\"/name=\"bdbv-preview\" content=\"$hash\"/" "$out/preview/index.html"
rm -f "$out/index.html.bak" "$out/preview/index.html.bak"
grep -q "name=\"bdbv-preview\" content=\"$hash\"" "$out/preview/index.html" || { echo "assemble-site: preview marker not set (index.html changed?)" >&2; exit 1; }
grep -q 'name="bdbv-preview" content=""' "$out/index.html" || { echo "assemble-site: the live page must carry an empty preview marker" >&2; exit 1; }
echo "site: $(du -sh "$out" | cut -f1) total (live root + preview copy with the same data)"
