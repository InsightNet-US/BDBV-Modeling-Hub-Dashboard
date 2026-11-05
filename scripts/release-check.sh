#!/usr/bin/env bash
# Gate for pull requests into main (run by release-check.yml): the head branch must be "preview" and
# the live /preview/ status must show this very commit built successfully. Polls the status for up to
# WAIT_SECS (default 1200) because the preview deploy runs at the same time as this check.
# env: HEAD_REF, HEAD_SHA, STATUS_URL; optional WAIT_SECS, POLL_SECS (test hooks).
set -euo pipefail
WAIT_SECS=${WAIT_SECS:-1200}; POLL_SECS=${POLL_SECS:-30}
if [ "${HEAD_REF:-}" != "preview" ]; then
  echo "::error::Only the preview branch may be merged into main. Merge '${HEAD_REF:-?}' into preview first, test it at /preview/, then open a pull request from preview."
  exit 1
fi
deadline=$(( $(date +%s) + WAIT_SECS ))
while :; do
  body=$(curl -fsS -H 'Cache-Control: no-cache' "${STATUS_URL}?t=$(date +%s)" || echo '{}')
  echo "preview status: $body"
  verdict=$(python3 - "$body" "$HEAD_SHA" <<'PY'
import json, sys
try: st = json.loads(sys.argv[1])
except Exception: st = {}
sha = sys.argv[2]; c = st.get("commit") or ""
if st.get("ok") and c and sha.startswith(c): print("ok")
elif st.get("reason") == "build failed": print("failed")
else: print("pending")
PY
)
  case "$verdict" in
    ok) echo "the preview copy shows commit ${HEAD_SHA:0:7}; release may proceed"; exit 0 ;;
    failed) echo "::error::The preview branch failed to build (see the preview-build issue); fix it before releasing."; exit 1 ;;
  esac
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "::error::The preview copy does not show commit ${HEAD_SHA:0:7} yet (deploy pending or cached). Wait for the preview deploy to finish, then re-run this check."
    exit 1
  fi
  sleep "$POLL_SECS"
done
