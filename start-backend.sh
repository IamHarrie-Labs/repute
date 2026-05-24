#!/bin/sh
# ── Repute backend startup script ────────────────────────────────────────────
# Starts API, Scoring, and Indexer in the correct order.
# Set RUN_AGENTS=true to also start the merchant + buyer demo agents.
# ─────────────────────────────────────────────────────────────────────────────

set -e

NODE_FLAGS="--experimental-strip-types --experimental-sqlite"
PORT=${PORT:-3001}
echo "[repute] starting · PORT=$PORT · DATA_DIR=${DATA_DIR:-/data} · DEMO_MODE=${DEMO_MODE:-true}"

# ── API server (must start first — other services talk to it) ─────────────
node $NODE_FLAGS packages/api/src/index.ts &
PID_API=$!
echo "[repute] api      → pid $PID_API"

# Wait briefly so API creates the DB schema before others open the file
sleep 2

# ── Scoring engine ────────────────────────────────────────────────────────
node $NODE_FLAGS packages/scoring/src/index.ts &
PID_SCORING=$!
echo "[repute] scoring  → pid $PID_SCORING"

# ── Indexer (Arc watcher or simulator) ───────────────────────────────────
node $NODE_FLAGS packages/indexer/src/index.ts &
PID_INDEXER=$!
echo "[repute] indexer  → pid $PID_INDEXER"

# ── Agents (optional — enable with RUN_AGENTS=true) ──────────────────────
if [ "${RUN_AGENTS}" = "true" ]; then
  sleep 2  # let merchants boot before buyers start calling them
  node --experimental-strip-types packages/agents/src/merchants.ts &
  PID_MERCHANTS=$!
  echo "[repute] merchants → pid $PID_MERCHANTS"

  sleep 2
  node --experimental-strip-types packages/agents/src/buyers.ts &
  PID_BUYERS=$!
  echo "[repute] buyers   → pid $PID_BUYERS"
fi

echo "[repute] all services up · http://localhost:$PORT/health"

# Graceful shutdown on SIGTERM (Railway sends this before killing)
cleanup() {
  echo "[repute] shutting down..."
  kill $PID_API $PID_SCORING $PID_INDEXER $PID_MERCHANTS $PID_BUYERS 2>/dev/null || true
  exit 0
}
trap cleanup TERM INT

# Block until the API process exits (if it crashes, container restarts)
wait $PID_API
