import type { VehicleLocation } from '../domain/types'

export interface Coordinate {
  lat: number
  lon: number
}

const EARTH_RADIUS_METERS = 6_371_000

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const latitudeDelta = toRadians(b.lat - a.lat)
  const longitudeDelta = toRadians(b.lon - a.lon)
  const latitudeA = toRadians(a.lat)
  const latitudeB = toRadians(b.lat)

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2

  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  )
}

export function splitTraceSegments(
  points: readonly VehicleLocation[],
  maxGapMilliseconds = 3 * 60 * 1000,
  maxJumpMeters = 3_000,
): VehicleLocation[][] {
  if (points.length === 0) return []

  const segments: VehicleLocation[][] = [[points[0]]]

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const timeGap =
      new Date(current.recordedAtTime).getTime() -
      new Date(previous.recordedAtTime).getTime()
    const jump = distanceMeters(previous, current)

    if (
      timeGap > maxGapMilliseconds ||
      timeGap < 0 ||
      jump > maxJumpMeters
    ) {
      segments.push([current])
    } else {
      segments.at(-1)?.push(current)
    }
  }

  return segments
}
