import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import type { StopPassage, VehicleLocation } from '../domain/types'
import { splitTraceSegments } from '../utils/geo'
import { formatLocalDateTime } from '../utils/time'

interface TripMapProps {
  points: readonly VehicleLocation[]
  passages: readonly StopPassage[]
  selectedStopId: number | null
  onSelectStop: (stopId: number) => void
}

function MapViewport({
  points,
  passages,
  selectedStopId,
}: Omit<TripMapProps, 'onSelectStop'>) {
  const map = useMap()

  useEffect(() => {
    const coordinates: L.LatLngExpression[] = points.map((point) => [
      point.lat,
      point.lon,
    ])
    if (coordinates.length === 0) {
      coordinates.push(
        ...passages.flatMap((passage) =>
          passage.stop.lat === null || passage.stop.lon === null
            ? []
            : ([[passage.stop.lat, passage.stop.lon]] as L.LatLngExpression[]),
        ),
      )
    }
    if (coordinates.length === 1) map.setView(coordinates[0], 15)
    if (coordinates.length > 1) {
      map.fitBounds(L.latLngBounds(coordinates), { padding: [32, 32] })
    }
  }, [map, passages, points])

  useEffect(() => {
    const passage = passages.find(
      (candidate) => candidate.stop.id === selectedStopId,
    )
    if (passage && passage.stop.lat !== null && passage.stop.lon !== null) {
      map.flyTo([passage.stop.lat, passage.stop.lon], Math.max(map.getZoom(), 15))
    }
  }, [map, passages, selectedStopId])

  return null
}

function stopIcon(index: number, selected: boolean, matched: boolean): L.DivIcon {
  return L.divIcon({
    className: 'stop-marker-wrapper',
    html: `<span class="stop-marker${selected ? ' selected' : ''}${matched ? ' matched' : ''}">${index + 1}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

function DetailRow({
  label,
  value,
  ltr = false,
}: {
  label: string
  value: string | number | null
  ltr?: boolean
}) {
  return (
    <div className="popup-row">
      <span>{label}</span>
      <strong dir={ltr ? 'ltr' : undefined}>{value ?? '—'}</strong>
    </div>
  )
}

export function TripMap({
  points,
  passages,
  selectedStopId,
  onSelectStop,
}: TripMapProps) {
  const segments = useMemo(() => splitTraceSegments(points), [points])

  return (
    <section className="map-card">
      <MapContainer
        center={[31.02, 34.91]}
        zoom={10}
        scrollWheelZoom
        className="trip-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapViewport
          points={points}
          passages={passages}
          selectedStopId={selectedStopId}
        />

        {segments
          .filter((segment) => segment.length > 1)
          .map((segment) => (
            <Polyline
              key={`${segment[0].id}-${segment.at(-1)?.id}`}
              positions={segment.map((point) => [point.lat, point.lon])}
              pathOptions={{ color: '#0891b2', weight: 6, opacity: 0.9 }}
            />
          ))}

        {points.map((point) => (
          <CircleMarker
            key={point.id}
            center={[point.lat, point.lon]}
            radius={4}
            pathOptions={{
              color: '#ffffff',
              fillColor: '#0891b2',
              fillOpacity: 0.9,
              weight: 1.5,
            }}
          >
            <Tooltip direction="top">
              {formatLocalDateTime(point.recordedAtTime)}
            </Tooltip>
            <Popup>
              <div className="map-popup" dir="rtl">
                <h3>נקודת GPS</h3>
                <DetailRow
                  label="זמן מקומי"
                  value={formatLocalDateTime(point.recordedAtTime)}
                />
                <DetailRow
                  label="קואורדינטות"
                  value={`${point.lat.toFixed(6)}, ${point.lon.toFixed(6)}`}
                  ltr
                />
                <DetailRow label="מהירות" value={point.velocity === null ? null : `${point.velocity} קמ״ש`} />
                <DetailRow label="כיוון" value={point.bearing === null ? null : `${point.bearing}°`} />
                <DetailRow label="מרחק מתחילת מסע" value={point.distanceFromJourneyStart === null ? null : `${point.distanceFromJourneyStart} מ׳`} />
                <DetailRow label="מרחק מתחנה מקושרת" value={point.distanceFromRideStopMeters === null ? null : `${point.distanceFromRideStopMeters} מ׳`} />
                <DetailRow label="לוחית רישוי" value={point.vehicleRef} ltr />
                <DetailRow label="SIRI ride ID" value={point.siriRideId} ltr />
                <DetailRow label="Location ID" value={point.id} ltr />
                <DetailRow label="Ride-stop ID" value={point.siriRideStopId} ltr />
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {passages.map((passage, index) =>
          passage.stop.lat === null || passage.stop.lon === null ? null : (
            <Marker
              key={`${passage.stop.id}-${index}`}
              position={[passage.stop.lat, passage.stop.lon]}
              icon={stopIcon(
                index,
                passage.stop.id === selectedStopId,
                passage.point !== null,
              )}
              eventHandlers={{
                click: () => onSelectStop(passage.stop.id),
              }}
            >
              <Tooltip direction="top">{passage.stop.name ?? 'תחנה'}</Tooltip>
              <Popup>
                <div className="map-popup" dir="rtl">
                  <h3>{passage.stop.name ?? 'תחנה ללא שם'}</h3>
                  <DetailRow label="מזהה תחנה" value={passage.stop.id} ltr />
                  <DetailRow
                    label="עיר"
                    value={passage.stop.city}
                  />
                  <DetailRow
                    label="מעבר מתוכנן"
                    value={formatLocalDateTime(passage.stop.plannedArrivalTime)}
                  />
                  <DetailRow
                    label="מעבר משוער"
                    value={
                      passage.point
                        ? formatLocalDateTime(passage.point.recordedAtTime)
                        : 'אין נתון'
                    }
                  />
                  <DetailRow
                    label="מרחק מנקודת GPS"
                    value={
                      passage.distanceMeters === null
                        ? null
                        : `${Math.round(passage.distanceMeters)} מ׳`
                    }
                  />
                </div>
              </Popup>
            </Marker>
          ),
        )}
      </MapContainer>
    </section>
  )
}
