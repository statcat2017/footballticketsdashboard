-- Preserve the season a ticket price applies to so search can flag season mismatches.
-- Existing rows stay NULL because their price season is not known from stored evidence.
ALTER TABLE club_ticket_prices ADD COLUMN season_label TEXT;
ALTER TABLE fixture_ticket_price_overrides ADD COLUMN season_label TEXT;
