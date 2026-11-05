#!/usr/bin/env bash
# Open, update or close the "preview branch failed to build" issue (label preview-build). Run by the
# Action after the site is assembled; needs gh with GH_TOKEN/GH_REPO, PV_OUTCOME (outcome of the
# preview build step: success | failure | skipped) and RUN_URL. The log is read from preview-build.log.
set -euo pipefail
LABEL=preview-build
gh label create "$LABEL" --color d93f0b --description "The preview branch failed to build" --force >/dev/null
open=$(gh issue list --label "$LABEL" --state open --json number --jq '.[0].number // empty')
if [ "${PV_OUTCOME:-}" = "failure" ]; then
  sha=$(git -C _pv rev-parse --short HEAD 2>/dev/null || echo "unknown")
  {
    echo "The \`preview\` branch (commit \`$sha\`) failed its tests or pipeline build, so \`/preview/\` is showing the live version until it is fixed."
    echo
    echo "Run: $RUN_URL"
    echo
    echo "Last lines of the build log:"
    echo
    echo '```'
    tail -n 60 preview-build.log 2>/dev/null || echo "(no log captured)"
    echo '```'
    echo
    echo "This issue is updated on every run while the branch stays broken and closed automatically when it builds again."
  } > preview-issue.md
  if [ -n "$open" ]; then
    gh issue comment "$open" --body-file preview-issue.md
    echo "commented on issue #$open"
  else
    gh issue create --title "Preview branch failed to build" --label "$LABEL" --body-file preview-issue.md
    echo "opened a new issue"
  fi
else
  if [ -n "$open" ]; then
    gh issue close "$open" --comment "The preview branch builds again ($RUN_URL)."
    echo "closed issue #$open"
  else
    echo "preview build ${PV_OUTCOME:-skipped}: nothing to report"
  fi
fi
