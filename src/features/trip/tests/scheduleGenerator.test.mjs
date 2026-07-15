import assert from 'node:assert/strict'
import test from 'node:test'
import { generateTripSchedule, recalculateTripDays } from '../services/scheduleGenerator.js'

const places = Array.from({ length: 10 }, (_, index) => ({
  id: String(index + 1),
  title: `장소 ${index + 1}`,
  contentTypeId: index % 2 ? '14' : '12',
  contentTypeName: index % 2 ? '문화시설' : '관광지',
  district: index < 6 ? '해운대구' : '중구',
  latitude: 35.16 + index * 0.001,
  longitude: 129.16 + index * 0.001,
  image: index === 0 ? 'image.jpg' : '',
}))

test('여행 밀도에 따라 방문 장소 수가 달라진다', () => {
  const base = { startDate: '2026-07-20', endDate: '2026-07-20', startTime: '09:00', endTime: '18:00', purposes: ['sightseeing', 'culture'], district: '해운대구', transport: 'transit' }
  const relaxed = generateTripSchedule(places, { ...base, pace: 'relaxed' })
  const packed = generateTripSchedule(places, { ...base, pace: 'packed' })
  assert.ok(relaxed.totalPlaces > 0)
  assert.ok(packed.totalPlaces > relaxed.totalPlaces)
})

test('잘못된 시간 범위를 거부한다', () => {
  assert.throws(() => generateTripSchedule(places, { startDate: '2026-07-20', endDate: '2026-07-20', startTime: '18:00', endTime: '09:00' }), /종료 시간/)
})

test('장소 순서 변경 후 시간과 종료 초과 여부를 다시 계산한다', () => {
  const options = { startDate: '2026-07-20', endDate: '2026-07-20', startTime: '09:00', endTime: '11:00', purposes: ['sightseeing', 'culture'], district: '해운대구', transport: 'transit', pace: 'balanced' }
  const result = recalculateTripDays([{ date: '2026-07-20', district: '해운대구', items: places.slice(0, 2).reverse() }], options)
  assert.equal(result.totalPlaces, 2)
  assert.equal(result.days[0].items[0].arrivalTime, '09:00')
  assert.equal(result.days[0].items[1].exceedsEndTime, true)
})

test('출발지 이동시간과 필수 방문 장소를 일정에 반영한다', () => {
  const result = generateTripSchedule(places, {
    startDate: '2026-07-20',
    endDate: '2026-07-20',
    startTime: '09:00',
    endTime: '09:30',
    purposes: ['sightseeing'],
    pace: 'balanced',
    transport: 'transit',
    startPlaceId: '10',
    mustVisitIds: ['1'],
    dailyStartAtBase: true,
  })
  assert.equal(result.startPlace.id, '10')
  assert.equal(result.days[0].items[0].id, '1')
  assert.equal(result.days[0].items[0].isRequired, true)
  assert.equal(result.days[0].items[0].exceedsEndTime, true)
  assert.ok(result.days[0].items[0].travelMinutes > 0)
})
