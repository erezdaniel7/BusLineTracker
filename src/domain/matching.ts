import type {
  MatchConfidence,
  StopPassage,
  TimetableStop,
  VehicleLocation,
} from './types'
import { distanceMeters } from '../utils/geo'

export const STOP_MATCH_THRESHOLD_METERS = 225

function confidenceForDistance(distance: number): MatchConfidence {
  if (distance <= 80) return 'high'
  if (distance <= 150) return 'medium'
  return 'low'
}

export function estimateStopPassages(
  stops: readonly TimetableStop[],
  points: readonly VehicleLocation[],
  thresholdMeters = STOP_MATCH_THRESHOLD_METERS,
): StopPassage[] {
  // The first SIRI observation often marks the driver's system startup while
  // the bus is parked. Ignore it only when the second sample is still inside
  // the first station area, so a sparse trace does not lose its first match.
  const firstStop = stops[0]
  const secondPointIsAtOrigin =
    points.length > 1 &&
    firstStop !== undefined &&
    firstStop.lat !== null &&
    firstStop.lon !== null &&
    distanceMeters(firstStop, points[1]) <= thresholdMeters
  let nextPointIndex = secondPointIsAtOrigin ? 1 : 0

  return stops.map((stop) => {
    if (stop.lat === null || stop.lon === null || nextPointIndex >= points.length) {
      return {
        stop,
        point: null,
        distanceMeters: null,
        delayMinutes: null,
        confidence: null,
      }
    }

    let closestIndex = -1
    let closestDistance = Number.POSITIVE_INFINITY

    for (let index = nextPointIndex; index < points.length; index += 1) {
      const distance = distanceMeters(stop, points[index])
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    }

    if (closestIndex < 0 || closestDistance > thresholdMeters) {
      return {
        stop,
        point: null,
        distanceMeters: closestDistance,
        delayMinutes: null,
        confidence: null,
      }
    }

    const point = points[closestIndex]
    nextPointIndex = closestIndex + 1
    const plannedTime = stop.plannedArrivalTime
      ? new Date(stop.plannedArrivalTime).getTime()
      : null
    const actualTime = new Date(point.recordedAtTime).getTime()

    return {
      stop,
      point,
      distanceMeters: closestDistance,
      delayMinutes:
        plannedTime === null
          ? null
          : Math.round((actualTime - plannedTime) / 60_000),
      confidence: confidenceForDistance(closestDistance),
    }
  })
}
