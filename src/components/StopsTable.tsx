import type { StopPassage } from '../domain/types'
import { formatLocalTime } from '../utils/time'

interface StopsTableProps {
  passages: readonly StopPassage[]
  selectedStopId: number | null
  onSelectStop: (stopId: number) => void
  compact?: boolean
}

const confidenceLabels = {
  high: 'ביטחון גבוה',
  medium: 'ביטחון בינוני',
  low: 'ביטחון נמוך',
} as const

function delayClass(delay: number | null): string {
  if (delay === null) return ''
  if (delay >= 6) return 'delay-late'
  if (delay >= 2) return 'delay-medium'
  return 'delay-good'
}

function delayText(delay: number | null): string {
  if (delay === null) return '—'
  if (delay === 0) return 'בזמן'
  return delay > 0 ? `+${delay} דק׳` : `${delay} דק׳`
}

export function StopsTable({
  passages,
  selectedStopId,
  onSelectStop,
  compact = false,
}: StopsTableProps) {
  return (
    <section className="card table-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">תכנון מול ביצוע</span>
          <h2>תחנות הנסיעה</h2>
        </div>
        <span className="result-count">{passages.length} תחנות</span>
      </div>

      {passages.length === 0 ? (
        <div className="empty-state compact">
          <strong>לא נמצא לוח תחנות ליציאה שנבחרה</strong>
          <span>נתוני ה-GPS עדיין מוצגים במפה, אם נמצאו.</span>
        </div>
      ) : compact ? (
        <div className="compact-stop-list">
          {passages.map((passage, index) => (
            <button
              type="button"
              key={`${passage.stop.id}-${index}`}
              className={passage.stop.id === selectedStopId ? 'selected' : ''}
              onClick={() => onSelectStop(passage.stop.id)}
            >
              <span className="compact-stop-number">{index + 1}</span>
              <span className="compact-stop-name">
                <strong>{passage.stop.name ?? 'תחנה ללא שם'}</strong>
                <small>{passage.stop.city ?? `מזהה ${passage.stop.id}`}</small>
              </span>
              <span className="compact-stop-times">
                <small>מתוכנן</small>
                <strong dir="ltr">{formatLocalTime(passage.stop.plannedArrivalTime)}</strong>
                <span className={`delay-pill ${delayClass(passage.delayMinutes)}`}>
                  {delayText(passage.delayMinutes)}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>תחנה</th>
                <th>מתוכנן</th>
                <th>מעבר משוער</th>
                <th>איחור</th>
                <th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {passages.map((passage, index) => (
                <tr
                  key={`${passage.stop.id}-${index}`}
                  className={
                    passage.stop.id === selectedStopId ? 'selected-row' : ''
                  }
                  onClick={() => onSelectStop(passage.stop.id)}
                >
                  <td>{index + 1}</td>
                  <td>
                    <strong>{passage.stop.name ?? 'תחנה ללא שם'}</strong>
                    <small>
                      {passage.stop.city ? `${passage.stop.city} · ` : ''}
                      מזהה <span dir="ltr">{passage.stop.id}</span>
                    </small>
                  </td>
                  <td dir="ltr">
                    {formatLocalTime(passage.stop.plannedArrivalTime)}
                  </td>
                  <td dir="ltr">
                    {passage.point
                      ? formatLocalTime(passage.point.recordedAtTime)
                      : 'אין נתון'}
                  </td>
                  <td>
                    <span className={`delay-pill ${delayClass(passage.delayMinutes)}`}>
                      {delayText(passage.delayMinutes)}
                    </span>
                  </td>
                  <td>
                    {passage.confidence ? (
                      <span className={`confidence ${passage.confidence}`}>
                        {confidenceLabels[passage.confidence]}
                        <small>
                          {Math.round(passage.distanceMeters ?? 0)} מ׳
                        </small>
                      </span>
                    ) : (
                      <span className="no-data">אין נתון</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
