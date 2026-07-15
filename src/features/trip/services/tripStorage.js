const STORAGE_KEY = 'localhub-saved-trips'
const MAX_SAVED_TRIPS = 12

function readTrips() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeTrips(trips) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips.slice(0, MAX_SAVED_TRIPS)))
}

export function loadSavedTrips() {
  return readTrips()
}

export function saveTrip({ name, options, result }) {
  const savedAt = new Date().toISOString()
  const trip = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(name || '').trim() || `${options.startDate} 부산 여행`,
    savedAt,
    options: JSON.parse(JSON.stringify(options)),
    result: JSON.parse(JSON.stringify(result)),
  }
  writeTrips([trip, ...readTrips()])
  return trip
}

export function deleteSavedTrip(id) {
  writeTrips(readTrips().filter((trip) => String(trip.id) !== String(id)))
}
