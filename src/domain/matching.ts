import type {
  MatchConfidence,
  SiriRideStopInfo,
  StopPassage,
  TimetableStop,
  VehicleLocation,
} from './types'
import { distanceMeters } from '../utils/geo'

export const STOP_MATCH_THRESHOLD_METERS = 225
const LINKED_STOP_MATCH_THRESHOLD_METERS = 500
const DEPARTURE_PROGRESS_THRESHOLD_METERS = 100

function confidenceForDistance(distance: number): MatchConfidence {
  if (distance <= 80) return 'high'
  if (distance <= 150) return 'medium'
  return 'low'
}

export function estimateStopPassages(
  stops: readonly TimetableStop[],
  points: readonly VehicleLocation[],
  thresholdMeters = STOP_MATCH_THRESHOLD_METERS,
  rideStopOrders: ReadonlyMap<number, SiriRideStopInfo> = new Map(),
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
    distanceMeters({ lat: firstStop.lat, lon: firstStop.lon }, points[0]) <=
    thresholdMeters &&
    distanceMeters({ lat: firstStop.lat, lon: firstStop.lon }, points[1]) <=
    thresholdMeters
  let nextPointIndex = secondPointIsAtOrigin ? 1 : 0

  return stops.map((stop, stopIndex) => {
    const targetOrder = stopIndex + 1
    const stationCode =
      stop.code ??
      [...rideStopOrders.values()].find((info) => info.order === targetOrder)
        ?.code ??
      null
    if (stop.lat === null || stop.lon === null || nextPointIndex >= points.length) {
      return {
        stop,
        stationCode,
        point: null,
        distanceMeters: null,
        delayMinutes: null,
        confidence: null,
      }
    }
    const stopCoordinate = { lat: stop.lat, lon: stop.lon }

    const linkedCandidates = points.flatMap((point, index) => {
      if (index < nextPointIndex || point.siriRideStopId === null) return []
      return rideStopOrders.get(point.siriRideStopId)?.order === targetOrder
        ? [
          {
            index,
            distance: distanceMeters(stopCoordinate, point),
          },
        ]
        : []
    })
    const progressedOriginMatch =
      stopIndex === 0
        ? linkedCandidates.find(({ index }) => {
          const progress = points[index].distanceFromJourneyStart
          return (
            progress !== null &&
            progress >= DEPARTURE_PROGRESS_THRESHOLD_METERS
          )
        }) ?? null
        : null
    const linkedMatch =
      progressedOriginMatch ??
      linkedCandidates.reduce<{
        index: number
        distance: number
      } | null>(
        (best, candidate) =>
          best === null || candidate.distance < best.distance
            ? candidate
            : best,
        null,
      )

    // Without a SIRI stop-order match, use the first observation that enters
    // the station radius. This avoids matching a later return through a nearby
    // street simply because that later point is a few metres closer.
    let closestIndex = linkedMatch?.index ?? -1
    let closestDistance = linkedMatch?.distance ?? Number.POSITIVE_INFINITY
    if (linkedMatch === null) {
      for (let index = nextPointIndex; index < points.length; index += 1) {
        const point = points[index]
        const knownOrder =
          point.siriRideStopId === null
            ? undefined
            : rideStopOrders.get(point.siriRideStopId)?.order
        if (knownOrder !== undefined) continue
        const distance = distanceMeters(stopCoordinate, point)
        if (distance <= thresholdMeters) {
          closestIndex = index
          closestDistance = distance
          break
        }
      }
    }

    const acceptedThreshold =
      linkedMatch === null
        ? thresholdMeters
        : Math.max(thresholdMeters, LINKED_STOP_MATCH_THRESHOLD_METERS)
    if (closestIndex < 0 || closestDistance > acceptedThreshold) {
      return {
        stop,
        stationCode,
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
      stationCode,
      point,
      distanceMeters: closestDistance,
      delayMinutes:
        plannedTime === null
          ? null
          : Math.trunc((actualTime - plannedTime) / 60_000),
      confidence: confidenceForDistance(closestDistance),
    }
  })
}
