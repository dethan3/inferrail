#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/2] Running Move tests..."
(
  cd "$ROOT_DIR/contracts/inferrail"
  sui move test
)
echo "[ok] Move tests passed."

echo "[2/2] Running frontend build check..."
if [[ ! -d "$ROOT_DIR/app/node_modules" ]]; then
  echo "[warn] app/node_modules not found."
  echo "[hint] Run: cd app && pnpm install"
  echo "[hint] Then rerun: ./scripts/verify.sh"
  exit 0
fi

if [[ ! -x "$ROOT_DIR/app/node_modules/.bin/tsc" ]] || [[ ! -x "$ROOT_DIR/app/node_modules/.bin/vite" ]]; then
  echo "[warn] Frontend dependencies are incomplete."
  echo "[hint] Run: cd app && pnpm install"
  echo "[hint] Then rerun: ./scripts/verify.sh"
  exit 0
fi

(
  cd "$ROOT_DIR/app"
  pnpm build
)
echo "[ok] Frontend build passed."

echo "Verification complete."
