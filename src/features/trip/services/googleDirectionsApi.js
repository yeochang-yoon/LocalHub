let googleMapsLoader = null

function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('브라우저에서만 Google Maps를 사용할 수 있습니다.'))
  if (window.google?.maps?.DirectionsService) return Promise.resolve(window.google.maps)
  if (googleMapsLoader) return googleMapsLoader

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) return Promise.reject(new Error('Google Maps API 키가 설정되지 않았습니다.'))

  googleMapsLoader = new Promise((resolve, reject) => {
    const callbackName = `localhubGoogleMapsReady_${Date.now()}`
    const script = document.createElement('script')
    const url = new URL('https://maps.googleapis.com/maps/api/js')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('v', 'weekly')
    url.searchParams.set('language', 'ko')
    url.searchParams.set('region', 'KR')
    url.searchParams.set('callback', callbackName)
    url.searchParams.set('loading', 'async')

    window[callbackName] = () => {
      delete window[callbackName]
      resolve(window.google.maps)
    }
    script.src = url.toString()
    script.async = true
    script.onerror = () => {
      delete window[callbackName]
      googleMapsLoader = null
      reject(new Error('Google Maps JavaScript API를 불러오지 못했습니다.'))
    }
    document.head.appendChild(script)
  })
  return googleMapsLoader
}

export function decodeGooglePolyline(encoded) {
  const coordinates = []
  let index = 0
  let latitude = 0
  let longitude = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    latitude += result & 1 ? ~(result >> 1) : result >> 1

    result = 0
    shift = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    longitude += result & 1 ? ~(result >> 1) : result >> 1
    coordinates.push([latitude / 1e5, longitude / 1e5])
  }
  return coordinates
}

export async function getGoogleDirections(origin, destination, transport, { signal } = {}) {
  if (signal?.aborted) throw new DOMException('요청이 취소되었습니다.', 'AbortError')
  const maps = await loadGoogleMaps()
  const mode = transport === 'car'
    ? maps.TravelMode.DRIVING
    : transport === 'walking'
      ? maps.TravelMode.WALKING
      : maps.TravelMode.TRANSIT

  const response = await new Promise((resolve, reject) => {
    const service = new maps.DirectionsService()
    const abortHandler = () => reject(new DOMException('요청이 취소되었습니다.', 'AbortError'))
    signal?.addEventListener('abort', abortHandler, { once: true })
    service.route({
      origin: { lat: Number(origin.latitude), lng: Number(origin.longitude) },
      destination: { lat: Number(destination.latitude), lng: Number(destination.longitude) },
      travelMode: mode,
      region: 'KR',
    }, (result, status) => {
      signal?.removeEventListener('abort', abortHandler)
      if (status === maps.DirectionsStatus.OK && result) resolve(result)
      else reject(new Error(`Google 길찾기 실패: ${status}`))
    })
  })
  const route = response.routes[0]
  const leg = route.legs[0]
  return {
    distanceMeters: Number(leg.distance?.value || 0),
    durationMinutes: Math.max(1, Math.ceil(Number(leg.duration?.value || 0) / 60)),
    coordinates: route.overview_path.map((point) => [point.lat(), point.lng()]),
  }
}
