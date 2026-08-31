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
  if (rides.length === 0 || (rides.length === 1 && rides[0].relation === 'target')) {
    return null
  }

  const relationLabel = (ride: RideOption): string => {
    if (ride.relation === 'target') return 'נסיעת היעד'
    if (ride.relation === 'following') {
      return `נסיעה עוקבת · +${ride.scheduleDeltaMinutes} דק׳`
    }
    return `נסיעה סמוכה · ${ride.scheduleDeltaMinutes} דק׳`
  }

  return (
    <section className="ride-selector" aria-labelledby="ride-selector-title">
      <div>
        <span className="eyebrow">זהויות SIRI נפרדות</span>
        <h2 id="ride-selector-title">בחרו נסיעה להצגה</h2>
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
            <span className={`ride-relation ${ride.relation}`}>
              {relationLabel(ride)}
            </span>
            <span dir="ltr">SIRI #{ride.id}</span>
            <small>
              לוחית רישוי {ride.vehicleRef ?? 'לא ידועה'} · {ride.pointCount} נקודות
            </small>
          </button>
        ))}
      </div>
    </section>
  )
}
