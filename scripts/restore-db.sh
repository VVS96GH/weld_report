#!/usr/bin/env bash
# Restore a backup made by scripts/backup-db.sh.
#
#   scripts/restore-db.sh <file.dump>                  into a test database weld_restore_test (safe)
#   scripts/restore-db.sh <file.dump> weld_report      over the live database (stop the site first)
#
# The target database is dropped and created anew. Materialised views are rebuilt
# from their definitions, so a full restore takes a while.
set -euo pipefail
FILE="${1:?usage: restore-db.sh <file.dump> [target_db]}"
TARGET="${2:-weld_restore_test}"
CONTAINER="${CONTAINER:-weld_report_db}"
DB_USER="${DB_USER:-weld}"
echo "restore $FILE -> $TARGET"
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"$TARGET\" WITH (FORCE)" -c "CREATE DATABASE \"$TARGET\""
docker exec -i "$CONTAINER" pg_restore -U "$DB_USER" -d "$TARGET" --no-owner -j 1 < "$FILE"
echo "restored into $TARGET"
