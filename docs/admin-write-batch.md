# Admin Write Batch Semantics

`AppDatabase.writeBatch` is the admin write primitive for multi-row changes that should be applied together.

## Contract

- Build the full list of write statements before calling `writeBatch`.
- Use `writeBatch` for deterministic writes only.
- Do validation reads before calling `writeBatch`.
- Do not branch on read-after-write results inside `writeBatch`.
- Generate IDs in application code first when later statements need those IDs.

## SQLite

SQLite writes are wrapped in `BEGIN`, `COMMIT`, and `ROLLBACK` on the same connection.

If any statement throws, the adapter rolls back the whole batch and rethrows the error.

## D1

D1 writes use `D1Database.batch()` with prepared statements.

Cloudflare documents D1 batches as transactional for a sequential list of prepared statements. The adapter also rejects any resolved batch result where `success` is `false`.

## Not Supported

`writeBatch` is not a callback-style transaction API. If an operation needs read-after-write branching, redesign it as pre-validation plus deterministic writes, or create an explicit D1-safe flow.
