#!/usr/bin/env bash
# Everyday run of the report (owner request 2026-09-21): database up, a PRODUCTION
# build when the code has moved, then `next start` on port 3000.
#
#   scripts/serve.sh            # what the systemd user unit runs
#   FORCE_BUILD=1 scripts/serve.sh
#
# Production, not `next dev`: pages are compiled once at build time, so the first
# open of a page is as fast as the next one. The build is re-done only when HEAD or
# the working tree differs from the stamp left by the previous build.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")/.."

# systemd starts this without a login shell: bring in node from nvm.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null
export PATH="$HOME/.local/bin:$PATH"

log() { printf '[serve %s] %s\n' "$(date +%H:%M:%S)" "$*"; }

# 1. database — Docker may still be starting right after boot.
for i in $(seq 1 60); do
  if docker info >/dev/null 2>&1; then break; fi
  [ "$i" = 1 ] && log "waiting for docker…"
  sleep 2
done
npm run --silent db:up
for i in $(seq 1 60); do
  state=$(docker inspect -f '{{.State.Health.Status}}' weld_report_db 2>/dev/null || echo unknown)
  [ "$state" = healthy ] && break
  [ "$i" = 1 ] && log "waiting for postgres (state: $state)…"
  sleep 2
done
log "database: $(docker inspect -f '{{.State.Health.Status}}' weld_report_db 2>/dev/null || echo unknown)"

# 2. build when stale
stamp=.next/BUILD_STAMP
# The stamp covers the CONTENT of uncommitted work, not just the list of changed
# files: a second edit to an already-modified file must trigger a rebuild too.
tree_hash() {
  {
    git diff HEAD 2>/dev/null
    git ls-files --others --exclude-standard -z 2>/dev/null | xargs -0 -r sha1sum 2>/dev/null
  } | sha1sum | cut -c1-12
}
want="$(git rev-parse HEAD 2>/dev/null || echo nogit):$(tree_hash)"
if [ "${FORCE_BUILD:-0}" = 1 ] || [ ! -f .next/BUILD_ID ] || [ "$(cat "$stamp" 2>/dev/null)" != "$want" ]; then
  log "building (stamp $want)…"
  npm run --silent build
  printf '%s' "$want" > "$stamp"
else
  log "build is current ($want)"
fi

# 3. warm the read cache in the background once the server answers, so nobody
#    pays the first full scans (2–5 s a page): the main pages and every screen.
(
  for i in $(seq 1 60); do
    curl -s -o /dev/null --max-time 3 "http://localhost:${PORT:-3000}/api/health" && break
    sleep 2
  done
  for u in welding/1 welding/2 welding/3 report/overview report/status report/subco report/nde report/pwht report/wps report/demo report/demo2 flange; do
    curl -s -o /dev/null --max-time 120 "http://localhost:${PORT:-3000}/$u" || true
  done
  printf '[serve %s] cache warmed\n' "$(date +%H:%M:%S)"
) &

# 4. serve
log "starting next start on :${PORT:-3000}"
exec npm run --silent start -- -p "${PORT:-3000}"
