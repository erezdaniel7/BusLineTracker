export type LineNumber = '150' | '152'
export type Direction = 'to-yeruham' | 'to-beersheva'

export interface RouteConfig {
  lineRef: number
  line: LineNumber
  direction: Direction
  origin: string
  destination: string
}

export interface TimetableStop {
  id: number
  name: string | null
  city: string | null
  lon: number | null
  lat: number | null
  plannedArrivalTime: string | null
  lineRef: string | null
  lineStartTime: string | null
  gtfsRideId: string | null
}

export interface VehicleLocation {
  id: number
  siriSnapshotId: number
  siriRideStopId: number | null
  recordedAtTime: string
  lon: number
  lat: number
  bearing: number | null
  velocity: number | null
  distanceFromJourneyStart: number | null
  distanceFromRideStopMeters: number | null
  snapshotRef: string | null
  siriRouteId: number | null
  lineRef: number | null
  operatorRef: number | null
  siriRideId: number
  journeyRef: string | null
  scheduledStartTime: string
  vehicleRef: string | null
  firstVehicleLocationId: number | null
  lastVehicleLocationId: number | null
  durationMinutes: number | null
  gtfsRideId: string | null
}

export interface RideOption {
  id: number
  journeyRef: string | null
  scheduledStartTime: string
  vehicleRef: string | null
  pointCount: number
}

export type MatchConfidence = 'high' | 'medium' | 'low'

export interface StopPassage {
  stop: TimetableStop
  point: VehicleLocation | null
  distanceMeters: number | null
  delayMinutes: number | null
  confidence: MatchConfidence | null
}

export interface SearchFilters {
  date: string
  line: LineNumber
  direction: Direction
  departureTime: string
  rideId: number | null
}
