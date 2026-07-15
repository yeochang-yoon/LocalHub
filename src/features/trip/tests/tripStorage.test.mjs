import assert from 'node:assert/strict'
import test from 'node:test'

let storedValue = null
globalThis.localStorage = {
  getItem: () => storedValue,
  setItem: (_key, value) => { storedValue = value },
}

const { deleteSavedTrip, loadSavedTrips, saveTrip } = await import('../services/tripStorage.js')

test('여행 일정을 저장하고 다시 삭제한다', () => {
  const trip = saveTrip({
    name: '여름 부산 여행',
    options: { startDate: '2026-07-20', endDate: '2026-07-21' },
    result: { days: [], totalPlaces: 0 },
  })
  assert.equal(loadSavedTrips()[0].name, '여름 부산 여행')
  deleteSavedTrip(trip.id)
  assert.deepEqual(loadSavedTrips(), [])
})
