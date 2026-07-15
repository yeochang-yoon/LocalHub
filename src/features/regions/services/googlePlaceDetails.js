import { loadGoogleMaps } from '@/features/trip/services/googleDirectionsApi.js'

const PHOTO_CACHE_TTL = 30 * 60 * 1000
const PHOTO_CACHE_LIMIT = 60
const placeCache = new Map()

function getPhotoCacheKey({ title, latitude, longitude }, limit) {
  return [normalizeName(title), Number(latitude).toFixed(5), Number(longitude).toFixed(5), limit].join(':')
}

function trimPhotoCache() {
  while (placeCache.size > PHOTO_CACHE_LIMIT) {
    placeCache.delete(placeCache.keys().next().value)
  }
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

function isLikelySamePlace(place, title) {
  const expected = normalizeName(title)
  const actual = normalizeName(place.displayName)
  return Boolean(expected && actual && (expected.includes(actual) || actual.includes(expected)))
}

export async function getGooglePlacePhotos({ title, latitude, longitude }, limit = 8) {
  const details = await getGooglePlaceDetails({ title, latitude, longitude }, limit)
  return details?.photos || []
}

export async function getGooglePlaceDetails({ title, latitude, longitude }, limit = 8) {
  const place = { title, latitude, longitude }
  const cacheKey = getPhotoCacheKey(place, limit)
  const cached = placeCache.get(cacheKey)
  if (cached && Date.now() - cached.createdAt < PHOTO_CACHE_TTL) {
    placeCache.delete(cacheKey)
    placeCache.set(cacheKey, cached)
    return cached.promise
  }
  if (cached) placeCache.delete(cacheKey)

  const promise = (async () => {
    const maps = await loadGoogleMaps()
    const placesLibrary = await maps.importLibrary('places')
    try {
      return await getNewPlacesPhotos(placesLibrary.Place, place, limit)
    } catch {
      return getLegacyPlacesPhotos(maps, place, limit)
    }
  })().catch((error) => {
    placeCache.delete(cacheKey)
    throw error
  })

  placeCache.set(cacheKey, { createdAt: Date.now(), promise })
  trimPhotoCache()
  return promise
}

async function getNewPlacesPhotos(Place, { title, latitude, longitude }, limit) {
  const request = {
    textQuery: `${title} 부산`,
    fields: ['id', 'displayName', 'location', 'formattedAddress', 'photos'],
    language: 'ko',
    region: 'KR',
    maxResultCount: 5,
  }
  const lat = Number(latitude)
  const lng = Number(longitude)
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    request.locationBias = { center: { lat, lng }, radius: 1500 }
  }

  const { places = [] } = await Place.searchByText(request)
  const matched = places.find((place) => isLikelySamePlace(place, title))
  if (!matched) return null
  await matched.fetchFields({
    fields: [
      'photos',
      'rating',
      'userRatingCount',
      'businessStatus',
      'nationalPhoneNumber',
      'websiteURI',
      'googleMapsURI',
      'regularOpeningHours',
    ],
  })

  return {
    placeId: matched.id,
    rating: matched.rating ?? null,
    userRatingCount: matched.userRatingCount ?? 0,
    businessStatus: matched.businessStatus || '',
    phoneNumber: matched.nationalPhoneNumber || '',
    websiteURI: matched.websiteURI || '',
    googleMapsURI: matched.googleMapsURI || '',
    openingHours: matched.regularOpeningHours?.weekdayDescriptions || [],
    photos: (matched.photos || []).slice(0, limit).map((photo, index) => ({
      id: `google-${matched.id}-${index}`,
      url: photo.getURI({ maxWidth: 1800, maxHeight: 1000 }),
      alt: `${title} 사진 ${index + 1}`,
      source: 'Google Places',
      attributions: (photo.authorAttributions || []).map((item) => item.displayName).filter(Boolean),
    })),
  }
}

function getLegacyPlacesPhotos(maps, { title, latitude, longitude }, limit) {
  return new Promise((resolve, reject) => {
    if (!maps.places?.PlacesService) {
      reject(new Error('Google Places 서비스를 사용할 수 없습니다.'))
      return
    }
    const service = new maps.places.PlacesService(document.createElement('div'))
    const request = { query: `${title} 부산` }
    const lat = Number(latitude)
    const lng = Number(longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      request.location = new maps.LatLng(lat, lng)
      request.radius = 1500
    }
    service.textSearch(request, (results, status) => {
      if (status !== maps.places.PlacesServiceStatus.OK || !results?.length) {
        reject(new Error(`Google Places 검색 실패: ${status}`))
        return
      }
      const matched = results.find((place) => isLikelySamePlace({ displayName: place.name }, title))
      if (!matched) {
        resolve(null)
        return
      }
      service.getDetails({
        placeId: matched.place_id,
        fields: ['name', 'photos', 'rating', 'user_ratings_total', 'business_status', 'formatted_phone_number', 'website', 'url', 'opening_hours'],
      }, (details, detailStatus) => {
        const photos = detailStatus === maps.places.PlacesServiceStatus.OK
          ? details?.photos || []
          : matched.photos || []
        resolve({
          placeId: matched.place_id,
          rating: details?.rating ?? matched.rating ?? null,
          userRatingCount: details?.user_ratings_total ?? matched.user_ratings_total ?? 0,
          businessStatus: details?.business_status || matched.business_status || '',
          phoneNumber: details?.formatted_phone_number || '',
          websiteURI: details?.website || '',
          googleMapsURI: details?.url || '',
          openingHours: details?.opening_hours?.weekday_text || [],
          photos: photos.slice(0, limit).map((photo, index) => ({
            id: `google-legacy-${matched.place_id}-${index}`,
            url: photo.getUrl({ maxWidth: 1800, maxHeight: 1000 }),
            alt: `${title} 사진 ${index + 1}`,
            source: 'Google Places',
            attributions: [],
          })),
        })
      })
    })
  })
}
