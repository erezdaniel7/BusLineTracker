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
  let nextPointIndex = 0

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
