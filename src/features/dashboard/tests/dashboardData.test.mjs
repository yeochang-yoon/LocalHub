import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { extractBusanDistrict } from '../../chatbot/utils/busanDistrict.js'

const expectedCounts = new Map([
  ['부산_관광지.json', 351],
  ['부산_레포츠.json', 65],
  ['부산_문화시설.json', 123],
  ['부산_쇼핑.json', 986],
  ['부산_숙박.json', 140],
  ['부산_여행코스.json', 21],
  ['부산_축제공연행사.json', 72],
])

test('부산 주소에서 표준 구·군을 추출한다', () => {
  assert.equal(extractBusanDistrict('부산광역시 해운대구 달맞이길 1'), '해운대구')
  assert.equal(extractBusanDistrict('부산 부산진구 중앙대로 1'), '부산진구')
  assert.equal(extractBusanDistrict('부산광역시 해운대구광역시 해변로 1'), '해운대구')
  assert.equal(extractBusanDistrict(''), null)
})

test('대시보드 원본 데이터 건수가 고정 기준과 일치한다', async () => {
  let total = 0
  for (const [filename, expected] of expectedCounts) {
    const path = fileURLToPath(new URL(`../../../../data/${filename}`, import.meta.url))
    const source = JSON.parse(await readFile(path, 'utf8'))
    assert.equal(source.items.length, expected, filename)
    total += source.items.length
  }
  assert.equal(total, 1758)
})
