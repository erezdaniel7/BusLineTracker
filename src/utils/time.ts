const JERUSALEM_TIME_ZONE = 'Asia/Jerusalem'

const localPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: JERUSALEM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

const displayTimeFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: JERUSALEM_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

const displayDateTimeFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: JERUSALEM_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

interface LocalDateTimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function partsAt(date: Date): LocalDateTimeParts {
  const parts = localPartsFormatter.formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type)
    return Number(part?.value ?? 0)
  }

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  }
}

function parseLocalDateTime(date: string, time: string): LocalDateTimeParts {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute, second = 0] = time.split(':').map(Number)
  if (
    !year ||
    !month ||
    !day ||
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second)
  ) {
    throw new Error('Invalid local date or time')
  }
  return { year, month, day, hour, minute, second }
}

export function jerusalemLocalToDate(date: string, time = '00:00:00'): Date {
  const target = parseLocalDateTime(date, time)
  const targetAsUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
  )
  let candidate = targetAsUtc

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = partsAt(new Date(candidate))
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    )
    candidate += targetAsUtc - observedAsUtc
  }

  const result = new Date(candidate)
  const observed = partsAt(result)
  if (
    observed.year !== target.year ||
    observed.month !== target.month ||
    observed.day !== target.day ||
    observed.hour !== target.hour ||
    observed.minute !== target.minute
  ) {
    throw new Error('The selected Jerusalem time does not exist')
  }
  return result
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day + days))
  return value.toISOString().slice(0, 10)
}

export function serviceDayWindow(date: string): {
  from: string
  to: string
} {
  return {
    from: jerusalemLocalToDate(date).toISOString(),
    to: jerusalemLocalToDate(addDays(date, 1)).toISOString(),
  }
}

export function scheduledStartWindow(
  date: string,
  time: string,
  paddingMinutes = 8,
): { from: string; to: string } {
  const start = jerusalemLocalToDate(date, `${time}:00`).getTime()
  return {
    from: new Date(start - paddingMinutes * 60_000).toISOString(),
    to: new Date(start + paddingMinutes * 60_000).toISOString(),
  }
}

export function scheduledComparisonWindow(
  date: string,
  time: string,
  beforeMinutes = 8,
  afterMinutes = 60,
): { from: string; to: string } {
  const start = jerusalemLocalToDate(date, `${time}:00`).getTime()
  return {
    from: new Date(start - beforeMinutes * 60_000).toISOString(),
    to: new Date(start + afterMinutes * 60_000).toISOString(),
  }
}

export function scheduledFollowingWindow(
  date: string,
  time: string,
  fromMinutes = 2,
  toMinutes = 60,
): { from: string; to: string } {
  const start = jerusalemLocalToDate(date, `${time}:00`).getTime()
  return {
    from: new Date(start + fromMinutes * 60_000).toISOString(),
    to: new Date(start + toMinutes * 60_000).toISOString(),
  }
}

export function formatLocalTime(timestamp: string | null): string {
  if (!timestamp) return '—'
  return displayTimeFormatter.format(new Date(timestamp))
}

export function formatLocalDateTime(timestamp: string | null): string {
  if (!timestamp) return '—'
  return displayDateTimeFormatter.format(new Date(timestamp))
}

export function localTimeValue(timestamp: string): string {
  const parts = partsAt(new Date(timestamp))
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

export function jerusalemToday(): string {
  const parts = partsAt(new Date())
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}
