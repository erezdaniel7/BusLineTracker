import { describe, expect, it } from 'vitest'
import type { VehicleLocation } from '../domain/types'
import { distanceMeters, splitTraceSegments } from './geo'

function location(
  id: number,
  recordedAtTime: string,
  lat: number,
  lon: number,
): VehicleLocation {
  return {
    id,
    siriSnapshotId: id,
    siriRideStopId: null,
    recordedAtTime,
    lat,
    lon,
    bearing: null,
    velocity: null,
    distanceFromJourneyStart: null,
    distanceFromRideStopMeters: null,
    snapshotRef: null,
    siriRouteId: 1,
    lineRef: 26156,
    operatorRef: 15,
    siriRideId: 10,
    journeyRef: null,
    scheduledStartTime: '2025-01-01T06:00:00Z',
    vehicleRef: null,
    firstVehicleLocationId: null,
    lastVehicleLocationId: null,
    durationMinutes: null,
    gtfsRideId: null,
  }
}

describe('distanceMeters', () => {
  it('calculates a known short distance', () => {
    const distance = distanceMeters(
      { lat: 31.243017, lon: 34.796743 },
      { lat: 31.23819, lon: 34.798108 },
    )
    expect(distance).toBeGreaterThan(540)
    expect(distance).toBeLessThan(560)
  })

  it('returns zero for identical coordinates', () => {
    expect(
      distanceMeters(
        { lat: 31.243017, lon: 34.796743 },
        { lat: 31.243017, lon: 34.796743 },
      ),
    ).toBe(0)
  })
})

describe('splitTraceSegments', () => {
  it('splits on time gaps over three minutes', () => {
    const points = [
      location(1, '2025-01-01T06:00:00Z', 31.24, 34.79),
      location(2, '2025-01-01T06:02:00Z', 31.241, 34.791),
      location(3, '2025-01-01T06:06:01Z', 31.242, 34.792),
    ]
    expect(splitTraceSegments(points).map((segment) => segment.length)).toEqual([
      2, 1,
    ])
  })

  it('splits on geographic jumps over three kilometres', () => {
    const points = [
      location(1, '2025-01-01T06:00:00Z', 31.24, 34.79),
      location(2, '2025-01-01T06:01:00Z', 31.3, 34.79),
    ]
    expect(splitTraceSegments(points)).toHaveLength(2)
  })
})
