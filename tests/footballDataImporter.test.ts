import { describe, expect, it, vi } from "vitest";

import { createDatabase } from "@/lib/db/client";
import { importFootballDataFixtures } from "@/lib/db/footballDataImporter";

describe("football-data importer", () => {
  it("requires a token", async () => {
    const db = createDatabase();

    await expect(importFootballDataFixtures({ db, token: "", fetchImpl: vi.fn() })).rejects.toThrow(
      "FOOTBALL_DATA_API_TOKEN is required"
    );
  });

  it("fetches PL and ELC matches and upserts known clubs idempotently", async () => {
    const db = createDatabase();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(responseWithMatches([
        {
          id: 1001,
          utcDate: "2026-08-15T14:00:00Z",
          status: "TIMED",
          lastUpdated: "2026-05-10T10:00:00Z",
          competition: { code: "PL" },
          homeTeam: { id: 61, name: "Chelsea FC", shortName: "Chelsea", tla: "CHE" },
          awayTeam: { id: 57, name: "Arsenal FC", shortName: "Arsenal", tla: "ARS" }
        },
        {
          id: 1002,
          utcDate: "2026-08-16T14:00:00Z",
          status: "SCHEDULED",
          competition: { code: "PL" },
          homeTeam: { id: 999, name: "Unknown FC", shortName: "Unknown", tla: "UNK" },
          awayTeam: { id: 57, name: "Arsenal FC", shortName: "Arsenal", tla: "ARS" }
        }
      ]))
      .mockResolvedValueOnce(responseWithMatches([
        {
          id: 2001,
          utcDate: "2026-08-15T14:00:00Z",
          status: "POSTPONED",
          competition: { code: "ELC" },
          homeTeam: { id: 69, name: "Queens Park Rangers FC", shortName: "QPR", tla: "QPR" },
          awayTeam: { id: 68, name: "Norwich City FC", shortName: "Norwich", tla: "NOR" }
        }
      ]));

    const result = await importFootballDataFixtures({
      db,
      token: "test-token",
      fetchImpl,
      now: new Date("2026-05-10T12:00:00Z")
    });

    expect(result).toEqual({
      fetched: 3,
      imported: 2,
      skipped: 1,
      competitions: ["PL", "ELC"]
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://api.football-data.org/v4/competitions/PL/matches",
      { headers: { "X-Auth-Token": "test-token" } }
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://api.football-data.org/v4/competitions/ELC/matches",
      { headers: { "X-Auth-Token": "test-token" } }
    );

    const rows = db.prepare(`
      SELECT source_id, competition_code, status, is_demo_data, is_historical, source_updated_at, imported_at
      FROM fixtures
      WHERE source = 'football-data'
      ORDER BY source_id
    `).all();

    expect(rows).toEqual([
      {
        source_id: "1001",
        competition_code: "PL",
        status: "scheduled",
        is_demo_data: 0,
        is_historical: 0,
        source_updated_at: "2026-05-10T10:00:00Z",
        imported_at: "2026-05-10T12:00:00.000Z"
      },
      {
        source_id: "2001",
        competition_code: "ELC",
        status: "postponed",
        is_demo_data: 0,
        is_historical: 0,
        source_updated_at: null,
        imported_at: "2026-05-10T12:00:00.000Z"
      }
    ]);

    fetchImpl.mockClear();
    fetchImpl
      .mockResolvedValueOnce(responseWithMatches([
        {
          id: 1001,
          utcDate: "2026-08-15T15:00:00Z",
          status: "FINISHED",
          competition: { code: "PL" },
          homeTeam: { id: 61, name: "Chelsea FC", shortName: "Chelsea", tla: "CHE" },
          awayTeam: { id: 57, name: "Arsenal FC", shortName: "Arsenal", tla: "ARS" }
        }
      ]))
      .mockResolvedValueOnce(responseWithMatches([]));

    await importFootballDataFixtures({
      db,
      token: "test-token",
      fetchImpl,
      now: new Date("2026-05-10T13:00:00Z")
    });

    const updated = db.prepare(`
      SELECT COUNT(*) as count, kickoff_at, status
      FROM fixtures
      WHERE source = 'football-data' AND source_id = '1001'
    `).get() as { count: number; kickoff_at: string; status: string };

    expect(updated).toEqual({
      count: 1,
      kickoff_at: "2026-08-15T15:00:00Z",
      status: "finished"
    });
  });
});

function responseWithMatches(matches: unknown[]) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ matches })
  };
}
