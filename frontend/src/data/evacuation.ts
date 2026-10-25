import type { EvacuationCenter, EvacuationCenterStatus, EvacuationCenterWithDistance } from '../types/api'

// Shared display rules for evacuation centers. These mirror backend/resources/evacuation.py.

export const EVACUATION_STATUS_LABELS: Record<EvacuationCenterStatus, string> = {
  available: 'Available',
  full: 'Full',
  closed: 'Closed',
  maintenance: 'Under Maintenance',
}

export const EVACUATION_STATUS_BADGE_CLASSES: Record<EvacuationCenterStatus, string> = {
  available: 'bg-emerald-100 text-emerald-800',
  full: 'bg-amber-100 text-amber-800',
  maintenance: 'bg-orange-100 text-orange-800',
  closed: 'bg-rose-100 text-rose-800',
}

export const EVACUATION_STATUS_OPTIONS: EvacuationCenterStatus[] = ['available', 'full', 'maintenance', 'closed']

export const NEARBY_CENTER_COUNT = 5

const MANUAL_STATUSES: EvacuationCenterStatus[] = ['closed', 'maintenance']

/** Same rule as the backend: when capacity is set, Available/Full follow the numbers. */
export function resolveEvacuationStatus(
  capacity: number,
  currentOccupancy: number,
  requestedStatus: EvacuationCenterStatus,
): EvacuationCenterStatus {
  if (MANUAL_STATUSES.includes(requestedStatus)) return requestedStatus
  if (capacity > 0) return currentOccupancy >= capacity ? 'full' : 'available'
  return requestedStatus
}

export function isAcceptingEvacuees(center: Pick<EvacuationCenter, 'status' | 'is_accepting_evacuees'>): boolean {
  return center.is_accepting_evacuees ?? center.status === 'available'
}

export type OccupancySummary = {
  /** e.g. "45 / 120 occupied" or "Capacity not set" */
  label: string
  /** e.g. "75 spaces left"; null when capacity is not set */
  slotsLabel: string | null
  /** 0-100, or null when capacity is not set */
  percent: number | null
  barClass: string
}

export function describeOccupancy(
  center: Pick<EvacuationCenter, 'capacity' | 'current_occupancy'> & Partial<Pick<EvacuationCenter, 'status'>>,
): OccupancySummary {
  const capacity = Number(center.capacity) || 0
  const occupancy = Number(center.current_occupancy) || 0
  const closedForNow = center.status !== undefined && MANUAL_STATUSES.includes(center.status)

  // Closed / Under Maintenance: show the numbers, but never advertise free spaces.
  if (closedForNow) {
    return {
      label: capacity > 0 ? `${occupancy} / ${capacity} occupied` : occupancy > 0 ? `${occupancy} evacuees` : 'Capacity not set',
      slotsLabel: 'Not accepting evacuees',
      percent: capacity > 0 ? Math.min(100, Math.round((occupancy / capacity) * 100)) : null,
      barClass: 'bg-slate-400',
    }
  }

  if (capacity <= 0) {
    return {
      label: occupancy > 0 ? `${occupancy} evacuees · capacity not set` : 'Capacity not set',
      slotsLabel: null,
      percent: null,
      barClass: 'bg-slate-300',
    }
  }

  const percent = Math.min(100, Math.round((occupancy / capacity) * 100))
  const slots = Math.max(capacity - occupancy, 0)

  return {
    label: `${occupancy} / ${capacity} occupied`,
    slotsLabel: slots === 0 ? 'No spaces left' : `${slots} space${slots === 1 ? '' : 's'} left`,
    percent,
    barClass: percent >= 100 ? 'bg-rose-500' : percent >= 80 ? 'bg-amber-500' : 'bg-emerald-500',
  }
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return earthRadiusKm * 2 * Math.asin(Math.sqrt(a))
}

/**
 * Same result as the backend /nearby/ endpoint, worked out in the browser.
 * Used when the endpoint cannot be reached, so users still get recommendations.
 */
export function rankNearbyCenters(
  centers: EvacuationCenter[],
  latitude: number,
  longitude: number,
  limit = NEARBY_CENTER_COUNT,
): { results: EvacuationCenterWithDistance[]; notAcceptingNearby: EvacuationCenterWithDistance[] } {
  const ranked = centers
    .map((center) => ({
      ...center,
      distance_km: Math.round(distanceKm(latitude, longitude, center.latitude, center.longitude) * 100) / 100,
    }))
    .sort((a, b) => a.distance_km - b.distance_km)

  const accepting = ranked.filter((center) => isAcceptingEvacuees(center))
  const others = ranked.filter((center) => !isAcceptingEvacuees(center))

  let results = accepting.slice(0, limit)
  if (results.length < limit) {
    results = [...results, ...others.slice(0, limit - results.length)].sort(
      (a, b) => Number(!isAcceptingEvacuees(a)) - Number(!isAcceptingEvacuees(b)) || a.distance_km - b.distance_km,
    )
  }

  const chosen = new Set(results.map((center) => center.id))
  const farthest = results.reduce((max, center) => Math.max(max, center.distance_km), 0)
  const notAcceptingNearby = others.filter((center) => !chosen.has(center.id) && center.distance_km <= farthest)

  return { results, notAcceptingNearby }
}