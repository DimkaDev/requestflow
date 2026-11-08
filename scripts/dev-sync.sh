#!/usr/bin/env bash
set -euo pipefail

# FlowTrace Cloud <-> Local Agent Synchronization & Status Helper

CMD="${1:-status}"

case "$CMD" in
  status)
    echo "=== FlowTrace Workspace Status ==="
    echo "Git Branch : $(git rev-parse --abbrev-ref HEAD)"
    echo "Last Commit: $(git log -n 1 --oneline)"
    echo ""
    echo "--- Git Working Tree ---"
    git status -s
    echo ""
    echo "--- Latest Worklog Entry (docs/WORKLOG.md) ---"
    awk '/^## История сессий/{flag=1; next} /^---/{if(flag) exit} flag' docs/WORKLOG.md | head -n 25
    ;;

  pull)
    echo "Pulling latest changes from origin/main..."
    git pull --rebase origin main
    "$0" status
    ;;

  push)
    MSG="${2:-chore: sync agent worklog and changes}"
    git add -A
    git commit -m "$MSG" || echo "Nothing new to commit"
    git push origin main
    echo "Successfully pushed to origin/main."
    ;;

  *)
    echo "Usage: ./scripts/dev-sync.sh [status|pull|push \"commit message\"]"
    exit 1
    ;;
esac
