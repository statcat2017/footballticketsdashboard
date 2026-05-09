# Football Ticketing Dashboard Project Plan

## Summary

Create a simple UK-focused football ticket dashboard. Users enter a postcode and age; the app returns ranked ticket results from official club/competition sources and trusted resale sources.

## V1 Scope

- Next.js + TypeScript dashboard.
- Search form for postcode and age.
- Seed data adapter for end-to-end UX without network dependencies.
- Normalized ticket result model.
- Ranking by distance, availability, price, source quality, and concession eligibility.
- Workstream docs for parallel agent development.

## Milestones

1. Foundation: scaffold app, tests, docs, seed data.
2. Dashboard: search form, result cards, empty/error/loading states.
3. Ranking: postcode normalization, venue distance, age and concession handling.
4. Data ingestion: first official source adapter, then first trusted resale source adapter.
5. Hardening: adapter contracts, browser tests, compliance checklist.

## Risks

- Ticket source access and terms may limit scraping options.
- Marketplace pricing and availability may change frequently.
- Age and concession rules vary by club and source.
- Postcode and geocoding providers need graceful failure handling.

## Current Default

The app starts with seed data and replaceable interfaces. Live sources should be added behind adapter boundaries without changing UI components.
