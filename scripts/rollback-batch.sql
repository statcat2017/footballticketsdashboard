-- Rollback batch 2: removes fixtures inserted by the duplicate batch
-- and resets the batch so it can be re-imported with correct duplicate matching.
--
-- Run the PREVIEW first to confirm the right fixtures will be deleted.
-- Then run the ROLLBACK section.
--
-- Usage from VPS:
--   sqlite3 /path/to/database.db < scripts/rollback-batch.sql

-- ── PREVIEW ──────────────────────────────────────────────────────────
-- Find the batch by source name
SELECT '=== BATCH TO ROLLBACK ===' AS info;
SELECT id, source_id, adapter_type, season_label, approval_status, created_at
FROM import_batches
WHERE source_id = (SELECT id FROM fixture_sources WHERE name LIKE '%Football Web Pages manual paste - batch 2%')
ORDER BY created_at DESC;

SELECT '=== FIXTURES THAT WILL BE DELETED ===' AS info;
SELECT
  f.id,
  f.source,
  f.source_id,
  f.season_label,
  f.competition_code,
  f.fixture_date,
  f.kickoff_time,
  COALESCE(h.name, f.home_one_off_name) AS home,
  COALESCE(a.name, f.away_one_off_name) AS away,
  r.id AS batch_row_id,
  r.final_action
FROM fixtures f
LEFT JOIN clubs h ON h.id = f.home_club_id
LEFT JOIN clubs a ON a.id = f.away_club_id
LEFT JOIN import_batch_rows r
  ON f.source = 'import_batch'
 AND f.source_id = CAST(r.batch_id AS TEXT) || '-' || CAST(r.id AS TEXT)
WHERE r.batch_id = (
  SELECT id FROM import_batches
  WHERE source_id = (SELECT id FROM fixture_sources WHERE name LIKE '%Football Web Pages manual paste - batch 2%')
  ORDER BY created_at DESC LIMIT 1
)
ORDER BY f.fixture_date, f.id;

-- ── ROLLBACK (run after confirming preview looks correct) ────────────
-- Uncomment and run after verifying the preview:
--
-- BEGIN;
--
-- DELETE FROM fixtures
-- WHERE source = 'import_batch'
--   AND source_id IN (
--     SELECT CAST(batch_id AS TEXT) || '-' || CAST(id AS TEXT)
--     FROM import_batch_rows
--     WHERE batch_id = (
--       SELECT id FROM import_batches
--       WHERE source_id = (SELECT id FROM fixture_sources WHERE name LIKE '%Football Web Pages manual paste - batch 2%')
--       ORDER BY created_at DESC LIMIT 1
--     )
--       AND final_action = 'insert'
--   );
--
-- UPDATE import_batch_rows
-- SET final_action = NULL,
--     final_fixture_id = NULL
-- WHERE batch_id = (
--   SELECT id FROM import_batches
--   WHERE source_id = (SELECT id FROM fixture_sources WHERE name LIKE '%Football Web Pages manual paste - batch 2%')
--   ORDER BY created_at DESC LIMIT 1
-- )
--   AND final_action = 'insert';
--
-- UPDATE import_batches
-- SET approval_status = 'preview',
--     row_count_approved = 0,
--     updated_at = CURRENT_TIMESTAMP
-- WHERE id = (
--   SELECT id FROM import_batches
--   WHERE source_id = (SELECT id FROM fixture_sources WHERE name LIKE '%Football Web Pages manual paste - batch 2%')
--   ORDER BY created_at DESC LIMIT 1
-- );
--
-- COMMIT;
