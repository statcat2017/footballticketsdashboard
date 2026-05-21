import type { AppDatabase } from "../../db/adapter.ts";
import type { ValidationContext } from "../validationContext.ts";
import { makeIssue } from "../validation.ts";

export async function resolveVenue(db: AppDatabase, ctx: ValidationContext): Promise<void> {
  const { row } = ctx;

  if (row.venueRaw) {
    const venue = await db.get<{ id: number; name: string; latitude: number; longitude: number }>(
      `SELECT id, name, latitude, longitude FROM venues WHERE name = ?`,
      [row.venueRaw]
    );
    if (venue) {
      if (venue.latitude === 0 && venue.longitude === 0) {
        ctx.warnings.push(makeIssue("venue_unusable_coords", `Venue "${venue.name}" has unusable coordinates. Fix venue coordinates.`, { rawValue: venue.name }));
      }
      ctx.venueId = venue.id;
      return;
    }
    if (ctx.homeClubId) {
      const cva = await db.get<{ venue_id: number }>(
        `SELECT venue_id FROM club_venue_assignments WHERE club_id = ? AND is_primary = 1 AND effective_to IS NULL`,
        [ctx.homeClubId]
      );
      if (cva?.venue_id) {
        ctx.warnings.push(makeIssue("venue_not_found", `Venue "${row.venueRaw}" not found. Using home club's primary venue.`, { field: "venue", rawValue: row.venueRaw }));
        ctx.venueId = cva.venue_id;
        return;
      }
    }
    ctx.warnings.push(makeIssue("venue_not_found", `Venue "${row.venueRaw}" not found and home club has no primary venue.`, { rawValue: row.venueRaw }));
    ctx.hasBlocker = true;
    return;
  }

  if (row.homeIsOneOff) {
    ctx.warnings.push(makeIssue("one_off_needs_venue", "One-off home participant needs an explicit venue."));
    ctx.hasBlocker = true;
    return;
  }

  if (ctx.homeClubId) {
    const cva = await db.get<{ venue_id: number }>(
      `SELECT venue_id FROM club_venue_assignments WHERE club_id = ? AND is_primary = 1 AND effective_to IS NULL`,
      [ctx.homeClubId]
    );
    if (cva?.venue_id) {
      ctx.venueId = cva.venue_id;
      return;
    }
  }

  ctx.warnings.push(makeIssue("missing_primary_venue", "Home club has no primary venue."));
  ctx.hasBlocker = true;
}
