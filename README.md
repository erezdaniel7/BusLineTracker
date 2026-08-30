# Bus Trip Tracker

A frontend-only historical bus trip viewer for routes 150 and 152 between
Be'er Sheva and Yeruham. The interface is Hebrew-first and RTL, with a responsive
station table and an interactive Leaflet/OpenStreetMap trace.

## Features

- Service date, route, direction, and planned departure filters
- Planned departure discovery with a manual `HH:mm` fallback
- Direct browser access to the Open Bus Stride API (no backend or API key)
- Safe 15,000-row pagination and narrowly scoped GPS requests
- Multiple SIRI ride selection when a time window contains more than one ride
- Jerusalem-local time display with daylight-saving-aware query boundaries
- Estimated stop passage, delay, distance, and confidence
- Trace splitting across gaps over 3 minutes or jumps over 3 km
- Detailed popups for every GPS point and station marker
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

Each planned stop is matched to the nearest later, unused GPS observation within
225 metres. Confidence is high through 80 m, medium through 150 m, and low
through 225 m. Matching only moves forward through the trace, so one observation
is not reused across stops.

The resulting passage times are estimates, not measured arrivals. GPS is usually
sampled around once per minute and can contain missing or repeated snapshots.
Stops without a reliable nearby observation are shown as unavailable. Map lines
are split for time gaps over 3 minutes and geographic jumps over 3 km rather than
drawing a misleading connection. All query boundaries and displayed times use
the `Asia/Jerusalem` time zone.

Current-day planned data may not yet exist in the archive. The manual departure
field keeps GPS search available in that case. The upstream API can return HTTP
500 for expensive requests; the app surfaces those failures instead of masking
them.

## Static deployment

Build output is written to `dist/` and can be hosted on any static service:

```bash
npm ci
npm run build
```

For a GitHub Pages project site, pass the repository path as Vite's base:

```bash
npm run build -- --base=/YOUR_REPOSITORY_NAME/
```

Publish the generated `dist/` directory. No runtime environment variables,
secrets, server routes, or rewrite rules are required.
