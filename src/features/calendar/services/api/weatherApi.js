const BUSAN_COORDINATES = {
  latitude: 35.1796,
  longitude: 129.0756,
}

const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast'
const HISTORICAL_WEATHER_API_URL = 'https://archive-api.open-meteo.com/v1/archive'

export function getWeatherPresentation(code) {
  const weatherCode = Number(code)

  if (weatherCode === 0) return { emoji: '☀️', label: '맑음' }
  if ([1, 2].includes(weatherCode)) return { emoji: '🌤️', label: '대체로 맑음' }
  if (weatherCode === 3) return { emoji: '☁️', label: '흐림' }
  if ([45, 48].includes(weatherCode)) return { emoji: '🌫️', label: '안개' }
  if (weatherCode >= 51 && weatherCode <= 57) return { emoji: '🌦️', label: '이슬비' }
  if (weatherCode >= 61 && weatherCode <= 67) return { emoji: '🌧️', label: '비' }
  if (weatherCode >= 71 && weatherCode <= 77) return { emoji: '🌨️', label: '눈' }
  if (weatherCode >= 80 && weatherCode <= 82) return { emoji: '🌦️', label: '소나기' }
  if (weatherCode >= 85 && weatherCode <= 86) return { emoji: '🌨️', label: '눈 소나기' }
  if (weatherCode >= 95) return { emoji: '⛈️', label: '뇌우' }

  return { emoji: '🌡️', label: '날씨 정보' }
}

function normalizeDailyWeather(daily, { historical = false } = {}) {
  const dates = Array.isArray(daily?.time) ? daily.time : []

  return dates.map((dateKey, index) => ({
    dateKey,
    weatherCode: Number(daily.weather_code?.[index]),
    temperatureMax: Number(daily.temperature_2m_max?.[index]),
    temperatureMin: Number(daily.temperature_2m_min?.[index]),
    precipitationProbability: Number(daily.precipitation_probability_max?.[index]),
    precipitationAmount: Number(daily.precipitation_sum?.[index]),
    historical,
    ...getWeatherPresentation(daily.weather_code?.[index]),
  }))
}

export async function getBusanWeather({ signal } = {}) {
  const url = new URL(WEATHER_API_URL)
  url.search = new URLSearchParams({
    latitude: String(BUSAN_COORDINATES.latitude),
    longitude: String(BUSAN_COORDINATES.longitude),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'Asia/Seoul',
    past_days: '14',
    forecast_days: '15',
  }).toString()

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`날씨 API 응답 오류 (${response.status})`)

  const data = await response.json()
  return normalizeDailyWeather(data.daily)
}

export async function getBusanHistoricalWeather({ startDate, endDate, signal } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error('과거 날씨 조회 날짜가 올바르지 않습니다.')
  }

  const url = new URL(HISTORICAL_WEATHER_API_URL)
  url.search = new URLSearchParams({
    latitude: String(BUSAN_COORDINATES.latitude),
    longitude: String(BUSAN_COORDINATES.longitude),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'Asia/Seoul',
    start_date: startDate,
    end_date: endDate,
  }).toString()

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`과거 날씨 API 응답 오류 (${response.status})`)

  const data = await response.json()
  return normalizeDailyWeather(data.daily, { historical: true })
}
