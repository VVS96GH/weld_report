#!/usr/bin/env bash
# Daily backup of the weld_report database (owner, 2026-10-19).
#
#   scripts/backup-db.sh            make a backup now
#
# Writes to the Windows disk, outside WSL, so a damaged WSL disk does not take the
# backups with it:
#   <BACKUP_DIR>/weld_report_<YYYY-MM-DD_HHMM>.dump   pg_dump custom format (compressed)
#   <BACKUP_DIR>/cum_files_<YYYY-MM-DD_HHMM>.tar.gz   the CUM workbooks the site writes to
# The staging table stg_weld_dump is kept as structure only (it is rebuilt by
# every load). Materialised views are stored as definitions and rebuilt on restore.
# Each dump is checked by listing its contents; the last KEEP backups are kept.
# Restore: scripts/restore-db.sh <file.dump> [target_db]
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/mnt/c/Users/meg19/WeldReportBackup}"
KEEP="${KEEP:-7}"
CONTAINER="${CONTAINER:-weld_report_db}"
DB="${DB:-weld_report}"
DB_USER="${DB_USER:-weld}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y-%m-%d_%H%M)"

mkdir -p "$BACKUP_DIR"
log() { echo "$(date '+%F %T') $*" | tee -a "$BACKUP_DIR/backup.log"; }

DUMP="$BACKUP_DIR/weld_report_$STAMP.dump"
TMP="$DUMP.part"
log "backup start -> $DUMP"
start=$(date +%s)
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB" -Fc -Z 6 \
  --exclude-table-data=stg_weld_dump > "$TMP"
# integrity: the archive must list, and must hold the main table's data
docker exec -i "$CONTAINER" pg_restore --list < "$TMP" > "$TMP.toc"
grep -q "TABLE DATA public weld " "$TMP.toc" || { log "FAILED: no weld data in the dump"; rm -f "$TMP" "$TMP.toc"; exit 1; }
rm -f "$TMP.toc"
mv "$TMP" "$DUMP"
size=$(du -h "$DUMP" | cut -f1)
log "database ok: $size in $(( $(date +%s) - start )) s"

# the CUM workbooks (the site's "Insert into CUM file" writes into them) and their backups
CUM="$BACKUP_DIR/cum_files_$STAMP.tar.gz"
( cd "$ROOT/sources" && find . -iname '*CUM*' -name '*.xlsx' -print0 | tar --null -czf "$CUM" -T - )
log "cum files ok: $(du -h "$CUM" | cut -f1)"

# keep the newest KEEP of each kind
ls -1t "$BACKUP_DIR"/weld_report_*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "$BACKUP_DIR"/cum_files_*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
log "backup done; kept: $(ls -1 "$BACKUP_DIR"/weld_report_*.dump | wc -l) database copies"
