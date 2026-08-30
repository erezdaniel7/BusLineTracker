import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import './App.css'
import {
  deduplicateLocations,
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
    date: params.get('date') ?? addDays(jerusalemToday(), -1),
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

function App() {
  const initial = useMemo(getInitialFilters, [])
  const [filters, setFilters] = useState<SearchFilters>(initial)
  const [timetable, setTimetable] = useState<TimetableStop[]>([])
  const [timetableLoading, setTimetableLoading] = useState(false)
  const [timetableMessage, setTimetableMessage] = useState<string | null>(null)
  const [locations, setLocations] = useState<VehicleLocation[]>([])
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isDelayed, setIsDelayed] = useState(false)
  const [selectedStopId, setSelectedStopId] = useState<number | null>(null)
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

    fetchTimetable(
      getRoute(filters.line, filters.direction).lineRef,
      serviceDayWindow(filters.date),
      controller.signal,
    )
      .then((rows) => {
        setTimetable(rows)
        if (rows.length === 0) {
          setTimetableMessage(
            'לוח הזמנים ליום הזה אינו זמין עדיין או שאין בו נסיעות. אפשר להקליד שעה ידנית.',
          )
        }
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        const detail = caught instanceof Error ? ` ${caught.message}` : ''
        setTimetableMessage(
          `לא ניתן לטעון שעות מתוכננות. אפשר להקליד ידנית.${detail}`,
        )
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

  const departureTimes = useMemo(
    () =>
      [
        ...new Set(
          timetable.flatMap((stop) =>
            stop.lineStartTime ? [localTimeValue(stop.lineStartTime)] : [],
          ),
        ),
      ].sort(),
    [timetable],
  )
  const rides = useMemo(() => rideOptionsFor(locations), [locations])
  const activeRideId =
    filters.rideId && rides.some((ride) => ride.id === filters.rideId)
      ? filters.rideId
      : rides[0]?.id ?? null
  const points = useMemo(
    () =>
      locations.filter((location) => location.siriRideId === activeRideId),
    [activeRideId, locations],
  )
  const stops = useMemo(
    () => selectStopsForDeparture(timetable, filters.departureTime),
    [filters.departureTime, timetable],
  )
  const passages = useMemo(
    () => estimateStopPassages(stops, points),
    [points, stops],
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
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ב
          </span>
          <div>
            <strong>מסע בזמן</strong>
            <span>מעקב נסיעות אוטובוס</span>
          </div>
        </div>
        <span className="data-badge">
          <i /> נתונים היסטוריים
        </span>
      </header>

      <main>
        <section className="hero-copy">
          <span className="eyebrow">קו 150 / 152</span>
          <h1>איפה האוטובוס היה — ומתי?</h1>
          <p>
            שחזור נסיעות בין באר שבע לירוחם לפי לוח הזמנים ונתוני GPS היסטוריים.
          </p>
        </section>

        <SearchPanel
          filters={filters}
          departureTimes={departureTimes}
          timetableLoading={timetableLoading}
          timetableMessage={timetableMessage}
          loading={status === 'loading'}
          onChange={handleFiltersChange}
          onSubmit={() => {
            writeUrl(filters, true)
            void loadTrip(filters)
          }}
        />

        {status === 'loading' && (
          <div className="state-banner loading-state" role="status">
            <span className="large-spinner" />
            <div>
              <strong>מאתרים את הנסיעה ומורידים את מסלול ה-GPS…</strong>
              <span>
                {isDelayed
                  ? 'השרת מתעכב. הבקשה עדיין פעילה ולא בוטלה.'
                  : 'הבקשה ממוקדת ביום ובשעת היציאה שנבחרו.'}
              </span>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="state-banner error-state" role="alert">
            <span aria-hidden="true">!</span>
            <div>
              <strong>לא הצלחנו לטעון את הנסיעה</strong>
              <p>{error}</p>
              <small>
                טווחים גדולים עלולים להחזיר שגיאת שרת. נסו שוב או בחרו יום ושעה
                אחרים.
              </small>
            </div>
          </div>
        )}

        {status === 'empty' && (
          <div className="empty-state">
            <span aria-hidden="true">⌁</span>
            <strong>לא נמצאו תצפיות GPS לנסיעה הזאת</strong>
            <p>
              ייתכן שהנסיעה לא בוצעה, טרם הועברה לארכיון, או ששעת ה-SIRI שונה
              מעט.
            </p>
          </div>
        )}

        {status === 'success' && (
          <>
            <section className="trip-title">
              <div>
                <span className="line-number">{route.line}</span>
                <div>
                  <span className="eyebrow">נסיעה שנבחרה</span>
                  <h2>
                    {route.origin} ← {route.destination}
                  </h2>
                </div>
              </div>
              <span className="point-count">{points.length} תצפיות GPS</span>
            </section>

            <RideSelector
              rides={rides}
              selectedRideId={activeRideId}
              onSelect={(rideId) =>
                setFilters((current) => ({ ...current, rideId }))
              }
            />
            <SummaryCards passages={passages} points={points} />
            <div className="results-grid">
              <TripMap
                points={points}
                passages={passages}
                selectedStopId={selectedStopId}
                onSelectStop={setSelectedStopId}
              />
              <StopsTable
                passages={passages}
                selectedStopId={selectedStopId}
                onSelectStop={setSelectedStopId}
              />
            </div>
          </>
        )}

        <details className="methodology">
          <summary>איך מחושב זמן המעבר בתחנה?</summary>
          <div>
            <p>
              לכל תחנה נבחרת תצפית ה-GPS הקרובה ביותר ברצף הנסיעה, עד מרחק של{' '}
              {STOP_MATCH_THRESHOLD_METERS} מטר. כל תצפית משויכת לכל היותר לתחנה
              אחת, וההתאמה מתקדמת רק קדימה לאורך המסלול.
            </p>
            <p>
              זהו אומדן בלבד: הדגימה היא בערך פעם בדקה ועלולים להיות חוסרים. המפה
              שוברת את הקו בפער של יותר מ-3 דקות או בקפיצה של יותר מ-3 ק״מ, ולא
              משלימה מידע שלא נצפה. כל הזמנים מוצגים לפי Asia/Jerusalem.
            </p>
          </div>
        </details>
      </main>

      <footer>
        <span>מקור: Open Bus Stride API · הסדנא לידע ציבורי</span>
        <span>מפות © OpenStreetMap contributors</span>
      </footer>
    </div>
  )
}

export default App
