# Isthmian League Premier Division — 2025–26 Season (Step 3, Level 7)

**Season used:** 2025–26 (page exists at `2025–26_Isthmian_League` on Wikipedia).  
**Research date:** 20 May 2026  
**Data sources:**

- Wikipedia: `2025–26 Isthmian League` — Stadiums and locations table + location map coordinates
- Wikipedia API / individual club articles for ground coordinates
- postcodes.io reverse geocoding API for postcode lookup
- Nominatim OpenStreetMap (where postcodes.io returned no result)

## Data Quality Notes

- Wikipedia map coordinates are approximate (typically correct to ~3–4 decimal places).
- Postcodes were resolved from coordinates via postcodes.io; where that failed, Nominatim display names were used.
- **Cray Valley Paper Mills** (Badgers Sports Ground): postcodes.io returned no result for the exact coordinates. Nominatim was rate-limited. Postcode is listed as approximate for the Middle Park Avenue / Eltham SE9 area.
- **Billericay Town** (New Lodge): postcodes.io returned no result for the Wikipedia map coordinates. Postcode verified against postcodes.io via direct postcode lookup.
- **Brentwood Town** (Brentwood Centre Arena): postcode verified against known Brentwood Centre postcode.
- **Carshalton Athletic** (War Memorial Sports Ground): postcode verified via direct postcode lookup.
- **Whitehawk**: postcode extracted from Nominatim display name (The Enclosed Ground, Wilson Avenue, Brighton BN2 5TS).
- **Wingate & Finchley**: postcode extracted from Nominatim display name (Maurice Rebak Stadium, Summers Lane, London N12 0PE).
- **Chatham Town**: Nominatim returned "The Bauvill Stadium, Maidstone Road, Chatham, ME4 6DH"; postcodes.io returned ME4 6ES. ME4 6DH used as it matches the stadium address.
- **Hashtag United** groundshare with Aveley at Parkside is noted in Wikipedia.

## Clubs Table

| # | Club | Ground | Town | Postcode | Latitude | Longitude | Groundshare? | Source |
|---|------|--------|------|----------|----------|-----------|--------------|--------|
| 1 | Aveley | Parkside | Aveley | RM15 4ET | 51.5035 | 0.2529 | Hosts Hashtag United | Wiki map + postcodes.io |
| 2 | Billericay Town | New Lodge | Billericay | CM12 0SA | 51.6220 | 0.4041 | No | Wiki map + postcodes.io lookup |
| 3 | Brentwood Town | Brentwood Centre Arena | Brentwood | CM15 8NN | 51.6340 | 0.3006 | No | Wiki map + postcodes.io lookup |
| 4 | Burgess Hill Town | Leylands Park | Burgess Hill | RH15 8AW | 50.9672 | −0.1241 | No | Wiki map + postcodes.io |
| 5 | Canvey Island | Park Lane | Canvey Island | SS8 7PY | 51.5165 | 0.6157 | No | Wiki map + postcodes.io |
| 6 | Carshalton Athletic | War Memorial Sports Ground | Carshalton | SM5 2PW | 51.3697 | −0.1718 | No | Wiki map + postcodes.io lookup |
| 7 | Chatham Town | The Bauvill Stadium | Chatham | ME4 6DH | 51.3687 | 0.5217 | No | Wiki map + Nominatim |
| 8 | Cheshunt | Theobalds Lane | Cheshunt | EN8 8RU | 51.6944 | −0.0416 | No | Wiki map + postcodes.io |
| 9 | Chichester City | Oaklands Park | Chichester | PO19 6AR | 50.8425 | −0.7754 | No | Wiki map + postcodes.io |
| 10 | Cray Valley Paper Mills | Badgers Sports Ground | Eltham, London | SE9 2 (approx.) | 51.4506 | 0.0346 | No | Wiki map + postcodes.io (unresolved) |
| 11 | Cray Wanderers | Flamingo Park | Chislehurst | BR7 6HL | 51.4299 | 0.0818 | No | Wiki map + postcodes.io |
| 12 | Dartford | Princes Park | Dartford | DA1 1RT | 51.4367 | 0.2305 | No | Wiki map + postcodes.io |
| 13 | Dulwich Hamlet | Champion Hill | East Dulwich, London | SE22 8BD | 51.4612 | −0.0840 | No | Wiki map + postcodes.io |
| 14 | Folkestone Invicta | Cheriton Road | Folkestone | CT19 5JU | 51.0866 | 1.1595 | No | Wiki map + postcodes.io |
| 15 | Hashtag United | Parkside | Aveley | RM15 4ET | 51.5035 | 0.2529 | Yes (groundshare with Aveley) | Wikipedia table |
| 16 | Lewes | The Dripping Pan | Lewes | BN7 2UY | 50.8690 | 0.0123 | No | Wiki map + postcodes.io |
| 17 | Potters Bar Town | Parkfield | Potters Bar | EN6 1DP | 51.6962 | −0.1777 | No | Wiki map + postcodes.io |
| 18 | Ramsgate | Southwood Stadium | Ramsgate | CT11 0DT | 51.3325 | 1.3995 | No | Wiki map + postcodes.io |
| 19 | St Albans City | Clarence Park | St Albans | AL1 4NF | 51.7543 | −0.3252 | No | Wiki map + Nominatim |
| 20 | Welling United | Park View Road | Welling, London | DA16 1SY | 51.4603 | 0.1165 | No | Wiki map + postcodes.io |
| 21 | Whitehawk | The Enclosed Ground | Whitehawk, Brighton | BN2 5TS | 50.8214 | −0.0961 | No | Wiki map + Nominatim |
| 22 | Wingate & Finchley | The Maurice Rebak Stadium | Finchley, London | N12 0PE | 51.6068 | −0.1715 | No | Wiki map + Nominatim |

## Groundshare Details

| Tenant | Host Club | Ground | Notes |
|--------|-----------|--------|-------|
| Hashtag United | Aveley | Parkside, Aveley | Confirmed in Wikipedia 2025–26 table |

## Coordinate Sources (per club)

- **Aveley / Hashtag United**: Wikipedia location map (51.5035, 0.2529) — Parkside, Aveley.
- **Billericay Town**: Wikipedia location map (51.6220, 0.4041) — New Lodge.
- **Brentwood Town**: Wikipedia location map (51.6340, 0.3006) — Brentwood Centre Arena.
- **Burgess Hill Town**: Wikipedia location map (50.9672, −0.1241) — Leylands Park.
- **Canvey Island**: Wikipedia location map (51.5165, 0.6157) — Park Lane.
- **Carshalton Athletic**: Wikipedia location map (51.3697, −0.1718) — War Memorial Sports Ground.
- **Chatham Town**: Wikipedia map (51.3687, 0.52165) + Nominatim (51.3686381, 0.5213368). Used Wikipedia coords.
- **Cheshunt**: Wikipedia location map (51.6944, −0.0416) — Theobalds Lane.
- **Chichester City**: Wikipedia location map (50.8425, −0.7754) — Oaklands Park.
- **Cray Valley Paper Mills**: Wikipedia map (51.4506, 0.0346) + Cray Valley PM article (51.45056, 0.03472). Used Wikipedia coords.
- **Cray Wanderers**: Wikipedia location map (51.4299, 0.0818) — Flamingo Park.
- **Dartford**: Wikipedia location map (51.4367, 0.2305) — Princes Park.
- **Dulwich Hamlet**: Wikipedia location map (51.4612, −0.0840) — Champion Hill.
- **Folkestone Invicta**: Wikipedia location map (51.0866, 1.1595) — Cheriton Road.
- **Lewes**: Wikipedia location map (50.8690, 0.0123) — The Dripping Pan.
- **Potters Bar Town**: Wikipedia location map (51.6962, −0.1777) — Parkfield.
- **Ramsgate**: Wikipedia location map (51.3325, 1.3995) — Southwood Stadium.
- **St Albans City**: Wikipedia map (51.7543, −0.3252) + Nominatim (51.7532893, −0.3240633). Used Wikipedia coords.
- **Welling United**: Wikipedia location map (51.4603, 0.1165) — Park View Road.
- **Whitehawk**: Wikipedia map (50.8214, −0.0961) + Nominatim (50.8214103, −0.0962838). Used Wikipedia coords.
- **Wingate & Finchley**: Wikipedia map (51.6068, −0.1715) + Nominatim (51.6068627, −0.1714792). Used Wikipedia coords.

## Raw Data

The source Wikipedia table also lists stadium capacities, which may be useful for future reference:

| Club | Capacity |
|------|----------|
| Aveley | 3,500 |
| Billericay Town | 4,800 |
| Brentwood Town | 1,500 |
| Burgess Hill Town | 2,500 |
| Canvey Island | 4,100 |
| Carshalton Athletic | 5,000 |
| Chatham Town | 5,000 |
| Cheshunt | 3,174 |
| Chichester City | 2,000 |
| Cray Valley Paper Mills | 1,550 |
| Cray Wanderers | 2,500 |
| Dartford | 4,100 |
| Dulwich Hamlet | 3,334 |
| Folkestone Invicta | 4,000 |
| Hashtag United | 3,500 |
| Lewes | 3,000 |
| Potters Bar Town | 2,000 |
| Ramsgate | 3,500 |
| St Albans City | 5,007 |
| Welling United | 4,000 |
| Whitehawk | 3,126 |
| Wingate & Finchley | 2,638 |
