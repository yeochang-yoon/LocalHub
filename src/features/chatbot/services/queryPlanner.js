export const CATEGORY_ALIASES = {
  관광지: ['관광지', '여행지', '명소', '볼거리', '가볼만한곳', '가볼 곳', '구경'],
  문화시설: ['문화시설', '전시', '공연장', '박물관', '미술관', '도서관', '문화'],
  축제공연행사: ['축제', '행사', '공연', '페스티벌'],
  여행코스: ['여행코스', '코스', '동선', '일정표', '하루 코스'],
  레포츠: ['레포츠', '액티비티', '체험', '레저', '해양 스포츠', '스포츠'],
  숙박: ['숙박', '숙소', '호텔', '펜션', '게스트하우스', '잘 곳'],
  쇼핑: ['쇼핑', '시장', '백화점', '쇼핑몰', '상점'],
}

export const REGION_ALIASES = {
  강서구: ['강서구', '명지', '가덕도'],
  금정구: ['금정구', '금정산', '부산대'],
  기장군: ['기장군', '기장', '정관'],
  남구: ['남구', '대연동', '용호동'],
  동구: ['동구', '부산역', '초량'],
  동래구: ['동래구', '동래', '온천장'],
  부산진구: ['부산진구', '부산진', '서면', '전포'],
  북구: ['북구', '화명', '덕천'],
  사상구: ['사상구', '사상'],
  사하구: ['사하구', '다대포', '하단'],
  서구: ['서구', '송도', '암남동'],
  수영구: ['수영구', '광안리', '광안', '민락'],
  연제구: ['연제구', '연산동', '시청'],
  영도구: ['영도구', '영도', '태종대'],
  중구: ['중구', '남포동', '자갈치', '광복동'],
  해운대구: ['해운대구', '해운대', '센텀', '송정'],
}

const STOP_WORDS = new Set([
  '부산', '근처', '주변', '가까운', '추천', '추천해줘', '알려줘', '찾아줘', '보여줘', '있어', '있는', '어디', '어디가',
  '같이', '그리고', '에서', '으로', '만한', '곳', '개', '곳을', '좀', '도', '거기', '여기', '첫번째', '두번째',
  '게시글', '게시판', '커뮤니티', '글', '후기', '모두', '전체',
])

export function normalizeText(value) {
  return String(value ?? '').toLowerCase().replace(/[\s\-_/()[\]{}.,·|?'"!]+/g, '')
}

export function tokenize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token) && !/^\d+(곳|개|군데)$/.test(token))
}

function includesAlias(query, alias) {
  return normalizeText(query).includes(normalizeText(alias))
}

export function analyzeQuery(question, previousPlan = null) {
  let categories = Object.entries(CATEGORY_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => includesAlias(question, alias)))
    .map(([category]) => category)

  const district = Object.entries(REGION_ALIASES)
    .find(([, aliases]) => aliases.some((alias) => includesAlias(question, alias)))?.[0] || null

  const nearby = ['근처', '주변', '가까운', '인근'].some((word) => question.includes(word))
  const community = ['게시글', '게시판', '커뮤니티', '후기'].some((word) => question.includes(word))
  const recommendation = ['추천', '가볼', '어디가 좋아'].some((word) => question.includes(word))
  const followUp = ['거기', '그곳', '주변', '근처', '첫 번째', '첫번째'].some((word) => question.includes(word))
  const requestedLimit = Number(question.match(/(\d+)\s*(?:곳|개|군데)/)?.[1] || 0)

  if (!categories.length && recommendation) categories = ['관광지']

  return {
    intent: community ? 'community' : nearby ? 'nearby' : recommendation ? 'recommend' : 'search',
    categories: categories.length ? categories : followUp ? previousPlan?.categories || [] : [],
    district: district || (followUp ? previousPlan?.district || null : null),
    nearby,
    community,
    limit: Math.min(Math.max(requestedLimit || 4, 1), 8),
    tokens: tokenize(question),
    question,
  }
}

export function extractDistrict(address) {
  const normalized = String(address || '')
  return Object.keys(REGION_ALIASES).find((district) => normalized.includes(district)) || null
}

export function distanceKm(left, right) {
  if (![left?.lat, left?.lng, right?.lat, right?.lng].every(Number.isFinite)) return null
  const radians = (degree) => (degree * Math.PI) / 180
  const earthRadiusKm = 6371
  const latDistance = radians(right.lat - left.lat)
  const lngDistance = radians(right.lng - left.lng)
  const value =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(radians(left.lat)) * Math.cos(radians(right.lat)) * Math.sin(lngDistance / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}
