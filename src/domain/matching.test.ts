import { describe, expect, it } from 'vitest'
import type { TimetableStop, VehicleLocation } from './types'
import { estimateStopPassages } from './matching'

function stop(
  id: number,
  lat: number,
  lon: number,
  plannedArrivalTime: string,
): TimetableStop {
  return {
    id,
    name: `Stop ${id}`,
    city: null,
    lat,
    lon,
    plannedArrivalTime,
    lineRef: '26156',
    lineStartTime: '2025-01-01T08:00:00+02:00',
    gtfsRideId: 'ride',
  }
}

function point(
  id: number,
  lat: number,
  lon: number,
  recordedAtTime: string,
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

describe('estimateStopPassages', () => {
  it('ignores the system-startup observation when matching the first stop', () => {
    const passages = estimateStopPassages(
      [stop(1, 31.24, 34.79, '2025-01-01T08:02:00+02:00')],
      [
        point(10, 31.24, 34.79, '2025-01-01T05:55:00Z'),
        point(11, 31.2402, 34.7901, '2025-01-01T06:03:00Z'),
      ],
    )

    expect(passages[0].point?.id).toBe(11)
    expect(passages[0].delayMinutes).toBe(1)
  })

  it('matches nearby observations and calculates delay', () => {
    const passages = estimateStopPassages(
      [stop(1, 31.24, 34.79, '2025-01-01T08:02:00+02:00')],
      [point(11, 31.2402, 34.7901, '2025-01-01T06:05:00Z')],
    )

    expect(passages[0].point?.id).toBe(11)
    expect(passages[0].delayMinutes).toBe(3)
    expect(passages[0].confidence).toBe('high')
  })

  it('does not fabricate a passage beyond the distance threshold', () => {
    const passages = estimateStopPassages(
      [stop(1, 31.24, 34.79, '2025-01-01T08:02:00+02:00')],
      [point(11, 31.25, 34.8, '2025-01-01T06:05:00Z')],
    )
    expect(passages[0].point).toBeNull()
    expect(passages[0].delayMinutes).toBeNull()
  })

  it('does not reuse one observation for consecutive stops', () => {
    const passages = estimateStopPassages(
      [
        stop(1, 31.24, 34.79, '2025-01-01T08:02:00+02:00'),
        stop(2, 31.2401, 34.7901, '2025-01-01T08:03:00+02:00'),
      ],
      [point(11, 31.24, 34.79, '2025-01-01T06:03:00Z')],
    )
    expect(passages[0].point?.id).toBe(11)
    expect(passages[1].point).toBeNull()
  })

  it('keeps matching monotonic along the trace', () => {
    const passages = estimateStopPassages(
      [
        stop(1, 31.24, 34.79, '2025-01-01T08:02:00+02:00'),
        stop(2, 31.242, 34.792, '2025-01-01T08:04:00+02:00'),
      ],
      [
        point(11, 31.24, 34.79, '2025-01-01T06:03:00Z'),
        point(12, 31.242, 34.792, '2025-01-01T06:05:00Z'),
      ],
    )
    expect(passages.map((passage) => passage.point?.id)).toEqual([11, 12])
  })
})
