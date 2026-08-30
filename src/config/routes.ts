import type { Direction, LineNumber, RouteConfig } from '../domain/types'

export const OPERATOR_REF = 15

export const ROUTES: readonly RouteConfig[] = [
  {
    lineRef: 26156,
    line: '150',
    direction: 'to-yeruham',
    origin: 'באר שבע',
    destination: 'ירוחם',
  },
  {
    lineRef: 26157,
    line: '150',
    direction: 'to-beersheva',
    origin: 'ירוחם',
    destination: 'באר שבע',
  },
  {
    lineRef: 26160,
    line: '152',
    direction: 'to-beersheva',
    origin: 'ירוחם',
    destination: 'באר שבע',
  },
  {
    lineRef: 26200,
    line: '152',
    direction: 'to-yeruham',
    origin: 'באר שבע',
    destination: 'ירוחם',
  },
] as const

export function getRoute(line: LineNumber, direction: Direction): RouteConfig {
  const route = ROUTES.find(
    (candidate) => candidate.line === line && candidate.direction === direction,
  )

  if (!route) {
    throw new Error(`Unknown route combination: ${line}/${direction}`)
  }

  return route
}

export function directionLabel(direction: Direction): string {
  return direction === 'to-yeruham'
    ? 'באר שבע ← ירוחם'
    : 'ירוחם ← באר שבע'
}
