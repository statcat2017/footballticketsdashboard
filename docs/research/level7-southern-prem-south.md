# 2025-26 Southern Football League — Premier Division South (Step 3, Level 7)

Research completed **2026-05-20** from the [2025–26 Southern Football League](https://en.wikipedia.org/wiki/2025%E2%80%9326_Southern_Football_League) Wikipedia page, with coordinates and postcodes supplemented via the Wikipedia API, Nominatim (OpenStreetMap), and postcodes.io.

## Clubs, Grounds & Coordinates

| Club | Ground | Town | Postcode | Latitude | Longitude | Groundshare? | Source |
|------|--------|------|----------|----------|-----------|--------------|--------|
| Basingstoke Town | Winklebury Football Complex | Basingstoke | RG23 8BF | 51.267931 | -1.111906 | | Wikipedia club page |
| Berkhamsted | Broadwater | Berkhamsted | HP4 2AH | 51.763172 | -0.564744 | | Wikipedia club page |
| Bracknell Town | SB Stadium | Sandhurst | GU47 9DY | 51.342231 | -0.793422 | Groundshare? Plays in Sandhurst, not Bracknell | Wikipedia club page |
| Chertsey Town | Alwyns Lane | Chertsey | KT16 9DW | 51.392500 | -0.508056 | | Wikipedia club page |
| Dorchester Town | The Avenue Stadium | Dorchester | DT1 2RU | 50.700667 | -2.445556 | | Wikipedia ground page |
| Evesham United | Jubilee Stadium | Evesham | WR11 2LZ | 52.073610 | -1.954693 | | Wikipedia club page |
| Farnham Town | The Memorial Ground | Farnham | GU9 7EE | 51.211389 | -0.806389 | | Wikipedia club page |
| Gloucester City | Meadow Park | Gloucester | GL4 6LS | 51.833067 | -2.211599 | | Nominatim |
| Gosport Borough | Privett Park | Gosport | PO12 3SX | 50.794761 | -1.156577 | | Nominatim |
| Hanwell Town | Powerday Stadium | Perivale | UB6 8UT | 51.532522 | -0.328950 | | Wikipedia club page |
| Havant & Waterlooville | Westleigh Park | Havant | PO9 5TH | 50.867179 | -0.973368 | | Wikipedia club page (+ Nominatim) |
| Hungerford Town | Bulpit Lane | Hungerford | RG17 0AU | 51.408191 | -1.516135 | | Nominatim |
| Plymouth Parkway | Bolitho Park | Plymouth | PL5 3FD | 50.407809 | -4.147410 | | Wikipedia ground page |
| Poole Town | The BlackGold Stadium | Poole | BH15 3JR | 50.728264 | -1.984319 | | Wikipedia club page |
| Sholing | Universal Stadium | Sholing | SO19 9PW | 50.893264 | -1.338122 | | Wikipedia club page |
| Taunton Town | Wordsworth Drive | Taunton | TA1 2EH | 51.016725 | -3.085103 | | Wikipedia club page |
| Tiverton Town | Ladysmead | Tiverton | EX16 6SG | 50.909247 | -3.490167 | | Wikipedia club page |
| Uxbridge | Honeycroft | West Drayton | UB7 8BQ | 51.514064 | -0.457703 | | Wikipedia club page |
| Walton & Hersham | Elmbridge Sports Hub | Walton-on-Thames | KT12 2JP | 51.399403 | -0.412256 | | Wikipedia club page |
| Weymouth | Bob Lucas Stadium | Weymouth | DT4 9XJ | 50.620000 | -2.485278 | | Wikipedia ground page |
| Wimborne Town | The Cuthbury | Wimborne Minster | BH21 2FU | 50.800984 | -1.961372 | | Wikipedia club page (+ article text for postcode) |
| Yate Town | Lodge Road | Yate | BS30 5TU | 51.466328 | -2.437322 | | Nominatim |

## Data Quality Notes

### Season
The 2025-26 season page was available and contained full fixture data. The table above reflects the **2025–26** campaign (the 123rd in the league's history). The division champion was **Walton & Hersham** (promoted to National League South).

### Coordinates
- **Wikipedia API** was the primary source. Club-level coordinates were found for most teams via their `F.C.` Wikipedia page infobox.
- For clubs without coordinates on their Wikipedia page (Gloucester City, Gosport Borough, Hungerford Town, Plymouth Parkway, Yate Town), **Nominatim** (OpenStreetMap) geocoding was used with the ground name and town as the query.
- **Walton & Hersham** coordinates were taken from their club Wikipedia page (51.399403, -0.412256 for Elmbridge Sports Hub). An earlier script incorrectly matched them to The Avenue Stadium (Dorchester) — this has been corrected.
- **Hanwell Town** coordinates come from their Wikipedia club page (51.532522, -0.328950). The club's ground is known as Powerday Stadium (naming rights), but Wikipedia lists it as Reynolds Field in Perivale.
- **Wimborne Town**: The Wikipedia club page coordinates point to the old Cuthbury ground. The club moved to New Cuthbury in 2020–21. The postcode BH21 2FU is from the club's Wikipedia article text ("16 Ainsley Road, Wimborne"). Coordinates (50.800984, -1.961372) were estimated from the postcode area.
- **Bracknell Town**: Coordinates from the club Wikipedia page point to their SB Stadium ground in Sandhurst, not Bracknell — the club relocated due to ground-grading issues at their original Bottom Meadow ground.

### Postcodes
- Obtained via **postcodes.io** reverse geocoding (with 500m radius where the default 100m returned no results).
- **Walton & Hersham** postcode KT12 2JP was taken directly from the club's Wikipedia article text (Elmbridge Sports Hub, Waterside Drive).
- **Wimborne Town** postcode BH21 2FU was taken from the club's Wikipedia article text (16 Ainsley Road, New Cuthbury).
- **Gosport Borough** postcode PO12 3SX was extracted from Nominatim's display_name field.

### Groundshares
Most clubs play at their own named grounds. Notable edge cases:
- **Bracknell Town** plays at SB Stadium in **Sandhurst** (Berkshire) rather than Bracknell — effectively a relocation. May involve groundshare arrangements.
- **Gloucester City** returned to their rebuilt Meadow Park in December 2020 after 13 years in exile; no current groundshare.
- No other groundshares were identified among the 22 clubs. Further verification via club websites or the Football Ground Guide is recommended for production use.

### Disclaimer
- Admission pricing is not included in this document — this is a best-effort grounds and locations survey only.
- Some coordinates are approximate (Nominatim results, postcode-centroid estimates).
- Always verify ground locations via club websites before use in a production application.
