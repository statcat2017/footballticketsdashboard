# 2025–26 Isthmian League Division One South East (Step 4, Level 8)

**Season:** 2025–26  
**Source:** [Wikipedia – 2025–26 Isthmian League](https://en.wikipedia.org/wiki/2025%E2%80%9326_Isthmian_League#South_East_Division)  
**Research date:** 20 May 2026  
**Division:** South East Division (one of three Step 4 divisions)  

## Club Grounds, Coordinates, and Postcodes

| # | Club | Ground | Town | Postcode | Latitude | Longitude | Groundshare? | Source |
|---|------|--------|------|----------|----------|-----------|--------------|--------|
| 1 | AFC Croydon Athletic | Mayfield Stadium | Thornton Heath | CR7 6DJ | 51.393436 | -0.126603 | No | Nominatim geocode + Wikipedia API |
| 2 | AFC Whyteleafe | Church Road | Whyteleafe | CR3 0AR | 51.304951 | -0.081056 | No | Nominatim geocode |
| 3 | Ashford United | The Homelands | Ashford, Kent | TN25 6BJ | 51.155372 | 1.037507 | No | Nominatim geocode + postcodes.io |
| 4 | Beckenham Town | Eden Park Avenue | Beckenham | BR3 3JL | 51.392778 | -0.028889 | No | Wikipedia API + postcodes.io |
| 5 | Broadbridge Heath | High Wood Hill Sports Ground | Broadbridge Heath | RH12 3 | 51.063330 | -0.359170 | No | Wikipedia page geo + Nominatim |
| 6 | Crowborough Athletic | Crowborough Community Stadium | Crowborough | TN6 3FY | 51.041965 | 0.166048 | No | Nominatim geocode + postcodes.io |
| 7 | Deal Town | Charles Sports Ground | Deal | CT14 9AT | 51.216390 | 1.389170 | No | Wikipedia page geo + postcodes.io |
| 8 | East Grinstead Town | East Court | East Grinstead | RH19 3GB | 51.129018 | 0.003787 | No | Nominatim geocode + Nominatim |
| 9 | Eastbourne Town | The Saffrons | Eastbourne | BN20 7DR | 50.766110 | 0.276390 | No | Wikipedia page geo + postcodes.io |
| 10 | Erith Town | Bayliss Avenue | Thamesmead | SE28 0 | 51.418890 | 0.110000 | No (notes) | Wikipedia API + Nominatim area |
| 11 | Faversham Town | Salters Lane | Faversham | ME13 8ND | 51.306885 | 0.894079 | No | Nominatim geocode + postcodes.io |
| 12 | Hassocks | The Beacon Ground | Hassocks | BN6 8 | 50.919720 | -0.150560 | No | Wikipedia API + Nominatim area |
| 13 | Hastings United | The Pilot Field | Hastings | TN34 2AQ | 50.874522 | 0.587057 | No | Nominatim geocode + Nominatim |
| 14 | Herne Bay | Winch's Field | Herne Bay | CT6 5SG | 51.364675 | 1.129949 | No | Nominatim/Wikipedia API + postcodes.io |
| 15 | Jersey Bulls | Springfield Stadium | St Helier, Jersey | JE2 3GF | 49.191672 | -2.100077 | No | Nominatim geocode |
| 16 | Margate | Hartsdown Park | Margate | CT9 5QZ | 51.380412 | 1.374046 | No | Nominatim geocode + postcodes.io |
| 17 | Merstham | Moatside | Merstham | RH1 3QB | 51.258060 | -0.146670 | No | Wikipedia API + postcodes.io |
| 18 | Sevenoaks Town | Greatness Park | Sevenoaks | TN14 5AA | 51.290372 | 0.202579 | No | Nominatim geocode + postcodes.io |
| 19 | Sheppey United | Holm Park | Isle of Sheppey | ME12 | 51.421940 | 0.769720 | No | Wikipedia page geo + Nominatim area |
| 20 | Sittingbourne | Woodstock Park | Sittingbourne | ME10 3BF | 51.349010 | 0.762083 | No | Nominatim geocode + Nominatim |
| 21 | Three Bridges | Jubilee Field | Three Bridges, Crawley | RH10 1 | 51.115310 | -0.167740 | No | Wikipedia page geo + Nominatim area |
| 22 | VCD Athletic | Oakwood | Crayford | DA1 4EU | 51.455398 | 0.171631 | No | Nominatim geocode + postcodes.io |

## Data Quality Notes

### Coordinate Sources
- **Wikipedia page geo**: DMS coordinates extracted from the `<span class="latitude">` / `<span class="longitude">` microformat on each club's Wikipedia article page. Converted to decimal degrees.
- **Wikipedia API**: Coordinates from the Wikimedia `prop=coordinates` API endpoint.
- **Nominatim geocode**: OpenStreetMap Nominatim reverse geocode using ground name + town as query.
- **Area** (postcode only): Precise street-level postcode unavailable; only district/outward code shown.

### Postcode Sources
- **postcodes.io**: Reverse geocode from coordinates via the official postcodes.io API.
- **Nominatim**: Postcode extracted from the `display_name` field of Nominatim results when postcodes.io returned no match.

### Groundshare Notes
- No formal groundshares between clubs *within* this division were identified.
- Erith Town (r. 10) plays at Bayliss Avenue, the former home of Thamesmead Town (now Sporting Club Thamesmead) — this is a multi-sport complex but not flagged as a groundshare in the Wikipedia 2025–26 page.
- The Saffrons (Eastbourne Town, r. 9) is a multi-sport venue shared with a cricket club.
- The Mayfield Stadium (AFC Croydon Athletic, r. 1) has been used historically by other local clubs but is currently AFC Croydon Athletic's sole tenancy for league purposes.

### Limitations
- Coordinates are approximate to the ground location (typically the centre of the pitch or main stand area as mapped in OpenStreetMap).
- Postcodes for smaller grounds in non-urban areas (Broadbridge Heath, Hassocks, Sheppey United, Three Bridges) were resolved only to district level — the exact delivery point could not be determined via available APIs.
- Jersey Bulls' coordinates use the Channel Islands datum (EPSG:32630 offset); longitude/latitude are correct for WGS84.
- The FA allocations for 2025–26 were announced on 15 May 2025; this roster reflects the confirmed 22-team South East Division.

## Full Club List (Alphabetical)

1. AFC Croydon Athletic
2. AFC Whyteleafe
3. Ashford United
4. Beckenham Town
5. Broadbridge Heath
6. Crowborough Athletic
7. Deal Town
8. East Grinstead Town
9. Eastbourne Town
10. Erith Town
11. Faversham Town
12. Hassocks
13. Hastings United
14. Herne Bay
15. Jersey Bulls
16. Margate
17. Merstham
18. Sevenoaks Town
19. Sheppey United
20. Sittingbourne
21. Three Bridges
22. VCD Athletic
