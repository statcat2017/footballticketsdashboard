# TICKET-055: Introduce a proper form/action parsing layer

Status: open
Owner: Backend
Priority: high
Depends on: TICKET-054

## Purpose

Admin routes manually parse `formData()` with ad-hoc coercion and validation
repeated across every handler. This makes routes responsible for their own
validation and encourages subtle differences between create and update paths.

## Work

1. Create `lib/admin/forms/` with Zod schemas for each form action:
   - `venueUpdateFormSchema`
   - `venueCreateFormSchema`
   - `clubUpdateFormSchema`
   - `aliasAddFormSchema`
   - `aliasRetireFormSchema`
   - `publishClubFormSchema`
   - `publishCompetitionFormSchema`
   - `assignVenueFormSchema`
2. Refactor each route handler to use `parse → call service → redirect`.
3. Ensure shared schemas exist where create and update differ only by optional fields.
4. Return 400 with field-level error messages on parse failure.

## Why

This repo now has several admin flows with meaningful side effects: venue edits,
club edits, alias changes, publish actions, imports. Hand-parsing forms is fine
at first, but it scales badly and makes agent-generated changes more likely to
introduce inconsistent behaviour.
