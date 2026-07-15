import { queryDatabase } from '@/features/chatbot/services/chatbotDatabase'

export const DASHBOARD_CONTENT_TYPES = [
  { id: '12', name: '관광지' },
  { id: '14', name: '문화시설' },
  { id: '15', name: '축제공연행사' },
  { id: '25', name: '여행코스' },
  { id: '28', name: '레포츠' },
  { id: '32', name: '숙박' },
  { id: '38', name: '쇼핑' },
]

export const TRAVEL_PURPOSES = [
  { id: 'sightseeing', name: '관광', contentTypeIds: ['12', '15', '25'] },
  { id: 'culture', name: '문화', contentTypeIds: ['14', '15'] },
  { id: 'activity', name: '액티비티', contentTypeIds: ['28'] },
  { id: 'rest', name: '휴식', contentTypeIds: ['32'] },
  { id: 'shopping', name: '쇼핑', contentTypeIds: ['38'] },
]

function normalizeFilters(filters = {}) {
  const purposes = Array.isArray(filters.purposes) ? filters.purposes : []
  const selectedPurposes = TRAVEL_PURPOSES.filter((purpose) => purposes.includes(purpose.id))
  const typeIds = [...new Set(selectedPurposes.flatMap((purpose) => purpose.contentTypeIds))]

  return {
    purposes,
    typeIds,
    district: String(filters.district || '').trim(),
    keyword: String(filters.keyword || '').trim(),
  }
}

function buildWhere(filters = {}, { requireDistrict = false } = {}) {
  const normalized = normalizeFilters(filters)
  const conditions = []
  const params = []

  if (normalized.typeIds.length) {
    conditions.push(`p.content_type_id IN (${normalized.typeIds.map(() => '?').join(', ')})`)
    params.push(...normalized.typeIds)
  }
  if (normalized.district) {
    conditions.push('p.district_name = ?')
    params.push(normalized.district)
  }
  if (normalized.keyword) {
    conditions.push('(p.title LIKE ? OR COALESCE(a.address1, \'\') LIKE ?)')
    const keyword = `%${normalized.keyword}%`
    params.push(keyword, keyword)
  }
  if (requireDistrict) conditions.push("p.district_name IS NOT NULL AND TRIM(p.district_name) != ''")

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    normalized,
  }
}

export function getDashboardSummary(filters = {}) {
  const { where, params } = buildWhere(filters)
  const [totals] = queryDatabase(`
    SELECT
      COUNT(*) AS totalPlaces,
      COUNT(DISTINCT content_type_id) AS totalContentTypes,
      COUNT(DISTINCT district_name) AS totalDistricts
    FROM places
  `)
  const [filtered] = queryDatabase(`
    SELECT COUNT(DISTINCT p.id) AS filteredPlaces
    FROM places p
    LEFT JOIN place_addresses a ON a.place_id = p.id
    ${where}
  `, params)

  return { ...totals, ...filtered }
}

export function getContentTypeDistribution(filters = {}) {
  const { where, params } = buildWhere(filters)
  return queryDatabase(`
    SELECT ct.id, ct.name, COUNT(DISTINCT p.id) AS count
    FROM content_types ct
    LEFT JOIN places p ON p.content_type_id = ct.id
    LEFT JOIN place_addresses a ON a.place_id = p.id
    ${where}
    GROUP BY ct.id, ct.name
    ORDER BY count DESC, ct.name
  `, params)
}

export function getDistrictDistribution(filters = {}) {
  const { where, params } = buildWhere(filters, { requireDistrict: true })
  return queryDatabase(`
    SELECT p.district_name AS district, COUNT(DISTINCT p.id) AS count
    FROM places p
    LEFT JOIN place_addresses a ON a.place_id = p.id
    ${where}
    GROUP BY p.district_name
    ORDER BY count DESC, district
  `, params)
}

export function getDashboardPlaces(filters = {}) {
  const { where, params } = buildWhere(filters)
  return queryDatabase(`
    SELECT
      p.id,
      p.title,
      p.content_type_id AS contentTypeId,
      ct.name AS contentTypeName,
      COALESCE(p.district_name, '') AS district,
      co.latitude,
      co.longitude,
      TRIM(COALESCE(a.address1, '') || ' ' || COALESCE(a.address2, '')) AS address,
      COALESCE(i.url, '') AS image
    FROM places p
    JOIN content_types ct ON ct.id = p.content_type_id
    LEFT JOIN place_addresses a ON a.place_id = p.id
    LEFT JOIN place_coordinates co ON co.place_id = p.id
    LEFT JOIN place_images i ON i.place_id = p.id AND i.kind = 'thumbnail'
    ${where}
    ORDER BY p.title
  `, params)
}

export function getDistrictRecommendations(filters = {}) {
  const normalized = normalizeFilters(filters)
  const scoringTypeIds = normalized.typeIds.length
    ? normalized.typeIds
    : DASHBOARD_CONTENT_TYPES.map((type) => type.id)
  const recommendationFilters = { ...filters, district: '' }
  const { where, params } = buildWhere(recommendationFilters, { requireDistrict: true })
  const counts = queryDatabase(`
    SELECT p.district_name AS district, p.content_type_id AS contentTypeId, COUNT(*) AS count
    FROM places p
    LEFT JOIN place_addresses a ON a.place_id = p.id
    ${where}
    GROUP BY p.district_name, p.content_type_id
  `, params)
  const maxByType = new Map()
  for (const row of counts) {
    maxByType.set(row.contentTypeId, Math.max(maxByType.get(row.contentTypeId) || 0, Number(row.count)))
  }

  const districtMap = new Map()
  for (const row of counts) {
    if (!districtMap.has(row.district)) districtMap.set(row.district, new Map())
    districtMap.get(row.district).set(row.contentTypeId, Number(row.count))
  }

  const allPlaces = getDashboardPlaces(recommendationFilters)
  const recommendations = [...districtMap.entries()].map(([district, typeCounts]) => {
    const coverage = scoringTypeIds.filter((typeId) => (typeCounts.get(typeId) || 0) > 0).length
    const normalizedScore = scoringTypeIds.reduce((sum, typeId) => {
      const maximum = maxByType.get(typeId) || 1
      return sum + (typeCounts.get(typeId) || 0) / maximum
    }, 0) / scoringTypeIds.length
    const districtPlaces = allPlaces.filter((place) => place.district === district)

    return {
      district,
      matchRate: Math.round(normalizedScore * 100),
      coverage,
      totalCount: [...typeCounts.values()].reduce((sum, count) => sum + count, 0),
      touristCount: typeCounts.get('12') || 0,
      counts: scoringTypeIds.map((contentTypeId) => ({
        contentTypeId,
        name: DASHBOARD_CONTENT_TYPES.find((type) => type.id === contentTypeId)?.name || contentTypeId,
        count: typeCounts.get(contentTypeId) || 0,
      })),
      representativePlaces: districtPlaces.slice(0, 3),
    }
  })

  return recommendations
    .sort((a, b) => b.matchRate - a.matchRate || b.coverage - a.coverage || b.touristCount - a.touristCount || b.totalCount - a.totalCount)
    .slice(0, 3)
}
