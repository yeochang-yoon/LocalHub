import touristData from '../../../../data/부산_관광지.json'
import cultureData from '../../../../data/부산_문화시설.json'
import festivalData from '../../../../data/부산_축제공연행사.json'
import courseData from '../../../../data/부산_여행코스.json'
import leisureData from '../../../../data/부산_레포츠.json'
import stayData from '../../../../data/부산_숙박.json'
import shoppingData from '../../../../data/부산_쇼핑.json'
import { loadPosts } from '../../board/services/boardStorage'
import { extractOpenAIText } from './openaiResponse'
import { analyzeQuery, CATEGORY_ALIASES, distanceKm, extractDistrict, normalizeText } from './queryPlanner'

const DATASETS = [
  { name: '관광지', data: touristData.items },
  { name: '문화시설', data: cultureData.items },
  { name: '축제공연행사', data: festivalData.items },
  { name: '여행코스', data: courseData.items },
  { name: '레포츠', data: leisureData.items },
  { name: '숙박', data: stayData.items },
  { name: '쇼핑', data: shoppingData.items },
]

const RESTAURANT_KEYWORDS = ['음식점', '맛집', '식당', '모범음식점', '식사']
const PLACE_INDEX = DATASETS.flatMap((dataset) =>
  dataset.data.map((item) => ({
    id: item.contentid,
    type: dataset.name,
    title: item.title,
    address: [item.addr1, item.addr2].filter(Boolean).join(' ').trim(),
    district: extractDistrict(item.addr1),
    tel: item.tel || '',
    image: item.firstimage || '',
    lat: Number.parseFloat(item.mapy),
    lng: Number.parseFloat(item.mapx),
    categories: [item.cat1, item.cat2, item.cat3].filter(Boolean),
  })),
)

function findAnchor(question, previousResults = []) {
  const normalizedQuestion = normalizeText(question)
  const direct = PLACE_INDEX
    .filter((place) => normalizeText(place.title).length >= 3 && normalizedQuestion.includes(normalizeText(place.title)))
    .sort((left, right) => right.title.length - left.title.length)[0]
  if (direct) return direct
  if (['거기', '그곳', '주변', '근처', '첫 번째', '첫번째'].some((word) => question.includes(word))) {
    return previousResults[0] || null
  }
  return null
}

function scorePlace(plan, place, anchor) {
  const title = normalizeText(place.title)
  const address = normalizeText(place.address)
  let score = 0
  for (const token of plan.tokens) {
    const normalizedToken = normalizeText(token)
    if (title === normalizedToken) score += 100
    else if (title.includes(normalizedToken)) score += 45
    if (address.includes(normalizedToken)) score += 25
  }
  if (plan.categories.includes(place.type)) score += 40
  if (plan.district && place.district === plan.district) score += 50
  if (place.image) score += 2
  if (anchor?.id === place.id) score = -1
  return score
}

function searchPlaces(plan, previousResults = []) {
  const mentionedPlace = findAnchor(plan.question, previousResults)
  const anchor = plan.nearby ? mentionedPlace : null
  const categoryFilter = plan.categories.length ? plan.categories : null
  const districtFilter = plan.district && !anchor ? plan.district : null

  const ranked = PLACE_INDEX
    .filter((place) => !categoryFilter || categoryFilter.includes(place.type))
    .filter((place) => !districtFilter || place.district === districtFilter)
    .map((place) => ({
      ...place,
      score: scorePlace(plan, place, anchor),
      distanceKm: anchor ? distanceKm(anchor, place) : null,
    }))
    .filter((place) => place.score > 0 || Boolean(districtFilter) || Boolean(anchor) || Boolean(categoryFilter))
    .sort((left, right) => {
      if (anchor && left.distanceKm !== null && right.distanceKm !== null) return left.distanceKm - right.distanceKm
      return right.score - left.score || left.title.localeCompare(right.title, 'ko')
    })

  const selected = []
  if (plan.categories.length > 1) {
    for (const category of plan.categories) {
      const match = ranked.find((place) => place.type === category && !selected.includes(place))
      if (match) selected.push(match)
    }
  }
  for (const place of ranked) {
    if (selected.length >= plan.limit) break
    if (!selected.includes(place)) selected.push(place)
  }
  return { anchor, results: selected.slice(0, plan.limit) }
}

function searchPosts(plan) {
  const posts = loadPosts()
  return posts
    .map((post) => {
      const searchable = normalizeText(`${post.title} ${post.content} ${post.author}`)
      const score = plan.tokens.reduce((total, token) => total + (searchable.includes(normalizeText(token)) ? 10 : 0), 0)

      return { post, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, plan.limit)
    .map(({ post }) => ({ title: post.title, author: post.author, createdAt: post.createdAt, content: post.content }))
}

function buildSearchContext(question, previousQuestion = '', previousResults = []) {
  const previousPlan = previousQuestion ? analyzeQuery(previousQuestion) : null
  const plan = analyzeQuery(question, previousPlan)
  const { anchor, results } = searchPlaces(plan, previousResults)
  const posts = plan.community ? searchPosts(plan) : []
  const limitations = []

  if (RESTAURANT_KEYWORDS.some((keyword) => question.includes(keyword))) limitations.push('음식점 원본 JSON이 현재 프로젝트에 없습니다.')
  if (question.includes('일정') || question.includes('언제') || question.includes('지금')) limitations.push('축제 개최 시작일과 종료일 필드가 없습니다.')
  if (['가격', '요금', '영업시간', '주차', '평점', '인기'].some((keyword) => question.includes(keyword))) limitations.push('가격, 영업시간, 주차, 평점, 인기도 정보가 없습니다.')
  if (plan.intent === 'recommend') limitations.push('평점 데이터가 없어 추천은 질문 일치도와 위치를 기준으로 합니다.')
  if (!results.length && !posts.length) limitations.push('질문과 일치하는 프로젝트 데이터를 찾지 못했습니다.')

  return {
    plan: { intent: plan.intent, categories: plan.categories, district: plan.district, limit: plan.limit },
    anchor: anchor ? { title: anchor.title, type: anchor.type, address: anchor.address } : null,
    places: results.map(({ score, lat, lng, categories, ...place }) => ({
      ...place,
      distanceKm: place.distanceKm === null ? null : Number(place.distanceKm.toFixed(1)),
    })),
    posts,
    limitations,
    source: '한국관광공사 TourAPI 4.0 · 공공누리 제3유형',
    _results: results,
  }
}

export async function askOpenAI(messages) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) throw new Error('VITE_OPENAI_API_KEY가 설정되지 않았습니다.')

  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
  const userMessages = messages.filter((message) => message.role === 'user')
  const previousQuestion = userMessages.at(-2)?.content || ''
  const previousContext = previousQuestion ? buildSearchContext(previousQuestion) : null
  const context = buildSearchContext(lastUserMessage?.content || '', previousQuestion, previousContext?._results || [])
  const { _results, ...publicContext } = context

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-5-mini',
      instructions: [
        '당신은 부산 지역 정보를 안내하는 한국어 챗봇입니다.',
        '반드시 제공된 검색 결과와 커뮤니티 게시글 컨텍스트에 근거해서만 답하세요.',
        '추측은 금지하고, 데이터에 없는 내용은 없다고 명확히 말하세요.',
        '장소를 안내할 때 장소명, 유형, 주소를 포함하고 distanceKm가 있으면 거리도 표시하세요.',
        'limitations에 적힌 한계는 필요한 경우 사용자에게 분명히 안내하세요.',
        '검색 결과가 없으면 임의의 장소를 만들지 말고 지역명이나 유형을 구체적으로 물어보세요.',
        '답변은 간결하게 작성하고, 여러 장소는 읽기 쉬운 항목으로 정리하세요.',
        '',
        '[검색 컨텍스트 JSON]',
        JSON.stringify(publicContext),
      ].join('\n'),
      input: messages.map(({ role, content }) => ({ role, content })),
    }),
  })

  if (!response.ok) {
    let detail = ''
    try {
      const errorData = await response.json()
      detail = errorData?.error?.message || ''
    } catch {
      // 오류 응답이 JSON이 아니면 상태 코드만 안내합니다.
    }
    throw new Error(detail || `AI 응답을 불러오지 못했습니다. (${response.status})`)
  }
  const data = await response.json()
  return extractOpenAIText(data) || '응답 내용이 없습니다.'
}
