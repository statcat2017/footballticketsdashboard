import type { AppDatabase } from "../db/adapter";
import type { ImportBatchRow } from "./types";

export type FixtureMatchResult =
  | { kind: "match"; id: number; before: Record<string, unknown> }
  | { kind: "ambiguous"; count: number }
  | { kind: "none" };

export interface FixtureCandidateMatch {
  id: number;
  homeName: string;
  awayName: string;
  venueName: string | null;
  fixtureDate: string | null;
  kickoffTime: string | null;
  status: string | null;
}

export async function findImportFixtureMatch(
  db: AppDatabase,
  row: ImportBatchRow,
  seasonLabel: string | null,
): Promise<FixtureMatchResult> {
  if (!row.competitionResolvedCode) return { kind: "none" };

  let fixtures: Record<string, unknown>[] = [];

  if (row.homeIsOneOff && row.awayIsOneOff) {
    fixtures = await db.all<Record<string, unknown>>(
      `SELECT fixtures.*, ftpo.source_url AS ticket_url, ftpo.adult_price_pence, ftpo.concession_price_pence
       FROM fixtures
       LEFT JOIN fixture_ticket_price_overrides ftpo ON ftpo.fixture_id = fixtures.id
       WHERE competition_code = ? AND season_label = ?
       AND home_one_off_name = ? AND away_one_off_name = ?`,
      [row.competitionResolvedCode, seasonLabel, row.homeParticipantRaw, row.awayParticipantRaw]
    );
  } else if (row.homeIsOneOff && row.awayParticipantResolvedId) {
    fixtures = await db.all<Record<string, unknown>>(
      `SELECT fixtures.*, ftpo.source_url AS ticket_url, ftpo.adult_price_pence, ftpo.concession_price_pence
       FROM fixtures
       LEFT JOIN fixture_ticket_price_overrides ftpo ON ftpo.fixture_id = fixtures.id
       WHERE competition_code = ? AND season_label = ?
       AND home_one_off_name = ? AND away_club_id = ?`,
      [row.competitionResolvedCode, seasonLabel, row.homeParticipantRaw, row.awayParticipantResolvedId]
    );
  } else if (row.awayIsOneOff && row.homeParticipantResolvedId) {
    fixtures = await db.all<Record<string, unknown>>(
      `SELECT fixtures.*, ftpo.source_url AS ticket_url, ftpo.adult_price_pence, ftpo.concession_price_pence
       FROM fixtures
       LEFT JOIN fixture_ticket_price_overrides ftpo ON ftpo.fixture_id = fixtures.id
       WHERE competition_code = ? AND season_label = ?
       AND away_one_off_name = ? AND home_club_id = ?`,
      [row.competitionResolvedCode, seasonLabel, row.awayParticipantRaw, row.homeParticipantResolvedId]
    );
  } else if (row.homeParticipantResolvedId && row.awayParticipantResolvedId) {
    let sql = `SELECT fixtures.*, ftpo.source_url AS ticket_url, ftpo.adult_price_pence, ftpo.concession_price_pence
      FROM fixtures
      LEFT JOIN fixture_ticket_price_overrides ftpo ON ftpo.fixture_id = fixtures.id
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

  if (fixtures.length === 0) return { kind: "none" };
  if (fixtures.length > 1) return { kind: "ambiguous", count: fixtures.length };

  const fixture = fixtures[0];

  const before: Record<string, unknown> = {};
  const fields = ["competition_code", "venue_id", "fixture_date", "kickoff_time", "kickoff_time_status", "status", "home_one_off", "away_one_off", "home_one_off_name", "away_one_off_name", "source_url", "ticket_url", "adult_price_pence", "concession_price_pence"];
  for (const f of fields) {
    if (f in fixture) before[f] = fixture[f];
  }

  return {
    kind: "match",
    id: fixture.id as number,
    before,
  };
}

/**
 * Finds candidate fixtures for display in the import repair UI.
 *
 * Unlike findImportFixtureMatch (which requires both participants for strict
 * matching during apply), this function allows matching with only one resolved
 * participant to provide broader suggestions for the admin to review.
 * This is intentional: display-only suggestions benefit from wider matching,
 * while apply-time matching must be strict to avoid incorrect updates.
 */
export async function findImportFixtureCandidateMatches(
  db: AppDatabase,
  row: ImportBatchRow,
  seasonLabel: string | null,
  limit = 5,
): Promise<FixtureCandidateMatch[]> {
  if (!row.competitionResolvedCode) return [];

  const where = [`f.competition_code = ?`, `f.season_label = ?`];
  const params: (string | number | null)[] = [row.competitionResolvedCode, seasonLabel];
  let identityFieldCount = 0;

  if (row.homeIsOneOff && row.homeParticipantRaw) {
    where.push(`f.home_one_off_name = ?`);
    params.push(row.homeParticipantRaw);
    identityFieldCount++;
  } else if (row.homeParticipantResolvedId) {
    where.push(`f.home_club_id = ?`);
    params.push(row.homeParticipantResolvedId);
    identityFieldCount++;
  }

  if (row.awayIsOneOff && row.awayParticipantRaw) {
    where.push(`f.away_one_off_name = ?`);
    params.push(row.awayParticipantRaw);
    identityFieldCount++;
  } else if (row.awayParticipantResolvedId) {
    where.push(`f.away_club_id = ?`);
    params.push(row.awayParticipantResolvedId);
    identityFieldCount++;
  }

  if (row.kickoffDate) {
    where.push(`f.fixture_date = ?`);
    params.push(row.kickoffDate);
    identityFieldCount++;
  }

  if (identityFieldCount === 0) return [];

  return db.all<FixtureCandidateMatch>(
    `SELECT
       f.id,
       COALESCE(h.name, f.home_one_off_name, 'Unknown') AS homeName,
       COALESCE(a.name, f.away_one_off_name, 'Unknown') AS awayName,
       v.name AS venueName,
       f.fixture_date AS fixtureDate,
       f.kickoff_time AS kickoffTime,
       f.status
     FROM fixtures f
     LEFT JOIN clubs h ON h.id = f.home_club_id
     LEFT JOIN clubs a ON a.id = f.away_club_id
     LEFT JOIN venues v ON v.id = f.venue_id
     WHERE ${where.join(" AND ")}
     ORDER BY f.fixture_date IS NULL, f.fixture_date ASC, f.id ASC
     LIMIT ?`,
    [...params, Math.max(1, limit)],
  );
}

export async function findImportFixtureCandidateMatchesForRows(
  db: AppDatabase,
  rows: ImportBatchRow[],
  seasonLabel: string | null,
  limit = 5,
): Promise<Map<number, FixtureCandidateMatch[]>> {
  const results = new Map<number, FixtureCandidateMatch[]>();

  const eligible = rows.filter((row) => {
    if (!row.competitionResolvedCode) return false;
    return !!(row.homeParticipantResolvedId || row.awayParticipantResolvedId || row.homeIsOneOff || row.awayIsOneOff || row.kickoffDate);
  });

  if (eligible.length === 0) return results;

  const whereParts: string[] = [];
  const params: (string | number | null)[] = [];

  for (const row of eligible) {
    const parts = ["f.competition_code = ?", "f.season_label = ?"];
    params.push(row.competitionResolvedCode, seasonLabel);

    if (row.homeIsOneOff && row.homeParticipantRaw) {
      parts.push("f.home_one_off_name = ?");
      params.push(row.homeParticipantRaw);
    } else if (row.homeParticipantResolvedId) {
      parts.push("f.home_club_id = ?");
      params.push(row.homeParticipantResolvedId);
    }

    if (row.awayIsOneOff && row.awayParticipantRaw) {
      parts.push("f.away_one_off_name = ?");
      params.push(row.awayParticipantRaw);
    } else if (row.awayParticipantResolvedId) {
      parts.push("f.away_club_id = ?");
      params.push(row.awayParticipantResolvedId);
    }

    if (row.kickoffDate) {
      parts.push("f.fixture_date = ?");
      params.push(row.kickoffDate);
    }

    whereParts.push(`(${parts.join(" AND ")})`);
  }

  const fixtures = await db.all<Record<string, unknown>>(
    `SELECT
       f.id,
       COALESCE(h.name, f.home_one_off_name, 'Unknown') AS homeName,
       COALESCE(a.name, f.away_one_off_name, 'Unknown') AS awayName,
       v.name AS venueName,
       f.fixture_date AS fixtureDate,
       f.kickoff_time AS kickoffTime,
       f.status,
       f.home_club_id AS homeClubId,
       f.away_club_id AS awayClubId,
       f.home_one_off_name AS homeOneOffName,
       f.away_one_off_name AS awayOneOffName
     FROM fixtures f
     LEFT JOIN clubs h ON h.id = f.home_club_id
     LEFT JOIN clubs a ON a.id = f.away_club_id
     LEFT JOIN venues v ON v.id = f.venue_id
     WHERE ${whereParts.join(" OR ")}
     ORDER BY f.fixture_date IS NULL, f.fixture_date ASC, f.id ASC`,
    params,
  );

  for (const row of eligible) {
    const rowMatches: FixtureCandidateMatch[] = [];
    for (const f of fixtures) {
      if (row.homeIsOneOff && row.homeParticipantRaw) {
        if (f.homeOneOffName !== row.homeParticipantRaw) continue;
      } else if (row.homeParticipantResolvedId) {
        if (f.homeClubId !== row.homeParticipantResolvedId) continue;
      } else if (!f.homeClubId && !f.homeOneOffName) {
        continue;
      }

      if (row.awayIsOneOff && row.awayParticipantRaw) {
        if (f.awayOneOffName !== row.awayParticipantRaw) continue;
      } else if (row.awayParticipantResolvedId) {
        if (f.awayClubId !== row.awayParticipantResolvedId) continue;
      } else if (!f.awayClubId && !f.awayOneOffName) {
        continue;
      }

      if (row.kickoffDate && f.fixtureDate !== row.kickoffDate) continue;

      rowMatches.push({
        id: f.id as number,
        homeName: f.homeName as string,
        awayName: f.awayName as string,
        venueName: f.venueName as string | null,
        fixtureDate: f.fixtureDate as string | null,
        kickoffTime: f.kickoffTime as string | null,
        status: f.status as string | null,
      });

      if (rowMatches.length >= limit) break;
    }

    if (rowMatches.length > 0) results.set(row.id, rowMatches);
  }

  return results;
}
