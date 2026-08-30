import type { TimetableStop, VehicleLocation } from '../domain/types'
import { OPERATOR_REF } from '../config/routes'

const API_BASE_URL = 'https://open-bus-stride-api.hasadna.org.il'
const PAGE_SIZE = 15_000
const MAX_PAGES = 20

type ApiRecord = Record<string, unknown>

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberValue(record: ApiRecord, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringValue(record: ApiRecord, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

function requiredNumber(record: ApiRecord, key: string): number {
  const value = numberValue(record, key)
  if (value === null) throw new Error(`שדה מספרי חסר בתשובת ה-API: ${key}`)
  return value
}

function requiredString(record: ApiRecord, key: string): string {
  const value = stringValue(record, key)
  if (value === null) throw new Error(`שדה טקסט חסר בתשובת ה-API: ${key}`)
  return value
}

function parseTimetableStop(value: unknown): TimetableStop {
  if (!isRecord(value)) throw new Error('התקבלה רשומת לוח זמנים לא תקינה')
  return {
    id: requiredNumber(value, 'id'),
    name: stringValue(value, 'name'),
    city: stringValue(value, 'city'),
    lon: numberValue(value, 'lon'),
    lat: numberValue(value, 'lat'),
    plannedArrivalTime: stringValue(value, 'planned_arrival_time'),
    lineRef: stringValue(value, 'gtfs_line_ref'),
    lineStartTime: stringValue(value, 'gtfs_line_start_time'),
    gtfsRideId: stringValue(value, 'gtfs_ride_id'),
  }
}

function parseVehicleLocation(value: unknown): VehicleLocation {
  if (!isRecord(value)) throw new Error('התקבלה רשומת מיקום לא תקינה')
  return {
    id: requiredNumber(value, 'id'),
    siriSnapshotId: requiredNumber(value, 'siri_snapshot_id'),
    siriRideStopId: numberValue(value, 'siri_ride_stop_id'),
    recordedAtTime: requiredString(value, 'recorded_at_time'),
    lon: requiredNumber(value, 'lon'),
    lat: requiredNumber(value, 'lat'),
    bearing: numberValue(value, 'bearing'),
    velocity: numberValue(value, 'velocity'),
    distanceFromJourneyStart: numberValue(
      value,
      'distance_from_journey_start',
    ),
    distanceFromRideStopMeters: numberValue(
      value,
      'distance_from_siri_ride_stop_meters',
    ),
    snapshotRef: stringValue(value, 'siri_snapshot__snapshot_id'),
    siriRouteId: numberValue(value, 'siri_route__id'),
    lineRef: numberValue(value, 'siri_route__line_ref'),
    operatorRef: numberValue(value, 'siri_route__operator_ref'),
    siriRideId: requiredNumber(value, 'siri_ride__id'),
    journeyRef: stringValue(value, 'siri_ride__journey_ref'),
    scheduledStartTime: requiredString(
      value,
      'siri_ride__scheduled_start_time',
    ),
    vehicleRef: stringValue(value, 'siri_ride__vehicle_ref'),
    firstVehicleLocationId: numberValue(
      value,
      'siri_ride__first_vehicle_location_id',
    ),
    lastVehicleLocationId: numberValue(
      value,
      'siri_ride__last_vehicle_location_id',
    ),
    durationMinutes: numberValue(value, 'siri_ride__duration_minutes'),
    gtfsRideId: stringValue(value, 'siri_ride__gtfs_ride_id'),
  }
}

async function fetchPage(
  path: string,
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const response = await fetch(`${API_BASE_URL}${path}?${params}`, { signal })
  if (!response.ok) {
    let detail = ''
    try {
      detail = await response.text()
    } catch {
      detail = ''
    }
    throw new Error(
      `שגיאת API (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ''}`,
    )
  }
  const data: unknown = await response.json()
  if (!Array.isArray(data)) throw new Error('ה-API החזיר מבנה נתונים לא צפוי')
  return data
}

async function fetchPaginated<T>(
  path: string,
  baseParams: URLSearchParams,
  parser: (value: unknown) => T,
  signal?: AbortSignal,
): Promise<T[]> {
  const results: T[] = []

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams(baseParams)
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(page * PAGE_SIZE))
    const pageData = await fetchPage(path, params, signal)
    results.push(...pageData.map(parser))
    if (pageData.length < PAGE_SIZE) return results
  }

  throw new Error('הבקשה חרגה ממגבלת הבטיחות של חלוקת העמודים')
}

export async function fetchTimetable(
  lineRef: number,
  window: { from: string; to: string },
  signal?: AbortSignal,
): Promise<TimetableStop[]> {
  const params = new URLSearchParams({
    line_refs: String(lineRef),
    planned_start_time_date_from: window.from,
    planned_start_time_date_to: window.to,
    order_by: 'planned_arrival_time asc',
  })
  return fetchPaginated(
    '/route_timetable/list',
    params,
    parseTimetableStop,
    signal,
  )
}

export async function fetchVehicleLocations(
  lineRef: number,
  scheduledWindow: { from: string; to: string },
  signal?: AbortSignal,
): Promise<VehicleLocation[]> {
  const params = new URLSearchParams({
    siri_routes__line_ref: String(lineRef),
    siri_routes__operator_ref: String(OPERATOR_REF),
    siri_rides__schedualed_start_time_from: scheduledWindow.from,
    siri_rides__schedualed_start_time_to: scheduledWindow.to,
    order_by: 'recorded_at_time asc',
  })
  return fetchPaginated(
    '/siri_vehicle_locations/list',
    params,
    parseVehicleLocation,
    signal,
  )
}

export function deduplicateLocations(
  locations: readonly VehicleLocation[],
): VehicleLocation[] {
  const seen = new Set<string>()
  return locations.filter((location) => {
    const key = `${location.siriRideId}:${location.recordedAtTime}:${location.lat}:${location.lon}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
