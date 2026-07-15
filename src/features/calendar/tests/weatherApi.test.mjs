import assert from 'node:assert/strict'
import test from 'node:test'
import { getBusanHistoricalWeather, getWeatherPresentation } from '../services/api/weatherApi.js'

test('날씨 코드를 캘린더용 이모지와 설명으로 변환한다', () => {
  assert.deepEqual(getWeatherPresentation(0), { emoji: '☀️', label: '맑음' })
  assert.deepEqual(getWeatherPresentation(63), { emoji: '🌧️', label: '비' })
  assert.deepEqual(getWeatherPresentation(75), { emoji: '🌨️', label: '눈' })
  assert.deepEqual(getWeatherPresentation(95), { emoji: '⛈️', label: '뇌우' })
})

test('과거 날씨를 일별 캘린더 형식으로 변환한다', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    assert.match(String(url), /archive-api\.open-meteo\.com/)
    assert.match(String(url), /start_date=2025-07-01/)
    return {
      ok: true,
      json: async () => ({
        daily: {
          time: ['2025-07-01'],
          weather_code: [61],
          temperature_2m_max: [27.2],
          temperature_2m_min: [21.1],
          precipitation_sum: [4.5],
        },
      }),
    }
  }

  try {
    const [weather] = await getBusanHistoricalWeather({ startDate: '2025-07-01', endDate: '2025-07-31' })
    assert.equal(weather.historical, true)
    assert.equal(weather.emoji, '🌧️')
    assert.equal(weather.precipitationAmount, 4.5)
  } finally {
    globalThis.fetch = originalFetch
  }
})
