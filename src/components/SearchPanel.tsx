import { directionLabel } from '../config/routes'
import type {
  Direction,
  LineNumber,
  SearchFilters,
} from '../domain/types'

interface SearchPanelProps {
  filters: SearchFilters
  departureTimes: readonly string[]
  timetableLoading: boolean
  timetableMessage: string | null
  loading: boolean
  onChange: (filters: SearchFilters) => void
  onSubmit: () => void
}

export function SearchPanel({
  filters,
  departureTimes,
  timetableLoading,
  timetableMessage,
  loading,
  onChange,
  onSubmit,
}: SearchPanelProps) {
  const update = <Key extends keyof SearchFilters>(
    key: Key,
    value: SearchFilters[Key],
  ) => onChange({ ...filters, [key]: value, rideId: null })

  return (
    <form
      className="search-panel"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="search-heading">
        <div className="search-icon" aria-hidden="true">
          ↗
        </div>
        <div>
          <h2>איתור נסיעה היסטורית</h2>
          <p>בחרו שירות מתוכנן כדי לצפות בביצוע בפועל</p>
        </div>
      </div>

      <div className="filter-grid">
        <label>
          <span>תאריך שירות</span>
          <input
            type="date"
            value={filters.date}
            onChange={(event) => update('date', event.target.value)}
            required
          />
        </label>

        <label>
          <span>קו</span>
          <select
            value={filters.line}
            onChange={(event) =>
              update('line', event.target.value as LineNumber)
            }
          >
            <option value="150">150</option>
            <option value="152">152</option>
          </select>
        </label>

        <label>
          <span>כיוון</span>
          <select
            value={filters.direction}
            onChange={(event) =>
              update('direction', event.target.value as Direction)
            }
          >
            <option value="to-yeruham">
              {directionLabel('to-yeruham')}
            </option>
            <option value="to-beersheva">
              {directionLabel('to-beersheva')}
            </option>
          </select>
        </label>

        <label>
          <span>שעת יציאה מתוכננת</span>
          <input
            type="time"
            list="departure-options"
            value={filters.departureTime}
            onChange={(event) => update('departureTime', event.target.value)}
            required
          />
          <datalist id="departure-options">
            {departureTimes.map((time) => (
              <option value={time} key={time} />
            ))}
          </datalist>
        </label>

        <button
          className="primary-button"
          type="submit"
          disabled={loading || !filters.departureTime}
        >
          {loading ? <span className="spinner" aria-hidden="true" /> : '⌕'}
          {loading ? 'טוען נתוני נסיעה…' : 'הצג נסיעה'}
        </button>
      </div>

      <div className="timetable-hint" aria-live="polite">
        {timetableLoading
          ? 'טוען שעות יציאה מתוכננות…'
          : timetableMessage ??
            (departureTimes.length > 0
              ? `נמצאו ${departureTimes.length} שעות יציאה. אפשר לבחור מהרשימה או להקליד ידנית.`
              : 'אפשר להקליד שעה ידנית.')}
      </div>
    </form>
  )
}
