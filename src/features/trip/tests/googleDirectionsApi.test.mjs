import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeGooglePolyline } from '../services/googleDirectionsApi.js'

test('Google 인코딩 폴리라인을 지도 좌표로 변환한다', () => {
  assert.deepEqual(decodeGooglePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [
    [38.5, -120.2],
    [40.7, -120.95],
    [43.252, -126.453],
  ])
})
