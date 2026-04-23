#!/usr/bin/env bash
# Reseed the production memory volume on Railway from the baked-in seed files.
#
# Use this ONLY to reset a volume that has drifted and you want the starter
# content back. It wipes `/app/memories/claude/` inside the live container
# and copies `/app/memories/claude.seed/` over it.
#
# Requires: railway CLI, logged in, project linked.
#   curl -fsSL https://railway.com/install.sh | sh
#   railway login
#   railway link
#
# Usage:
#   ./scripts/railway-seed.sh
#
# Dry-run first:
#   railway run sh -c 'ls -la /app/memories/claude/'
set -euo pipefail

cat <<'EOF'
This will DELETE every file under /app/memories/claude/ on the Railway service
and recopy the seed content shipped in the Docker image at
/app/memories/claude.seed/.

Conversations and in-memory state are unaffected — this only touches the
memory-tool filesystem.
EOF

read -rp "Type 'reseed' to proceed: " confirm
if [ "$confirm" != "reseed" ]; then
  echo "Aborted."
  exit 1
fi

railway run sh -c '
  set -e
  echo "Before:"
  ls -la /app/memories/claude/ | head -20
  rm -rf /app/memories/claude/*
  rm -rf /app/memories/claude/.[!.]* 2>/dev/null || true
  cp -a /app/memories/claude.seed/. /app/memories/claude/
  echo
  echo "After:"
  ls -la /app/memories/claude/
'
echo "Done."
