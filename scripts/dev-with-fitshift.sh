#!/usr/bin/env bash
set -euo pipefail

PCA_DIR="/workspaces/pca-app"
FITSHIFT_DIR="/workspaces/pca-app/planner_service"
FITSHIFT_PID=""

cleanup() {
  if [[ -n "${FITSHIFT_PID}" ]]; then
    kill "${FITSHIFT_PID}" 2>/dev/null || true
    wait "${FITSHIFT_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if [[ -d "${FITSHIFT_DIR}" ]]; then
  if lsof -i :4173 -n -P >/dev/null 2>&1; then
    echo "[dev] Fit-Shift already running on http://localhost:4173 (reusing existing process)"
  else
    echo "[dev] Starting Fit-Shift on http://localhost:4173"
    (
      cd "${FITSHIFT_DIR}"
      python3 -m fitshift
    ) &
    FITSHIFT_PID=$!
  fi
else
  echo "[dev] Planner service directory not found at ${FITSHIFT_DIR}; continuing with Next.js only"
fi

echo "[dev] Starting Next.js on http://localhost:3000"
cd "${PCA_DIR}"
npx next dev -H 0.0.0.0
