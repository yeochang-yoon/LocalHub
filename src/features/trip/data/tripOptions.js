export const TRIP_PACES = Object.freeze([
  { id: 'relaxed', name: '여유로운', description: '한 장소를 충분히 즐겨요', durationMultiplier: 1.3, bufferRate: 0.3 },
  { id: 'balanced', name: '적당한', description: '관람과 이동의 균형을 맞춰요', durationMultiplier: 1, bufferRate: 0.15 },
  { id: 'packed', name: '최대한 많이', description: '짧고 알차게 여러 곳을 둘러봐요', durationMultiplier: 0.7, bufferRate: 0.05 },
])

export const TRIP_PURPOSES = Object.freeze([
  { id: 'sightseeing', name: '관광', contentTypeIds: ['12', '15', '25'] },
  { id: 'culture', name: '문화', contentTypeIds: ['14', '15'] },
  { id: 'activity', name: '액티비티', contentTypeIds: ['28'] },
  { id: 'rest', name: '휴식', contentTypeIds: ['32'] },
  { id: 'shopping', name: '쇼핑', contentTypeIds: ['38'] },
])

export const VISIT_DURATION_MINUTES = Object.freeze({
  '12': 70,
  '14': 90,
  '15': 120,
  '25': 150,
  '28': 120,
  '32': 45,
  '38': 60,
})

export const TRANSPORT_OPTIONS = Object.freeze([
  { id: 'transit', name: '대중교통', speedKmPerHour: 18 },
  { id: 'car', name: '자동차', speedKmPerHour: 30 },
  { id: 'walking', name: '도보', speedKmPerHour: 4 },
])
