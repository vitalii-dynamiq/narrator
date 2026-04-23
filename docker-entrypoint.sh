#!/bin/sh
# Entrypoint for the UNITY Narrator container.
#   1. Ensure the memory directory exists.
#   2. If empty (fresh Railway volume, fresh compose bind-mount, …), copy the
#      shipped seed files into it. Subsequent starts leave existing files
#      untouched so agent-written memory persists.
#   3. Exec the Next.js standalone server.
set -e

MEMORY_DIR="/app/memories/claude"
SEED_DIR="/app/memories/claude.seed"

mkdir -p "$MEMORY_DIR"

if [ -d "$SEED_DIR" ] && [ -z "$(ls -A "$MEMORY_DIR" 2>/dev/null)" ]; then
  echo "[unity] seeding $MEMORY_DIR from $SEED_DIR"
  cp -a "$SEED_DIR/." "$MEMORY_DIR/"
fi

echo "[unity] PORT=${PORT:-7340} HOSTNAME=${HOSTNAME:-0.0.0.0} — starting Next.js standalone server"
exec node server.js
