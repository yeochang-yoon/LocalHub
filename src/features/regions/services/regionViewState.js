const STORAGE_KEY = 'localhub:region-view-state'

const defaultState = {
  query: '',
  selectedCategory: '관광지',
  selectedId: '',
  mapCenter: null,
  mapZoom: null,
}

function normalizeState(value = {}) {
  const lat = value.mapCenter?.lat == null ? Number.NaN : Number(value.mapCenter.lat)
  const lng = value.mapCenter?.lng == null ? Number.NaN : Number(value.mapCenter.lng)
  const zoom = value.mapZoom == null ? Number.NaN : Number(value.mapZoom)

  return {
    query: typeof value.query === 'string' ? value.query : defaultState.query,
    selectedCategory:
      typeof value.selectedCategory === 'string' && value.selectedCategory
        ? value.selectedCategory
        : defaultState.selectedCategory,
    selectedId: typeof value.selectedId === 'string' ? value.selectedId : defaultState.selectedId,
    mapCenter: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    mapZoom: Number.isFinite(zoom) ? zoom : null,
  }
}

export function loadRegionViewState() {
  if (typeof window === 'undefined') return { ...defaultState }
  try {
    return normalizeState(JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '{}'))
  } catch {
    return { ...defaultState }
  }
}

export function saveRegionViewState(state) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)))
  } catch {
    // sessionStorage가 차단되어도 화면 동작은 유지한다.
  }
}
