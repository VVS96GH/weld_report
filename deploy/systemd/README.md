# systemd user units

- `weld-report-backup.service` / `.timer` — daily database backup at 03:00
  (`scripts/backup-db.sh`, copies on the Windows disk, the last 7 kept).

Install:

```bash
cp deploy/systemd/weld-report-backup.* ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now weld-report-backup.timer
systemctl --user list-timers weld-report-backup.timer   # next run
```

Restore a copy into a test database (safe, the site keeps running):
`scripts/restore-db.sh /mnt/c/Users/meg19/WeldReportBackup/weld_report_<date>.dump`
