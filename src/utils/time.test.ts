import { describe, expect, it } from 'vitest'
import {
  jerusalemLocalToDate,
  localTimeValue,
  scheduledComparisonWindow,
  scheduledFollowingWindow,
  scheduledStartWindow,
  serviceDayWindow,
} from './time'

describe('Jerusalem time conversion', () => {
  it('uses the winter UTC offset', () => {
    expect(jerusalemLocalToDate('2025-01-15', '08:30:00').toISOString()).toBe(
      '2025-01-15T06:30:00.000Z',
    )
  })

  it('uses the daylight-saving UTC offset', () => {
    expect(jerusalemLocalToDate('2025-07-15', '08:30:00').toISOString()).toBe(
      '2025-07-15T05:30:00.000Z',
    )
  })

  it('builds service-day boundaries using each boundary offset', () => {
    expect(serviceDayWindow('2025-07-15')).toEqual({
      from: '2025-07-14T21:00:00.000Z',
      to: '2025-07-15T21:00:00.000Z',
    })
  })

  it('builds a narrow scheduled-start window', () => {
    expect(scheduledStartWindow('2025-01-15', '08:30')).toEqual({
      from: '2025-01-15T06:22:00.000Z',
      to: '2025-01-15T06:38:00.000Z',
    })
  })

  it('builds a separate window for following scheduled trips', () => {
    expect(scheduledComparisonWindow('2025-01-15', '08:30')).toEqual({
      from: '2025-01-15T06:22:00.000Z',
      to: '2025-01-15T07:30:00.000Z',
    })
  })

  it('excludes the target from the following-trip window', () => {
    expect(scheduledFollowingWindow('2025-01-15', '08:30')).toEqual({
      from: '2025-01-15T06:32:00.000Z',
      to: '2025-01-15T07:30:00.000Z',
    })
  })

  it('formats API UTC timestamps as local clock values', () => {
    expect(localTimeValue('2025-07-15T05:30:00Z')).toBe('08:30')
  })
})
