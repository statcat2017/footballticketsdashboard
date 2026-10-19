# SQLite Inventory and Recovery

This procedure inventories a SQLite database, creates a consistent snapshot, and restores it to a new isolated file. The commands do not start the application, apply migrations, run seeds, or print secret values.

## Commands

Run from the deployed application directory, after loading the existing environment file into the current shell. Do not print or paste the environment file itself.

```bash
set -a
. /etc/nearmefc.env
set +a

node --version
service_pid="$(systemctl show nearmefc -p MainPID --value)"
systemctl show nearmefc -p ActiveState -p SubState -p MainPID -p ExecStart -p EnvironmentFiles --no-pager
service_node="$(readlink -f "/proc/${service_pid}/exe")"
export PATH="$(dirname "$service_node"):$PATH"
"$service_node" --version
systemctl list-timers --all --no-pager
crontab -l
npm run db:snapshot -- inspect "$SQLITE_DB_PATH"
```

The inspection report includes the supplied database path, SQLite version and journal mode, migration count and latest migration, integrity and foreign-key results, row counts for every non-internal SQLite table, fixture counts grouped by source, season and status, import-related database tables, and booleans for configured provider credentials. It never outputs credential values. Provider credential presence does not prove that a provider is reachable. The `PATH` update makes the `npm` commands below use the same Node executable as the running service. The deployment bundle already includes the CLI and its helper in `scripts/`.

For a new snapshot, choose a destination that does not exist and is on storage with appropriate access controls. The backup uses SQLite's online backup API, which reads a consistent database view while accounting for committed WAL contents. Do not copy only the `.sqlite` file while the application may be writing to it.

```bash
npm run db:snapshot -- backup "$SQLITE_DB_PATH" /secure/backups/nearmefc-2026-10-19.sqlite
stat -c '%U:%G %a %n' /secure/backups/nearmefc-2026-10-19.sqlite
sha256sum /secure/backups/nearmefc-2026-10-19.sqlite
```

Restore only to a new staging path. The command refuses an existing destination, the configured `SQLITE_DB_PATH`, and the application's default `data/nearmefc.sqlite` path. It validates SQLite integrity and foreign keys before reporting success.

```bash
npm run db:snapshot -- restore \
  /secure/backups/nearmefc-2026-10-19.sqlite \
  /var/tmp/nearmefc-restore-check-2026-10-19.sqlite
npm run db:snapshot -- inspect /var/tmp/nearmefc-restore-check-2026-10-19.sqlite
```

Keep the application stopped from the isolated restore path until the startup-preservation change in issue #213 is deployed. Do not point `SQLITE_DB_PATH` at the restored file and do not run `npm run db:setup` against it. Compare the snapshot and restored inspection reports, then reopen the restored file read-only to verify expected records.

## Evidence Record

Record these values in the release or incident record without copying secret values:

- UTC capture time, deployed commit, and the successful deploy workflow URL.
- Service state, executable path/version, configured SQLite path, and filesystem owner/permissions.
- SQLite version, journal mode, latest migration, integrity result, foreign-key violation count, table counts, and fixture counts by source/season/status.
- Timer/cron inventory and which system or person owns scheduled jobs.
- Provider credential presence and a separate, approved connectivity check result; never include credentials.
- Snapshot path, file owner/permissions, size, checksum, retention location, and restore-test path/result.

## Runtime Facts Still Requiring Host Access

The dated repository review is in [runtime-inventory-2026-10-19.md](./runtime-inventory-2026-10-19.md). The repository documents `/srv/nearmefc/data/nearmefc.sqlite` and `/etc/nearmefc.env`, but only a read-only host inspection can confirm the live path, service Node executable/version, provider credential presence, scheduled jobs, backup owner, and actual fixture/schema counts. Do not treat repository configuration as proof of those deployed values.
