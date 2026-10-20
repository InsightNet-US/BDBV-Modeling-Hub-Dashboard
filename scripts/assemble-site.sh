#!/usr/bin/env bash
# Assemble the static site: real dashboard at the root (data/), mock dashboard at /mock/ (its own data).
# usage: scripts/assemble-site.sh <out_dir> <mock_data_dir> [asset_stamp]
set -euo pipefail
out=${1:?out dir}; mock=${2:?mock data dir}; stamp=${3:-dev}
cd "$(dirname "$0")/.."
rm -rf "$out"; mkdir -p "$out/mock"
cp index.html "$out/"; cp -r assets data "$out/"
cp index.html "$out/mock/"; cp -r assets "$out/mock/"; cp -r "$mock" "$out/mock/data"
# cache-bust local assets so browsers pick up new JS/CSS on every deploy
sed -i.bak "s/?v=dev/?v=$stamp/g" "$out/index.html" "$out/mock/index.html"; rm -f "$out/index.html.bak" "$out/mock/index.html.bak"
echo "site: $(du -sh "$out" | cut -f1) total, mock data $(du -sh "$out/mock/data" | cut -f1)"
