#!/usr/bin/env bash
set -euo pipefail

PCA_DIR="/workspaces/pca-app"
FITSHIFT_DIR="/workspaces/pca-app/planner_service"
WRAPPER_LOCK_FILE="/tmp/pca-dev-wrapper.lock"
FITSHIFT_PID=""
SHUTDOWN_REQUESTED=0
MAX_NEXT_RESTARTS=3
NEXT_RESTART_COUNT=0
MAX_CLEAN_EXITS=3
CLEAN_EXIT_COUNT=0
NEXT_DEV_ENGINE="${NEXT_DEV_ENGINE:-webpack}"

if [[ "${NEXT_DEV_ENGINE}" == "turbopack" ]]; then
  NEXT_DEV_ARGS=(dev -H 0.0.0.0)
else
  NEXT_DEV_ARGS=(dev --webpack -H 0.0.0.0)
fi

exec 9>"${WRAPPER_LOCK_FILE}"
if ! flock -n 9; then
  echo "[dev] Another dev wrapper instance is already running."
  echo "[dev] Stop other npm run dev sessions first, then retry."
  exit 1
fi

cleanup_stale_next_lock() {
  local next_lock_file="${PCA_DIR}/.next/dev/lock"
  if [[ -f "${next_lock_file}" ]] \
    && ! pgrep -f "${PCA_DIR}/node_modules/.bin/next dev" >/dev/null 2>&1 \
    && ! pgrep -f "next-server \(v" >/dev/null 2>&1; then
    rm -f "${next_lock_file}"
    echo "[dev] Removed stale Next.js lock at .next/dev/lock"
  fi
}

cleanup_orphan_next_processes() {
  # Kill prior workspace-scoped next dev processes so we always run a single dev instance.
  pkill -f "${PCA_DIR}/node_modules/.bin/next dev" 2>/dev/null || true
  pkill -f "next-server \(v" 2>/dev/null || true
}

cleanup() {
  SHUTDOWN_REQUESTED=1
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

echo "[dev] Starting Next.js on http://localhost:3000 (${NEXT_DEV_ENGINE})"
cd "${PCA_DIR}"
while true; do
  cleanup_orphan_next_processes
  cleanup_stale_next_lock

  set +e
  "${PCA_DIR}/node_modules/.bin/next" "${NEXT_DEV_ARGS[@]}"
  NEXT_EXIT_CODE=$?
  set -e

  if [[ "${SHUTDOWN_REQUESTED}" -eq 1 ]]; then
    exit 0
  fi

  if [[ "${NEXT_EXIT_CODE}" -eq 0 ]]; then
    # In some environments `next dev` exits while a detached next-server stays alive.
    # If that process exists, keep this wrapper alive instead of restart-looping.
    if pgrep -f "next-server \(v" >/dev/null 2>&1; then
      echo "[dev] Next.js CLI exited, but next-server is still running; waiting for it to stop..."
      while pgrep -f "next-server \(v" >/dev/null 2>&1; do
        if [[ "${SHUTDOWN_REQUESTED}" -eq 1 ]]; then
          exit 0
        fi
        sleep 2
      done
      echo "[dev] next-server stopped; restarting Next.js..."
      continue
    fi

    CLEAN_EXIT_COUNT=$((CLEAN_EXIT_COUNT + 1))
    if [[ "${CLEAN_EXIT_COUNT}" -gt "${MAX_CLEAN_EXITS}" ]]; then
      echo "[dev] Next.js exited cleanly ${MAX_CLEAN_EXITS} times; stopping to avoid restart loop."
      echo "[dev] Run npm run dev again. For stability keep NEXT_DEV_ENGINE=webpack (default)."
      exit 1
    fi

    echo "[dev] Next.js exited cleanly but unexpectedly; restarting (${CLEAN_EXIT_COUNT}/${MAX_CLEAN_EXITS})..."
    sleep 1
    continue
  fi

  CLEAN_EXIT_COUNT=0

  NEXT_RESTART_COUNT=$((NEXT_RESTART_COUNT + 1))
  if [[ "${NEXT_RESTART_COUNT}" -gt "${MAX_NEXT_RESTARTS}" ]]; then
    echo "[dev] Next.js exited ${MAX_NEXT_RESTARTS} times; stopping to avoid restart loop."
    echo "[dev] Fix the underlying issue (port conflict, stale process, or lock), then rerun npm run dev."
    exit "${NEXT_EXIT_CODE}"
  fi

  echo "[dev] Next.js exited with code ${NEXT_EXIT_CODE}; restarting (${NEXT_RESTART_COUNT}/${MAX_NEXT_RESTARTS})..."
  sleep 1
done
