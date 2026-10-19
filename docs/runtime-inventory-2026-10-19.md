# Runtime Inventory — 2026-10-19

This is a read-only inventory from repository configuration, GitHub deployment metadata, and the public health endpoint. Host-only facts remain explicitly unverified; no production database or filesystem was accessed.

## Verified

| Item | Evidence |
|---|---|
| Public health | `GET https://fixtures.statcat.co.uk/api/health` returned HTTP 200 and `{"ok":true,"db":true}` at 2026-10-19 14:52 UTC. This confirms the endpoint could open its configured database at that time, not its contents or recoverability. |
| Latest successful deployment visible in GitHub Actions | Run [27269475939](https://github.com/statcat2017/footballticketsdashboard/actions/runs/27269475939) deployed `main` commit `d7bdb7b7fb19997e41b1ee2928426dfe79748969` on 2026-06-10 10:18–10:19 UTC. |
| Deployment mechanism | `.github/workflows/deploy.yml` builds a Next.js standalone Node application, copies it to a VPS, applies pending migrations, restarts systemd unit `nearmefc`, then calls the local health endpoint. Build dependencies use Node 22. |
| Documented runtime configuration | `docs/vps-deployment.md` names `/etc/nearmefc.env`, `SQLITE_DB_PATH=/srv/nearmefc/data/nearmefc.sqlite`, and SQLite through `better-sqlite3`. These are documented values, not host-verified values. |
| Database model | Migrations are stored in `lib/db/migrations`; the current repository has migrations 001–029. App startup applies pending migrations and seeds data, so a restored database must not be started through the app until issue #213's preservation change is deployed. |

## Not Yet Verified

- Actual deployed commit and service process Node version on the VPS.
- Actual `SQLITE_DB_PATH`, SQLite version, journal mode, migration rows, integrity and foreign-key checks.
- Live source/season/status counts and existing table/job records.
- Provider credential presence or connectivity in the runtime environment.
- Host timers/cron, backup location, backup ownership, permissions, retention, and any previous restore evidence.
- Successful isolated restore of a real production snapshot.

The `db:snapshot` command and [database recovery runbook](./database-recovery.md) collect database metadata without printing secrets, and create/restore SQLite snapshots into new files. The command inventories all non-internal SQLite tables. A designated operator with read-only host access must complete the remaining host inventory and capture a production snapshot before this issue's recovery baseline can be considered proven. No production mutation or restart is authorized by this report.
