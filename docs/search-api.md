# Search API

The product API entry point is `POST /api/search`.

## Request body

```json
{
  "postcode": "SW6 1HS",
  "radiusMiles": 25,
  "dateFrom": "2026-05-11",
  "dateTo": "2026-05-21"
}
```

Fields:

- `postcode`: required UK postcode string.
- `radiusMiles`: optional positive number, maximum `500`.
- `dateFrom`: optional ISO-style date string (`YYYY-MM-DD`).
- `dateTo`: optional ISO-style date string (`YYYY-MM-DD`).

If `dateFrom` or `dateTo` are omitted, the API applies the default search window from today through the next 10 days.

## Response body

```json
{
  "results": [
    {
      "id": 123,
      "title": "Chelsea vs Arsenal",
      "competitionCode": "PL",
      "competitionName": "Premier League",
      "kickoffAt": "2026-05-12T19:00:00.000Z",
      "venueName": "Stamford Bridge",
      "venuePostcode": "SW6 1HS",
      "homeClub": "Chelsea",
      "awayClub": "Arsenal",
      "officialSiteUrl": "https://www.chelseafc.com/",
      "genericTicketUrl": "https://www.chelseafc.com/en/tickets",
      "price": {
        "saleMode": "all_ticket",
        "adultPricePence": 3000,
        "concessionPricePence": 2000,
        "sourceUrl": "https://www.chelseafc.com/en/tickets",
        "verifiedAt": "2026-05-10",
        "confidence": "seed",
        "isOverride": false
      },
      "travel": {
        "distanceMiles": 0.4,
        "drivingMinutes": 6,
        "publicTransportMinutes": 8,
        "source": "cache"
      },
      "isDemoData": false,
      "isHistorical": false,
      "warnings": [
        "Admission prices are best-effort guide prices. Confirm with the club before travelling."
      ]
    }
  ],
  "meta": {
    "dateFrom": "2026-05-11",
    "dateTo": "2026-05-21",
    "radiusMiles": 25,
    "usedHistoricalFallback": false
  }
}
```

Notes:

- `price.saleMode` is `all_ticket`, `pay_on_gate`, or `null` when the club should be checked directly.
- `price.isOverride` is `true` when fixture-specific pricing overrides the club default.
- `travel.source` is `cache` when postcode-district travel data exists, otherwise `distance_only`.
- Empty live windows return an empty `results` array. The API does not silently fall back to historical demo fixtures.
- `usedHistoricalFallback` is currently `false` for normal operation and remains in the response as an explicit metadata flag.

## Errors

Invalid input returns HTTP `400` with:

```json
{
  "error": "Enter a valid UK postcode."
}
```

Other validation errors return specific messages, for example:

- `Enter a valid start date in YYYY-MM-DD format.`
- `Enter a valid end date in YYYY-MM-DD format.`
- `End date must be on or after the start date.`

Unexpected backend failures return HTTP `500` with:

```json
{
  "error": "Search failed."
}
```
