# madad-hakav (מדד הקו)

[Live site](https://erezdaniel7.github.io/madad-hakav/)

A frontend-only historical bus trip viewer for routes 150 and 152 between
Be'er Sheva and Yeruham. The Hebrew-first RTL interface uses a full-screen
Leaflet/OpenStreetMap view and a separately scrolling trip-information sidebar.

## Features

- Service date (today by default), route, direction, and departure filters
- Departure discovery from recorded SIRI rides, with planned GTFS times as a fallback
- Direct browser access to the Open Bus Stride API (no backend or API key)
- Safe 15,000-row pagination and narrowly scoped GPS requests
- Multiple SIRI ride selection when a time window contains more than one ride
- Jerusalem-local time display with daylight-saving-aware query boundaries
- Estimated stop passage, delay, distance, and confidence
- Exact scheduled-trip identity matching with following departures kept separate
- Explicit observed, not-observed, GPS-gap, and not-verifiable evidence states
- GPS interruption, prolonged-stop, and approximate route-deviation diagnostics
- Daily planned/SIRI trip counts as a service denominator
- Current-day station fallback using the same weekday's timetable from one week earlier
- Trace splitting across gaps over 3 minutes or jumps over 3 km
- Detailed popups for every GPS point and station marker
- Fixed map viewport with collapsible search and trip details in the sidebar
- URL query parameters for shareable and refresh-safe trip views
- Explicit loading, slow-API, empty, and error states

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run preview
```

## Data source

The app calls [Open Bus Stride](https://open-bus-stride-api.hasadna.org.il)
directly from the browser. It uses:

- `GET /route_timetable/list` for planned stop times
- `GET /siri_rides/list` for departures that were observed by SIRI
- `GET /siri_vehicle_locations/list` for historical observations
- Operator ref `15`

| Stride line ref | Public line | Direction |
| ---: | ---: | --- |
| 26156 | 150 | Be'er Sheva → Yeruham |
| 26157 | 150 | Yeruham → Be'er Sheva |
| 26160 | 152 | Yeruham → Be'er Sheva |
| 26200 | 152 | Be'er Sheva → Yeruham |

GPS requests use the API's existing misspelled
`siri_rides__schedualed_start_time_from` and
`siri_rides__schedualed_start_time_to` parameters. Requests are restricted to
an eight-minute window around the selected scheduled departure. Results are
still paginated because the API caps normal pages at 15,000 rows.

## Methodology and limitations

Each planned stop is matched using the SIRI ride-stop order when that metadata
is available. Otherwise, the first later observation entering a 225-metre radius
is selected rather than a geographically closer point from a later loop through
the neighborhood. Confidence is high through 80 m, medium through 150 m, and low
beyond that. Matching only moves forward through the trace, so one observation
is not reused across stops. At the origin, the first order-1 SIRI observation
showing at least 100 metres of journey progress is used as the departure time.
This avoids treating system startup or waiting at the platform as an early
departure. If progress metadata is unavailable, normal station matching remains
the fallback.

The resulting passage times are estimates, not measured arrivals. GPS is usually
sampled around once per minute and can contain missing or repeated snapshots.
Stops without a reliable nearby observation are shown as unavailable. Map lines
are split for time gaps over 3 minutes and geographic jumps over 3 km rather than
drawing a misleading connection. All query boundaries and displayed times use
the `Asia/Jerusalem` time zone.

GPS observations are grouped by SIRI ride identity. A late bus remains attached
to its original `scheduled_start_time`; a later scheduled departure is shown as
a separate following trip and is never silently substituted for the requested
one. When duplicate target identities exist, selection considers journey
identity, route progress, endpoint coverage, and sample coverage rather than
point count alone. Missing GPS is reported as missing evidence—not proof that a
physical trip was cancelled.

Feed gaps and prolonged stationary periods are reported independently. Approximate
route-deviation warnings require at least three consecutive points over one
kilometre from the corridor connecting planned stops and reset across feed gaps.
Because this is a stop-to-stop corridor rather than the official GTFS shape, the
UI presents deviations as a suspicion rather than a definitive route violation.

Current-day planned GTFS data may not yet exist in the `route_timetable`
aggregation even when SIRI GPS data is already available. The app therefore
uses SIRI scheduled start times for the departure list. If today's planned stop
rows are missing, it uses the timetable from the same weekday one week earlier
as a station template and shifts those planned times to the selected date. The
UI labels this fallback because schedules can change between weeks.

The upstream API can return HTTP 500 or respond slowly for expensive requests;
the app surfaces those failures instead of masking them.

## GitHub Pages deployment

Build output is written to `dist/` and can be hosted on any static service:

```bash
npm ci
npm run build
```

The repository is public and GitHub Pages is already configured to use GitHub
Actions. Pushes to `erezdaniel7-bus-tracker-webapp` run
`.github/workflows/deploy-pages.yml`, build the Vite application, and publish it
at [erezdaniel7.github.io/madad-hakav](https://erezdaniel7.github.io/madad-hakav/).

No runtime environment variables, secrets, server routes, or rewrite rules are
required.
