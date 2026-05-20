import {
  CLUB_VENUE_ASSIGNMENTS,
  computeDivisionDisplayOrder,
  computeEdgeAllocationType,
  MEN_PYRAMID_CLUBS,
  MEN_PYRAMID_DIVISIONS,
  MEN_PYRAMID_EDGES,
  MEN_PYRAMID_MEMBERSHIPS,
  MEN_PYRAMID_SEASON_DIVISIONS,
  MEN_PYRAMID_SEASONS,
  MEN_PYRAMID_TEMPLATE
} from "../lib/db/pyramid.ts";

function esc(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

const divisionDisplayOrder = computeDivisionDisplayOrder();
const edgeAllocationType = computeEdgeAllocationType();
const latestSeasonId = Math.max(...MEN_PYRAMID_SEASONS.map((s) => s.id));
const seasonDivisionById = new Map(MEN_PYRAMID_SEASON_DIVISIONS.map((d) => [d.id, d]));

const lines: string[] = [];

// Template
lines.push(`INSERT INTO pyramid_templates (id, code, name, sport, status) VALUES (${MEN_PYRAMID_TEMPLATE.id}, ${esc(MEN_PYRAMID_TEMPLATE.code)}, ${esc(MEN_PYRAMID_TEMPLATE.name)}, ${esc(MEN_PYRAMID_TEMPLATE.sport)}, ${esc(MEN_PYRAMID_TEMPLATE.status)}) ON CONFLICT(id) DO UPDATE SET code = excluded.code, name = excluded.name, sport = excluded.sport, status = excluded.status;`);

// Divisions
for (const d of MEN_PYRAMID_DIVISIONS) {
  lines.push(`INSERT INTO pyramid_divisions (id, template_id, code, name, level, max_size, display_order) VALUES (${d.id}, ${d.template_id}, ${esc(d.code)}, ${esc(d.name)}, ${d.level}, ${d.max_size}, ${divisionDisplayOrder.get(d.id) ?? null}) ON CONFLICT(id) DO UPDATE SET template_id = excluded.template_id, code = excluded.code, name = excluded.name, level = excluded.level, max_size = excluded.max_size, display_order = excluded.display_order;`);
}

// Edges
for (const e of MEN_PYRAMID_EDGES) {
  lines.push(`INSERT INTO pyramid_edges (id, from_division_id, to_division_id, movement_type, allocation_type) VALUES (${e.id}, ${e.from_division_id}, ${e.to_division_id}, ${esc(e.movement_type)}, ${esc(edgeAllocationType.get(e.id) ?? "allocation_dependent")}) ON CONFLICT(id) DO UPDATE SET from_division_id = excluded.from_division_id, to_division_id = excluded.to_division_id, movement_type = excluded.movement_type, allocation_type = excluded.allocation_type;`);
}

// Seasons
for (const s of MEN_PYRAMID_SEASONS) {
  lines.push(`INSERT INTO pyramid_seasons (id, template_id, season_label) VALUES (${s.id}, ${s.template_id}, ${esc(s.season_label)}) ON CONFLICT(id) DO UPDATE SET template_id = excluded.template_id, season_label = excluded.season_label;`);
}

// Clubs
for (const c of MEN_PYRAMID_CLUBS) {
  lines.push(`INSERT INTO clubs (id, name, aliases, league_name, source_url, verified_at, status) VALUES (${c.id}, ${esc(c.name)}, ${esc(c.aliases)}, ${esc(c.league_name)}, ${esc(c.source_url)}, ${esc(c.verified_at)}, ${esc(c.status)}) ON CONFLICT(id) DO UPDATE SET name = excluded.name, aliases = excluded.aliases, league_name = excluded.league_name, source_url = excluded.source_url, verified_at = excluded.verified_at, status = excluded.status;`);
}

// Club venue assignments
for (const a of CLUB_VENUE_ASSIGNMENTS) {
  lines.push(`INSERT INTO club_venue_assignments (id, club_id, venue_id, effective_from, effective_to, is_primary) VALUES (${a.id}, ${a.club_id}, ${a.venue_id}, ${esc(a.effective_from)}, ${esc(a.effective_to)}, ${a.is_primary}) ON CONFLICT(id) DO UPDATE SET club_id = excluded.club_id, venue_id = excluded.venue_id, effective_from = excluded.effective_from, effective_to = excluded.effective_to, is_primary = excluded.is_primary;`);
}

// Division assignments (derived from latest-season memberships only)
for (const m of MEN_PYRAMID_MEMBERSHIPS) {
  if (m.season_id !== latestSeasonId) continue;
  const sd = seasonDivisionById.get(m.season_division_id);
  if (sd) {
    lines.push(`INSERT OR IGNORE INTO division_assignments (club_id, division_id) VALUES (${m.club_id}, ${sd.division_id});`);
  }
}

console.log(lines.join("\n"));
