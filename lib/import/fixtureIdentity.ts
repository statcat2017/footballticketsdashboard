import type { AppDatabase } from "../db/adapter";
import type { ImportBatchRow } from "./types";

export interface FixtureMatch {
  id: number;
  before: Record<string, unknown>;
}

export async function findImportFixtureMatch(
  db: AppDatabase,
  row: ImportBatchRow,
  seasonLabel: string | null,
): Promise<FixtureMatch | null> {
  if (!row.competitionResolvedCode) return null;

  let fixtures: Record<string, unknown>[] = [];

  if (row.homeIsOneOff && row.awayIsOneOff) {
    fixtures = await db.all<Record<string, unknown>>(
      `SELECT * FROM fixtures
       WHERE competition_code = ? AND season_label = ?
       AND home_one_off_name = ? AND away_one_off_name = ?`,
      [row.competitionResolvedCode, seasonLabel, row.homeParticipantRaw, row.awayParticipantRaw]
    );
  } else if (row.homeIsOneOff && row.awayParticipantResolvedId) {
    fixtures = await db.all<Record<string, unknown>>(
      `SELECT * FROM fixtures
       WHERE competition_code = ? AND season_label = ?
       AND home_one_off_name = ? AND away_club_id = ?`,
      [row.competitionResolvedCode, seasonLabel, row.homeParticipantRaw, row.awayParticipantResolvedId]
    );
  } else if (row.awayIsOneOff && row.homeParticipantResolvedId) {
    fixtures = await db.all<Record<string, unknown>>(
      `SELECT * FROM fixtures
       WHERE competition_code = ? AND season_label = ?
       AND away_one_off_name = ? AND home_club_id = ?`,
      [row.competitionResolvedCode, seasonLabel, row.awayParticipantRaw, row.homeParticipantResolvedId]
    );
  } else if (row.homeParticipantResolvedId && row.awayParticipantResolvedId) {
    let sql = `SELECT * FROM fixtures
      WHERE home_club_id = ? AND away_club_id = ? AND competition_code = ? AND season_label = ?`;
    const params: (string | number | null)[] = [
      row.homeParticipantResolvedId,
      row.awayParticipantResolvedId,
      row.competitionResolvedCode,
      seasonLabel,
    ];
    if (row.kickoffDate) {
      sql += ` AND fixture_date = ?`;
      params.push(row.kickoffDate);
    }
    fixtures = await db.all<Record<string, unknown>>(sql, params);
  }

  if (fixtures.length === 0) return null;
  if (fixtures.length > 1) return null;

  const fixture = fixtures[0];

  const before: Record<string, unknown> = {};
  const fields = ["competition_code", "venue_id", "fixture_date", "kickoff_time", "kickoff_time_status", "status", "home_one_off", "away_one_off", "home_one_off_name", "away_one_off_name", "source_url"];
  for (const f of fields) {
    if (f in fixture) before[f] = fixture[f];
  }

  return {
    id: fixture.id as number,
    before,
  };
}
