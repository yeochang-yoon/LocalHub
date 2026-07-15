import { distanceKm } from '../../chatbot/services/queryPlanner.js'
import {
  TRANSPORT_OPTIONS,
  TRIP_PACES,
  TRIP_PURPOSES,
  VISIT_DURATION_MINUTES,
} from '../data/tripOptions.js'

function parseTime(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/)
  if (!match) return null
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes >= 0 && minutes < 1440 ? minutes : null
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateKeys(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return []

  const dates = []
  for (const date = new Date(start); date <= end && dates.length < 14; date.setDate(date.getDate() + 1)) {
    dates.push(toDateKey(date))
  }
  return dates
}

function coordinate(place) {
  return { lat: Number(place.latitude), lng: Number(place.longitude) }
}

export function estimateTravelMinutes(from, to, transport) {
  if (!from) return 0
  const distance = distanceKm(coordinate(from), coordinate(to)) || 0
  const roadDistance = distance * 1.3
  return Math.max(5, Math.ceil((roadDistance / transport.speedKmPerHour) * 60))
}

function chooseDistrict(candidates) {
  const counts = new Map()
  for (const place of candidates) {
    const district = place.district || '지역 미분류'
    counts.set(district, (counts.get(district) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))[0]?.[0] || ''
}

function chooseNextPlace(current, candidates, previousType) {
  return [...candidates].sort((left, right) => {
    const leftDistance = current ? distanceKm(coordinate(current), coordinate(left)) || 0 : 0
    const rightDistance = current ? distanceKm(coordinate(current), coordinate(right)) || 0 : 0
    const leftPenalty = left.contentTypeId === previousType ? 8 : 0
    const rightPenalty = right.contentTypeId === previousType ? 8 : 0
    const leftImageBonus = left.image ? -2 : 0
    const rightImageBonus = right.image ? -2 : 0
    return (leftDistance + leftPenalty + leftImageBonus) - (rightDistance + rightPenalty + rightImageBonus)
      || left.title.localeCompare(right.title, 'ko')
  })[0]
}

export function formatMinutes(totalMinutes) {
  const normalized = Math.max(0, Math.round(totalMinutes))
  const hours = String(Math.floor(normalized / 60) % 24).padStart(2, '0')
  const minutes = String(normalized % 60).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function generateTripSchedule(places, options) {
  const dates = getDateKeys(options.startDate, options.endDate)
  const startMinutes = parseTime(options.startTime)
  const endMinutes = parseTime(options.endTime)
  if (!dates.length) throw new Error('여행 날짜를 올바르게 선택해 주세요.')
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    throw new Error('종료 시간은 시작 시간보다 늦어야 합니다.')
  }

  const pace = TRIP_PACES.find((item) => item.id === options.pace) || TRIP_PACES[1]
  const transport = TRANSPORT_OPTIONS.find((item) => item.id === options.transport) || TRANSPORT_OPTIONS[0]
  const selectedPurposes = TRIP_PURPOSES.filter((item) => options.purposes?.includes(item.id))
  const selectedTypeIds = new Set(selectedPurposes.flatMap((item) => item.contentTypeIds))
  const mustVisitIds = new Set((options.mustVisitIds || []).map(String))
  const startPlace = places.find((place) => String(place.id) === String(options.startPlaceId)) || null

  const filteredPlaces = places
    .filter((place) => !selectedTypeIds.size || selectedTypeIds.has(String(place.contentTypeId)))
    .filter((place) => !options.district || place.district === options.district)
    .filter((place) => Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude)))
  const mustVisitPlaces = places.filter((place) => mustVisitIds.has(String(place.id)))
  let remaining = [...new Map([...mustVisitPlaces, ...filteredPlaces].map((place) => [String(place.id), place])).values()]
    .filter((place) => !startPlace || String(place.id) !== String(startPlace.id) || mustVisitIds.has(String(place.id)))
  let remainingMustVisits = mustVisitPlaces.filter((place) => remaining.some((item) => String(item.id) === String(place.id)))

  const days = []
  for (const [dayIndex, date] of dates.entries()) {
    if (!remaining.length) break
    const remainingDayCount = dates.length - dayIndex
    const requiredCount = Math.ceil(remainingMustVisits.length / remainingDayCount)
    const requiredForDay = remainingMustVisits.slice(0, requiredCount)
    const district = options.district || requiredForDay[0]?.district || chooseDistrict(remaining)
    let dayCandidates = [...new Map([
      ...requiredForDay,
      ...remaining.filter((place) => (place.district || '지역 미분류') === district),
    ].map((place) => [String(place.id), place])).values()]
    let currentTime = startMinutes
    let currentPlace = startPlace && (dayIndex === 0 || options.dailyStartAtBase) ? startPlace : null
    let previousType = null
    const items = []

    while (dayCandidates.length) {
      const pendingRequired = dayCandidates.filter((place) => requiredForDay.some((required) => String(required.id) === String(place.id)))
      const next = chooseNextPlace(currentPlace, pendingRequired.length ? pendingRequired : dayCandidates, previousType)
      const isRequired = mustVisitIds.has(String(next.id))
      const travelMinutes = estimateTravelMinutes(currentPlace, next, transport)
      const baseDuration = VISIT_DURATION_MINUTES[String(next.contentTypeId)] || 60
      const visitMinutes = Math.max(30, Math.round(baseDuration * pace.durationMultiplier / 5) * 5)
      const bufferMinutes = Math.ceil(travelMinutes * pace.bufferRate)
      const arrivalMinutes = currentTime + travelMinutes + bufferMinutes
      const departureMinutes = arrivalMinutes + visitMinutes
      if (departureMinutes > endMinutes && !isRequired) break

      items.push({
        ...next,
        arrivalTime: formatMinutes(arrivalMinutes),
        departureTime: formatMinutes(departureMinutes),
        travelMinutes,
        visitMinutes,
        isRequired,
        exceedsEndTime: departureMinutes > endMinutes,
      })
      currentTime = departureMinutes
      currentPlace = next
      previousType = next.contentTypeId
      dayCandidates = dayCandidates.filter((place) => String(place.id) !== String(next.id))
      remaining = remaining.filter((place) => String(place.id) !== String(next.id))
      remainingMustVisits = remainingMustVisits.filter((place) => String(place.id) !== String(next.id))
    }

    if (items.length) {
      days.push({ date, district, items, totalMinutes: currentTime - startMinutes })
    } else {
      remaining = remaining.filter((place) => (place.district || '지역 미분류') !== district)
    }
  }

  return {
    days,
    pace: pace.name,
    transport: transport.name,
    startPlace,
    unplacedMustVisits: remainingMustVisits,
    totalPlaces: days.reduce((sum, day) => sum + day.items.length, 0),
  }
}

export function recalculateTripDays(days, options) {
  const startMinutes = parseTime(options.startTime)
  const endMinutes = parseTime(options.endTime)
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    throw new Error('종료 시간은 시작 시간보다 늦어야 합니다.')
  }

  const pace = TRIP_PACES.find((item) => item.id === options.pace) || TRIP_PACES[1]
  const transport = TRANSPORT_OPTIONS.find((item) => item.id === options.transport) || TRANSPORT_OPTIONS[0]
  const recalculatedDays = days
    .map((day, dayIndex) => {
      let currentTime = startMinutes
      let currentPlace = options.startPlace && (dayIndex === 0 || options.dailyStartAtBase) ? options.startPlace : null
      const items = day.items.map((place) => {
        const travelMinutes = estimateTravelMinutes(currentPlace, place, transport)
        const baseDuration = VISIT_DURATION_MINUTES[String(place.contentTypeId)] || 60
        const visitMinutes = Math.max(30, Math.round(baseDuration * pace.durationMultiplier / 5) * 5)
        const bufferMinutes = Math.ceil(travelMinutes * pace.bufferRate)
        const arrivalMinutes = currentTime + travelMinutes + bufferMinutes
        const departureMinutes = arrivalMinutes + visitMinutes
        currentTime = departureMinutes
        currentPlace = place
        return {
          ...place,
          arrivalTime: formatMinutes(arrivalMinutes),
          departureTime: formatMinutes(departureMinutes),
          travelMinutes,
          visitMinutes,
          exceedsEndTime: departureMinutes > endMinutes,
        }
      })
      return { ...day, items, totalMinutes: currentTime - startMinutes }
    })
    .filter((day) => day.items.length)

  return {
    days: recalculatedDays,
    pace: pace.name,
    transport: transport.name,
    startPlace: options.startPlace || null,
    unplacedMustVisits: [],
    totalPlaces: recalculatedDays.reduce((sum, day) => sum + day.items.length, 0),
  }
}
