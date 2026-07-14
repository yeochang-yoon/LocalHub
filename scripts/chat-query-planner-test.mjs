import assert from 'node:assert/strict'
import { analyzeQuery, distanceKm, extractDistrict, tokenize } from '../src/features/chatbot/services/queryPlanner.js'

assert.deepEqual(tokenize('해운대 근처 관광지 3곳 추천해줘'), ['해운대', '관광지'])

const nearbyPlan = analyzeQuery('해운대 해수욕장 근처 숙소 3곳 알려줘')
assert.equal(nearbyPlan.intent, 'nearby')
assert.deepEqual(nearbyPlan.categories, ['숙박'])
assert.equal(nearbyPlan.district, '해운대구')
assert.equal(nearbyPlan.limit, 3)

const followUpPlan = analyzeQuery('거기 주변 쇼핑할 곳도 있어?', nearbyPlan)
assert.equal(followUpPlan.intent, 'nearby')
assert.deepEqual(followUpPlan.categories, ['쇼핑'])
assert.equal(followUpPlan.district, '해운대구')

assert.equal(extractDistrict('부산광역시 수영구 광안해변로 219'), '수영구')
assert.ok(distanceKm({ lat: 35.1587, lng: 129.1604 }, { lat: 35.1532, lng: 129.1187 }) > 3)

console.log('Chat query planner test passed')
