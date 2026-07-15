import { PLACE_CATEGORIES } from '../data/boardOptions.js'

const placeCache = new Map()

function normalizeString(value) {
  return String(value ?? '').trim()
}

function toBoardPlace(item, category) {
  const addr1 = normalizeString(item?.addr1)
  const addr2 = normalizeString(item?.addr2)

  return {
    contentId: normalizeString(item?.contentid),
    category,
    name: normalizeString(item?.title),
    address: [addr1, addr2].filter(Boolean).join(' '),
  }
}

async function loadBoardPlaces(category) {
  const option = PLACE_CATEGORIES.find((item) => item.value === category)
  if (!option) return []

  if (!placeCache.has(category)) {
    const loadPromise = option
      .load()
      .then((module) => {
        const source = module.default ?? module
        const items = Array.isArray(source?.items) ? source.items : []
        return items.map((item) => toBoardPlace(item, option.value))
      })
      .catch((error) => {
        placeCache.delete(category)
        throw error
      })

    placeCache.set(category, loadPromise)
  }

  return placeCache.get(category)
}

export async function searchBoardPlaces(category, query = '') {
  const places = await loadBoardPlaces(category)
  const term = normalizeString(query).toLowerCase()

  if (!term) return places.slice(0, 30)

  return places
    .filter((place) => place.name.toLowerCase().includes(term))
    .slice(0, 50)
}
