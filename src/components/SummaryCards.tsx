import type { StopPassage, VehicleLocation } from '../domain/types'
import { formatLocalDateTime } from '../utils/time'

interface SummaryCardsProps {
  passages: readonly StopPassage[]
  points: readonly VehicleLocation[]
}

function delayText(delay: number | null): string {
  if (delay === null) return 'אין נתון'
  if (delay === 0) return 'בזמן'
  return delay > 0 ? `${delay}+ דק׳` : `${Math.abs(delay)}− דק׳`
}

export function SummaryCards({ passages, points }: SummaryCardsProps) {
  const origin = passages[0]
  const destination = passages.at(-1)
  const firstPoint = points[0]
  const lastPoint = points.at(-1)
  const durationMinutes =
    firstPoint && lastPoint
      ? Math.max(
          0,
          Math.round(
            (new Date(lastPoint.recordedAtTime).getTime() -
              new Date(firstPoint.recordedAtTime).getTime()) /
              60_000,
          ),
        )
      : null
  const matchedStops = passages.filter((passage) => passage.point).length
  const coverage =
    passages.length > 0 ? Math.round((matchedStops / passages.length) * 100) : 0

  return (
    <section className="summary-grid" aria-label="סיכום נסיעה">
      <article>
        <span className="summary-icon delay">◷</span>
        <div>
          <span>איחור ביציאה</span>
          <strong>{delayText(origin?.delayMinutes ?? null)}</strong>
          <small>אומדן בתחנת המוצא</small>
        </div>
      </article>
      <article>
        <span className="summary-icon coverage">◒</span>
        <div>
          <span>משך וכיסוי</span>
          <strong>
            {durationMinutes === null ? 'אין נתון' : `${durationMinutes} דק׳`}
          </strong>
          <small>{coverage}% מהתחנות זוהו</small>
        </div>
      </article>
      <article>
        <span className="summary-icon location">⌖</span>
        <div>
          <span>תצפית אחרונה</span>
          <strong>
            {lastPoint ? formatLocalDateTime(lastPoint.recordedAtTime) : 'אין נתון'}
          </strong>
          <small dir="ltr">
            {lastPoint
              ? `${lastPoint.lat.toFixed(5)}, ${lastPoint.lon.toFixed(5)}`
              : '—'}
          </small>
        </div>
      </article>
      <article>
        <span className="summary-icon destination">✓</span>
        <div>
          <span>הגעה ליעד</span>
          <strong>{destination?.point ? 'זוהתה' : 'לא זוהתה'}</strong>
          <small>
            {destination?.point
              ? formatLocalDateTime(destination.point.recordedAtTime)
              : 'אין נקודת GPS קרובה'}
          </small>
        </div>
      </article>
    </section>
  )
}
