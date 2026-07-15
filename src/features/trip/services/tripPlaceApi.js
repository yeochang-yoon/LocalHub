import { getDashboardPlaces } from '@/features/dashboard/services/api/dashboardApi'

export function getTripPlaces() {
  return getDashboardPlaces()
    .map((place) => ({
      ...place,
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
    }))
    .filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
}
