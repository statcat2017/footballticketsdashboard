import type { ValidationCache } from "../validationCache.ts";
import type { ValidationContext } from "../validationContext.ts";
import { resolveVenue as cachedResolveVenue } from "../validationCache.ts";
import { makeIssue } from "../validation.ts";

export async function resolveVenue(cache: ValidationCache, ctx: ValidationContext): Promise<void> {
  const { row } = ctx;

  if (row.homeIsOneOff && !row.venueRaw) {
    ctx.warnings.push(makeIssue("one_off_needs_venue", "One-off home participant needs an explicit venue."));
    ctx.hasBlocker = true;
    return;
  }

  const result = cachedResolveVenue(cache, row.venueRaw ?? undefined, ctx.homeClubId ?? undefined);

  if (result.source === "home_primary" && row.venueRaw) {
    ctx.warnings.push(makeIssue("venue_not_found", `Venue "${row.venueRaw}" not found. Using home club's primary venue.`, { field: "venue", rawValue: row.venueRaw }));
  }

  if (result.venueId !== null) {
    if (result.source === "exact" && row.venueRaw) {
      const venue = cache.venues.find((v) => v.id === result.venueId);
      if (venue && venue.latitude === 0 && venue.longitude === 0) {
        ctx.warnings.push(makeIssue("venue_unusable_coords", `Venue "${venue.name}" has unusable coordinates. Fix venue coordinates.`, { rawValue: venue.name }));
      }
    }
    ctx.venueId = result.venueId;
    return;
  }

  if (row.venueRaw) {
    ctx.warnings.push(makeIssue("venue_not_found", `Venue "${row.venueRaw}" not found and home club has no primary venue.`, { rawValue: row.venueRaw }));
    ctx.hasBlocker = true;
    return;
  }

  if (ctx.homeClubId && !cache.clubToPrimaryVenue.has(ctx.homeClubId)) {
    ctx.warnings.push(makeIssue("missing_primary_venue", "Home club has no primary venue."));
    ctx.hasBlocker = true;
    return;
  }

  if (!ctx.venueId) {
    ctx.warnings.push(makeIssue("missing_primary_venue", "Home club has no primary venue."));
    ctx.hasBlocker = true;
  }
}