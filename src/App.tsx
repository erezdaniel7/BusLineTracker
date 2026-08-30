import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import './App.css'
import {
  deduplicateLocations,
  fetchSiriDepartureTimes,
  fetchTimetable,
  fetchVehicleLocations,
} from './api/openBus'
import { RideSelector } from './components/RideSelector'
import { SearchPanel } from './components/SearchPanel'
import { StopsTable } from './components/StopsTable'
import { SummaryCards } from './components/SummaryCards'
import { TripMap } from './components/TripMap'
import { getRoute } from './config/routes'
import {
  estimateStopPassages,
  STOP_MATCH_THRESHOLD_METERS,
} from './domain/matching'
import type {
  Direction,
  LineNumber,
  RideOption,
  SearchFilters,
  TimetableStop,
  VehicleLocation,
} from './domain/types'
import {
  addDays,
  jerusalemLocalToDate,
  jerusalemToday,
  localTimeValue,
  scheduledStartWindow,
  serviceDayWindow,
} from './utils/time'

type LoadStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

function isLine(value: string | null): value is LineNumber {
  return value === '150' || value === '152'
}

function isDirection(value: string | null): value is Direction {
  return value === 'to-yeruham' || value === 'to-beersheva'
}

function getInitialFilters(): SearchFilters {
  const params = new URLSearchParams(window.location.search)
  const line = params.get('line')
  const direction = params.get('direction')
  const ride = Number(params.get('ride'))
  return {
    date: params.get('date') ?? jerusalemToday(),
    line: isLine(line) ? line : '150',
    direction: isDirection(direction) ? direction : 'to-yeruham',
    departureTime: params.get('time') ?? '',
    rideId: Number.isInteger(ride) && ride > 0 ? ride : null,
  }
}

function writeUrl(filters: SearchFilters, push = false): void {
  const params = new URLSearchParams()
  params.set('date', filters.date)
  params.set('line', filters.line)
  params.set('direction', filters.direction)
  if (filters.departureTime) params.set('time', filters.departureTime)
  if (filters.rideId) params.set('ride', String(filters.rideId))
  const url = `${window.location.pathname}?${params}`
  if (push) window.history.pushState(null, '', url)
  else window.history.replaceState(null, '', url)
}

function rideOptionsFor(locations: readonly VehicleLocation[]): RideOption[] {
  const rides = new Map<number, RideOption>()
  for (const location of locations) {
    const existing = rides.get(location.siriRideId)
    if (existing) {
      existing.pointCount += 1
    } else {
      rides.set(location.siriRideId, {
        id: location.siriRideId,
        journeyRef: location.journeyRef,
        scheduledStartTime: location.scheduledStartTime,
        vehicleRef: location.vehicleRef,
        pointCount: 1,
      })
    }
  }
  return [...rides.values()].sort(
    (a, b) =>
      new Date(a.scheduledStartTime).getTime() -
      new Date(b.scheduledStartTime).getTime(),
  )
}

function selectStopsForDeparture(
  timetable: readonly TimetableStop[],
  departureTime: string,
): TimetableStop[] {
  const departures = timetable.filter(
    (stop) =>
      stop.lineStartTime && localTimeValue(stop.lineStartTime) === departureTime,
  )
  const gtfsRideId = departures[0]?.gtfsRideId
  return gtfsRideId
    ? departures.filter((stop) => stop.gtfsRideId === gtfsRideId)
    : departures
}

function shiftTimetableToDate(
  timetable: readonly TimetableStop[],
  targetDate: string,
): TimetableStop[] {
  const shiftTimestamp = (timestamp: string | null): string | null => {
    if (!timestamp) return null
    const time = localTimeValue(timestamp)
    return jerusalemLocalToDate(targetDate, `${time}:00`).toISOString()
  }

  return timetable.map((stop) => ({
    ...stop,
    plannedArrivalTime: shiftTimestamp(stop.plannedArrivalTime),
    lineStartTime: shiftTimestamp(stop.lineStartTime),
  }))
}

function App() {
  const initial = useMemo(getInitialFilters, [])
  const [filters, setFilters] = useState<SearchFilters>(initial)
  const [timetable, setTimetable] = useState<TimetableStop[]>([])
  const [siriDepartureTimes, setSiriDepartureTimes] = useState<string[]>([])
  const [timetableLoading, setTimetableLoading] = useState(false)
  const [timetableMessage, setTimetableMessage] = useState<string | null>(null)
  const [locations, setLocations] = useState<VehicleLocation[]>([])
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isDelayed, setIsDelayed] = useState(false)
  const [selectedStopId, setSelectedStopId] = useState<number | null>(null)
  const [searchExpanded, setSearchExpanded] = useState(!initial.departureTime)
  const tripController = useRef<AbortController | null>(null)
  const hasAutoLoaded = useRef(false)

  const route = getRoute(filters.line, filters.direction)

  useEffect(() => {
    writeUrl(filters)
  }, [filters])

  useEffect(() => {
    const controller = new AbortController()
    setTimetableLoading(true)
    setTimetableMessage(null)
    setTimetable([])
    setSiriDepartureTimes([])

    const routeConfig = getRoute(filters.line, filters.direction)
    const window = serviceDayWindow(filters.date)

    Promise.allSettled([
      fetchTimetable(routeConfig.lineRef, window, controller.signal),
      fetchSiriDepartureTimes(routeConfig.lineRef, window, controller.signal),
    ])
      .then(async ([timetableResult, siriResult]) => {
        if (controller.signal.aborted) return
        let rows = timetableResult.status === 'fulfilled' ? timetableResult.value : []
        const siriTimes = siriResult.status === 'fulfilled' ? siriResult.value : []

        if (rows.length === 0 && siriTimes.length > 0) {
          const templateDate = addDays(filters.date, -7)
          try {
            const template = await fetchTimetable(
              routeConfig.lineRef,
              serviceDayWindow(templateDate),
              controller.signal,
            )
            rows = shiftTimetableToDate(template, filters.date)
          } catch (caught: unknown) {
            if (caught instanceof DOMException && caught.name === 'AbortError') return
          }
        }

        if (controller.signal.aborted) return
        setTimetable(rows)
        setSiriDepartureTimes(siriTimes)

        if (siriTimes.length > 0 && timetableResult.status === 'fulfilled' && timetableResult.value.length === 0) {
          setTimetableMessage(
            rows.length > 0
              ? 'מוצגות יציאות SIRI שנקלטו ב-GPS. רשימת התחנות מבוססת על אותו יום בשבוע הקודם.'
              : 'מוצגות יציאות SIRI שנקלטו בנתוני ה-GPS; רשימת התחנות המתוכננת עדיין אינה זמינה.',
          )
        } else if (siriTimes.length === 0 && rows.length === 0) {
          setTimetableMessage(
            'לא נמצאו לוח זמנים מתוכנן או נסיעות GPS ליום הזה.',
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setTimetableLoading(false)
      })

    return () => controller.abort()
  }, [filters.date, filters.direction, filters.line])

  const loadTrip = useCallback(async (search: SearchFilters) => {
    tripController.current?.abort()
    const controller = new AbortController()
    tripController.current = controller
    setStatus('loading')
    setError(null)
    setIsDelayed(false)
    setLocations([])
    setSelectedStopId(null)
    const delayTimer = window.setTimeout(() => setIsDelayed(true), 4_000)

    try {
      const routeConfig = getRoute(search.line, search.direction)
      const rows = await fetchVehicleLocations(
        routeConfig.lineRef,
        scheduledStartWindow(search.date, search.departureTime),
        controller.signal,
      )
      const cleanRows = deduplicateLocations(rows).sort(
        (a, b) =>
          new Date(a.recordedAtTime).getTime() -
          new Date(b.recordedAtTime).getTime(),
      )
      setLocations(cleanRows)
      const rides = rideOptionsFor(cleanRows)
      const requestedRideExists = rides.some((ride) => ride.id === search.rideId)
      const selectedRideId = requestedRideExists
        ? search.rideId
        : rides[0]?.id ?? null
      setFilters((current) => ({ ...current, rideId: selectedRideId }))
      setStatus(cleanRows.length > 0 ? 'success' : 'empty')
      if (cleanRows.length > 0) setSearchExpanded(false)
    } catch (caught: unknown) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setError(
        caught instanceof Error
          ? caught.message
          : 'אירעה שגיאה לא צפויה בעת טעינת נתוני הנסיעה.',
      )
      setStatus('error')
    } finally {
      window.clearTimeout(delayTimer)
      if (!controller.signal.aborted) setIsDelayed(false)
    }
  }, [])

  useEffect(() => {
    if (!hasAutoLoaded.current && initial.departureTime) {
      hasAutoLoaded.current = true
      void loadTrip(initial)
    }
  }, [initial, loadTrip])

  const departureOptions = useMemo(
    () => {
      const options = new Map<string, string | null>()
      for (const timestamp of siriDepartureTimes) {
        const time = localTimeValue(timestamp)
        if (!options.has(time)) options.set(time, null)
      }
      if (options.size === 0) {
        for (const stop of timetable) {
          if (!stop.lineStartTime) continue
          const time = localTimeValue(stop.lineStartTime)
          if (!options.has(time)) options.set(time, stop.name)
        }
      }
      return [...options].sort(([a], [b]) => a.localeCompare(b)).map(
        ([time, stationName]) => ({ time, stationName }),
      )
    },
    [siriDepartureTimes, timetable],
  )
  const rides = useMemo(() => rideOptionsFor(locations), [locations])
  const activeRideId =
    filters.rideId && rides.some((ride) => ride.id === filters.rideId)
      ? filters.rideId
      : rides[0]?.id ?? null
  const activeRide = rides.find((ride) => ride.id === activeRideId) ?? null
  const points = useMemo(
    () =>
      locations.filter((location) => location.siriRideId === activeRideId),
    [activeRideId, locations],
  )
  const stops = useMemo(
    () => selectStopsForDeparture(timetable, filters.departureTime),
    [filters.departureTime, timetable],
  )
  const routePreviewStops = useMemo(() => {
    const firstRideId = timetable.find((stop) => stop.gtfsRideId)?.gtfsRideId
    if (!firstRideId) return []
    return timetable.filter((stop) => stop.gtfsRideId === firstRideId)
  }, [timetable])
  const passages = useMemo(
    () => estimateStopPassages(stops, points),
    [points, stops],
  )
  const mapPassages = useMemo(
    () =>
      passages.length > 0
        ? passages
        : routePreviewStops.map((stop) => ({
          stop,
          point: null,
          distanceMeters: null,
          delayMinutes: null,
          confidence: null,
        })),
    [passages, routePreviewStops],
  )

  const handleFiltersChange = (nextFilters: SearchFilters) => {
    tripController.current?.abort()
    setFilters(nextFilters)
    setStatus('idle')
    setLocations([])
    setError(null)
  }

  return (
    <div className="app-shell">
      <main className="map-workspace">
        <section className="map-stage" aria-label="מפת קווי באר שבע ירוחם">
          <TripMap
            points={points}
            passages={mapPassages}
            selectedStopId={selectedStopId}
            onSelectStop={setSelectedStopId}
          />
        </section>

        <aside className="control-sidebar">
          <header className="site-header">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">מ</span>
              <div>
                <strong>מדד הקו</strong>
                <span>מעקב נסיעות אוטובוס</span>
              </div>
            </div>
            <span className="data-badge"><i /> היסטורי</span>
          </header>

          <div className="sidebar-content">
            <section className={`sidebar-search${searchExpanded ? ' expanded' : ''}`}>
              <button
                type="button"
                className="search-toggle"
                aria-expanded={searchExpanded}
                onClick={() => setSearchExpanded((current) => !current)}
              >
                <span className="search-toggle-icon" aria-hidden="true">⌕</span>
                <span>
                  <strong>{searchExpanded ? 'איתור נסיעה' : `קו ${filters.line} · ${filters.departureTime}`}</strong>
                  <small>{searchExpanded ? 'בחרו תאריך, קו ושעת יציאה' : `${filters.date} · ${route.origin} ← ${route.destination}`}</small>
                </span>
                <i aria-hidden="true">⌄</i>
              </button>

              {searchExpanded && (
                <div className="search-body">
                  <section className="hero-copy">
                    <span className="eyebrow">קווים 150 / 152</span>
                    <h1>איפה האוטובוס היה?</h1>
                    <p>בחרו נסיעה בין באר שבע לירוחם וצפו במסלול ובתחנות.</p>
                  </section>

                  <SearchPanel
                    filters={filters}
                    departureOptions={departureOptions}
                    timetableLoading={timetableLoading}
                    timetableMessage={timetableMessage}
                    loading={status === 'loading'}
                    onChange={handleFiltersChange}
                    onSubmit={() => {
                      writeUrl(filters, true)
                      void loadTrip(filters)
                    }}
                  />
                </div>
              )}
            </section>

            {status === 'loading' && (
              <div className="state-banner loading-state" role="status">
                <span className="large-spinner" />
                <div>
                  <strong>מאתרים את הנסיעה…</strong>
                  <span>{isDelayed ? 'השרת מתעכב, הבקשה עדיין פעילה.' : 'מורידים את מסלול ה-GPS.'}</span>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="state-banner error-state" role="alert">
                <span aria-hidden="true">!</span>
                <div><strong>לא הצלחנו לטעון</strong><p>{error}</p></div>
              </div>
            )}

            {status === 'empty' && (
              <div className="empty-state sidebar-empty">
                <strong>לא נמצאו תצפיות GPS לנסיעה</strong>
                <p>תחנות הקו עדיין מוצגות במפה.</p>
              </div>
            )}

            {status === 'success' && (
              <div className="sidebar-result">
                <section className="trip-title">
                  <div>
                    <span className="line-number">{route.line}</span>
                    <div><span className="eyebrow">נסיעה שנבחרה</span><h2>{route.origin} ← {route.destination}</h2></div>
                  </div>
                  <span className="point-count">{points.length} נקודות</span>
                </section>
                {activeRide && (
                  <dl className="bus-details-card">
                    <div>
                      <dt>לוחית רישוי</dt>
                      <dd dir="ltr">{activeRide.vehicleRef ?? 'לא ידועה'}</dd>
                    </div>
                    <div>
                      <dt>יציאה מתוכננת</dt>
                      <dd dir="ltr">{localTimeValue(activeRide.scheduledStartTime)}</dd>
                    </div>
                    <div>
                      <dt>SIRI ride ID</dt>
                      <dd dir="ltr">#{activeRide.id}</dd>
                    </div>
                    <div>
                      <dt>תצפיות GPS</dt>
                      <dd>{activeRide.pointCount}</dd>
                    </div>
                  </dl>
                )}
                <RideSelector
                  rides={rides}
                  selectedRideId={activeRideId}
                  onSelect={(rideId) => setFilters((current) => ({ ...current, rideId }))}
                />
                <SummaryCards passages={passages} points={points} />
                <StopsTable
                  passages={passages}
                  selectedStopId={selectedStopId}
                  onSelectStop={setSelectedStopId}
                  compact
                />
                <details className="methodology">
                  <summary>איך מחושב זמן המעבר בתחנה?</summary>
                  <div>
                    <p>
                      לכל תחנה נבחרת תצפית ה-GPS הקרובה ביותר, עד מרחק של{' '}
                      {STOP_MATCH_THRESHOLD_METERS} מטר. התצפית הראשונה מוחרגת
                      מההתאמה כאשר גם התצפית השנייה נמצאת באזור תחנת המוצא,
                      מפני שהיא עשויה לציין את הפעלת מערכת האוטובוס ולא את
                      תחילת הנסיעה.
                    </p>
                  </div>
                </details>
              </div>
            )}
          </div>

          <footer>
            <div>
              <a href="https://github.com/erezdaniel7/BusLineTracker" target="_blank" rel="noreferrer">GitHub</a>
              <a href="https://open-bus-stride-api.hasadna.org.il/docs" target="_blank" rel="noreferrer">תיעוד API</a>
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
            </div>
            <span>נתונים: Open Bus · הסדנא לידע ציבורי</span>
          </footer>
        </aside>
      </main>
    </div>
  )
}

export default App
