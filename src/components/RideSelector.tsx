import type { RideOption } from '../domain/types'
import { formatLocalTime } from '../utils/time'

interface RideSelectorProps {
  rides: readonly RideOption[]
  selectedRideId: number | null
  onSelect: (rideId: number) => void
}

export function RideSelector({
  rides,
  selectedRideId,
  onSelect,
}: RideSelectorProps) {
  if (rides.length <= 1) return null

  return (
    <section className="ride-selector" aria-labelledby="ride-selector-title">
      <div>
        <span className="eyebrow">נמצאו כמה נסיעות SIRI</span>
        <h2 id="ride-selector-title">בחרו את הרכב המתאים</h2>
      </div>
      <div className="ride-options">
        {rides.map((ride) => (
          <button
            type="button"
            className={ride.id === selectedRideId ? 'selected' : ''}
            onClick={() => onSelect(ride.id)}
            key={ride.id}
          >
            <strong>{formatLocalTime(ride.scheduledStartTime)}</strong>
            <span dir="ltr">SIRI #{ride.id}</span>
            <small>
              רכב {ride.vehicleRef ?? 'לא ידוע'} · {ride.pointCount} נקודות
            </small>
          </button>
        ))}
      </div>
    </section>
  )
}
