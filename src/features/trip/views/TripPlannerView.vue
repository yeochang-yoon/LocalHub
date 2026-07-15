<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { getTripPlaces } from '../services/tripPlaceApi.js'
import { formatMinutes, generateTripSchedule, recalculateTripDays } from '../services/scheduleGenerator.js'
import { deleteSavedTrip, loadSavedTrips, saveTrip } from '../services/tripStorage.js'
import { getGoogleDirections } from '../services/googleDirectionsApi.js'
import { TRANSPORT_OPTIONS, TRIP_PACES, TRIP_PURPOSES } from '../data/tripOptions.js'

const places = ref([])
const result = ref(null)
const errorMessage = ref('')
const savedTrips = ref([])
const saveName = ref('')
const saveFeedback = ref('')
const editingItemKey = ref('')
const addSelections = reactive({})
const startPlaceQuery = ref('')
const mustVisitQuery = ref('')
const directionsNotice = ref('')
const routeSegments = ref(new Map())
const mapContainer = ref(null)
let map = null
let routeLayer = null

function dateKey(offset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const form = reactive({
  startDate: dateKey(),
  endDate: dateKey(),
  startTime: '09:00',
  endTime: '18:00',
  pace: 'balanced',
  transport: 'transit',
  purposes: ['sightseeing', 'culture'],
  district: '',
  startPlaceId: '',
  mustVisitIds: [],
  dailyStartAtBase: false,
})

const districts = computed(() => [...new Set(places.value.map((place) => place.district).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')))
const usedPlaceIds = computed(() => new Set(result.value?.days.flatMap((day) => day.items.map((item) => String(item.id))) || []))
const selectedStartPlace = computed(() => places.value.find((place) => String(place.id) === String(form.startPlaceId)) || null)
const selectedMustVisitPlaces = computed(() => form.mustVisitIds.map((id) => places.value.find((place) => String(place.id) === String(id))).filter(Boolean))
const startPlaceResults = computed(() => selectedStartPlace.value && startPlaceQuery.value === selectedStartPlace.value.title ? [] : searchPlaces(startPlaceQuery.value).slice(0, 8))
const mustVisitResults = computed(() => searchPlaces(mustVisitQuery.value).filter((place) => !form.mustVisitIds.includes(String(place.id))).slice(0, 8))
const dateFormatter = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

function formatDate(value) {
  return dateFormatter.format(new Date(`${value}T00:00:00`))
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest}분`
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`
}

function togglePurpose(id) {
  const index = form.purposes.indexOf(id)
  if (index >= 0) form.purposes.splice(index, 1)
  else form.purposes.push(id)
}

function searchPlaces(query) {
  const term = String(query || '').trim().toLowerCase()
  if (term.length < 2) return []
  return places.value.filter((place) => `${place.title} ${place.district} ${place.contentTypeName}`.toLowerCase().includes(term))
}

function selectStartPlace(place) {
  form.startPlaceId = String(place.id)
  startPlaceQuery.value = place.title
}

function clearStartPlace() {
  form.startPlaceId = ''
  startPlaceQuery.value = ''
  form.dailyStartAtBase = false
}

function addMustVisit(place) {
  form.mustVisitIds.push(String(place.id))
  mustVisitQuery.value = ''
}

function removeMustVisit(id) {
  form.mustVisitIds = form.mustVisitIds.filter((item) => String(item) !== String(id))
}

function dayCandidates(day) {
  return places.value
    .filter((place) => !usedPlaceIds.value.has(String(place.id)))
    .filter((place) => !day.district || place.district === day.district)
    .slice(0, 50)
}

async function applyEditedDays(days) {
  result.value = recalculateTripDays(days, { ...form, startPlace: result.value?.startPlace || null })
  saveFeedback.value = ''
  await applyGoogleDirections()
  await initializeMap()
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value).split(':').map(Number)
  return hours * 60 + minutes
}

async function applyGoogleDirections() {
  if (!result.value) return
  directionsNotice.value = 'Google Directions에서 실제 이동 경로를 확인하는 중입니다.'
  const segments = new Map()
  let successCount = 0
  let failureCount = 0
  const pace = TRIP_PACES.find((item) => item.id === form.pace) || TRIP_PACES[1]
  const endMinutes = timeToMinutes(form.endTime)

  for (const [dayIndex, day] of result.value.days.entries()) {
    let currentTime = timeToMinutes(form.startTime)
    let previous = result.value.startPlace && (dayIndex === 0 || form.dailyStartAtBase) ? result.value.startPlace : null
    for (const [itemIndex, item] of day.items.entries()) {
      let travelMinutes = item.travelMinutes
      if (previous) {
        try {
          const directions = await getGoogleDirections(previous, item, form.transport)
          travelMinutes = directions.durationMinutes
          segments.set(`${dayIndex}-${itemIndex}`, directions.coordinates)
          successCount += 1
        } catch {
          segments.set(`${dayIndex}-${itemIndex}`, [[previous.latitude, previous.longitude], [item.latitude, item.longitude]])
          failureCount += 1
        }
      }
      const bufferMinutes = Math.ceil(travelMinutes * pace.bufferRate)
      const arrivalMinutes = currentTime + travelMinutes + bufferMinutes
      const departureMinutes = arrivalMinutes + item.visitMinutes
      Object.assign(item, {
        travelMinutes,
        arrivalTime: formatMinutes(arrivalMinutes),
        departureTime: formatMinutes(departureMinutes),
        exceedsEndTime: departureMinutes > endMinutes,
      })
      currentTime = departureMinutes
      previous = item
    }
    day.totalMinutes = currentTime - timeToMinutes(form.startTime)
  }
  routeSegments.value = segments
  directionsNotice.value = successCount
    ? `Google Directions 실제 경로 ${successCount}개 구간을 적용했습니다.${failureCount ? ` ${failureCount}개 구간은 예상값을 사용합니다.` : ''}`
    : 'Google Directions를 브라우저에서 호출하지 못해 거리 기반 예상 경로를 사용합니다.'
}

function movePlace(dayIndex, itemIndex, offset) {
  const days = result.value.days.map((day) => ({ ...day, items: [...day.items] }))
  const targetIndex = itemIndex + offset
  if (targetIndex < 0 || targetIndex >= days[dayIndex].items.length) return
  const [item] = days[dayIndex].items.splice(itemIndex, 1)
  days[dayIndex].items.splice(targetIndex, 0, item)
  applyEditedDays(days)
}

function removePlace(dayIndex, itemIndex) {
  const days = result.value.days.map((day) => ({ ...day, items: [...day.items] }))
  const [removed] = days[dayIndex].items.splice(itemIndex, 1)
  if (removed?.isRequired) removeMustVisit(removed.id)
  editingItemKey.value = ''
  applyEditedDays(days)
}

function replacePlace(dayIndex, itemIndex, placeId) {
  const replacement = places.value.find((place) => String(place.id) === String(placeId))
  if (!replacement) return
  const days = result.value.days.map((day) => ({ ...day, items: [...day.items] }))
  const previous = days[dayIndex].items[itemIndex]
  if (previous?.isRequired) {
    form.mustVisitIds = form.mustVisitIds.map((id) => String(id) === String(previous.id) ? String(replacement.id) : String(id))
  }
  days[dayIndex].items.splice(itemIndex, 1, { ...replacement, isRequired: Boolean(previous?.isRequired) })
  editingItemKey.value = ''
  applyEditedDays(days)
}

function addPlace(dayIndex) {
  const placeId = addSelections[dayIndex]
  const place = places.value.find((item) => String(item.id) === String(placeId))
  if (!place) return
  const days = result.value.days.map((day) => ({ ...day, items: [...day.items] }))
  days[dayIndex].items.push({ ...place, isRequired: form.mustVisitIds.includes(String(place.id)) })
  addSelections[dayIndex] = ''
  applyEditedDays(days)
}

function handleSaveTrip() {
  if (!result.value) return
  saveTrip({ name: saveName.value, options: form, result: result.value })
  savedTrips.value = loadSavedTrips()
  saveFeedback.value = '현재 여행 일정을 저장했습니다.'
  saveName.value = ''
}

async function restoreTrip(trip) {
  Object.assign(form, trip.options)
  form.startPlaceId = trip.options.startPlaceId || ''
  form.mustVisitIds = Array.isArray(trip.options.mustVisitIds) ? [...trip.options.mustVisitIds] : []
  form.dailyStartAtBase = Boolean(trip.options.dailyStartAtBase)
  startPlaceQuery.value = places.value.find((place) => String(place.id) === String(form.startPlaceId))?.title || ''
  result.value = JSON.parse(JSON.stringify(trip.result))
  errorMessage.value = ''
  saveFeedback.value = `‘${trip.name}’ 일정을 불러왔습니다.`
  await applyGoogleDirections()
  await initializeMap()
}

function removeSavedTrip(id) {
  deleteSavedTrip(id)
  savedTrips.value = loadSavedTrips()
}

async function initializeMap() {
  await nextTick()
  if (!mapContainer.value || typeof window === 'undefined' || !window.L) return
  if (!map) {
    map = window.L.map(mapContainer.value, { scrollWheelZoom: true })
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
  }
  drawSchedule()
  setTimeout(() => map?.invalidateSize(), 0)
}

function drawSchedule() {
  if (!map || !result.value || !window.L) return
  if (routeLayer) routeLayer.remove()
  routeLayer = window.L.layerGroup().addTo(map)
  const colors = ['#ff7052', '#087fa7', '#526fc5', '#00a69a', '#d49b31']
  const bounds = []

  result.value.days.forEach((day, dayIndex) => {
    const shouldShowStart = result.value.startPlace && (dayIndex === 0 || form.dailyStartAtBase)
    const startCoordinate = shouldShowStart ? [[Number(result.value.startPlace.latitude), Number(result.value.startPlace.longitude)]] : []
    const coordinates = [...startCoordinate, ...day.items.map((item) => [Number(item.latitude), Number(item.longitude)])]
    bounds.push(...coordinates)
    if (coordinates.length > 1 && !routeSegments.value.size) window.L.polyline(coordinates, { color: colors[dayIndex % colors.length], weight: 5, opacity: .8 }).addTo(routeLayer)
    if (shouldShowStart) {
      const startIcon = window.L.divIcon({
        className: 'trip-start-marker-wrap',
        html: '<span class="trip-start-marker">출발</span>',
        iconSize: [44, 28],
        iconAnchor: [22, 14],
      })
      window.L.marker(startCoordinate[0], { icon: startIcon }).bindPopup(`<strong>출발 · ${result.value.startPlace.title}</strong>`).addTo(routeLayer)
    }
    day.items.forEach((item, itemIndex) => {
      const segment = routeSegments.value.get(`${dayIndex}-${itemIndex}`)
      if (segment?.length > 1) window.L.polyline(segment, { color: colors[dayIndex % colors.length], weight: 5, opacity: .8 }).addTo(routeLayer)
      const icon = window.L.divIcon({
        className: 'trip-number-marker-wrap',
        html: `<span class="trip-number-marker${item.isRequired ? ' required' : ''}" style="background:${colors[dayIndex % colors.length]}">${itemIndex + 1}</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })
      window.L.marker([item.latitude, item.longitude], { icon }).bindPopup(`<strong>${item.title}</strong><br>${day.date} ${item.arrivalTime}`).addTo(routeLayer)
    })
  })
  if (bounds.length) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 14 })
}

async function createSchedule() {
  errorMessage.value = ''
  try {
    result.value = generateTripSchedule(places.value, form)
    if (!result.value.totalPlaces) {
      errorMessage.value = '선택한 조건과 시간 안에 배치할 수 있는 장소가 없습니다. 지역이나 시간을 조정해 주세요.'
      result.value = null
      return
    }
    await applyGoogleDirections()
    await initializeMap()
  } catch (error) {
    result.value = null
    errorMessage.value = error.message
  }
}

onMounted(() => {
  places.value = getTripPlaces()
  savedTrips.value = loadSavedTrips()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <section class="page-hero trip-hero">
    <div class="container">
      <p class="eyebrow">CURATE YOUR BUSAN</p>
      <h1><span class="title-emoji" aria-hidden="true">🧳</span> 부산 여행 큐레이터</h1>
      <p>여행 시간과 스타일을 선택하면 이동 거리까지 고려해 하루를 구성해 드려요.</p>
    </div>
  </section>

  <main class="container page-content trip-page">
    <section v-if="savedTrips.length" class="saved-trips board-card" aria-labelledby="saved-trips-title">
      <header><div><p class="eyebrow">SAVED TRIPS</p><h2 id="saved-trips-title">💾 저장한 여행</h2></div><span>{{ savedTrips.length }}개</span></header>
      <div class="saved-trip-list">
        <article v-for="trip in savedTrips" :key="trip.id">
          <button class="saved-trip-main" type="button" @click="restoreTrip(trip)">
            <strong>{{ trip.name }}</strong>
            <span>{{ trip.options.startDate }}<template v-if="trip.options.endDate !== trip.options.startDate"> ~ {{ trip.options.endDate }}</template> · {{ trip.result.totalPlaces }}곳</span>
          </button>
          <button class="saved-trip-delete" type="button" :aria-label="`${trip.name} 삭제`" @click="removeSavedTrip(trip.id)">삭제</button>
        </article>
      </div>
    </section>

    <form class="trip-form board-card" @submit.prevent="createSchedule">
      <header><div><span>01</span><h2>여행 조건을 알려주세요</h2></div><p>최대 14일까지 만들 수 있어요.</p></header>

      <div class="trip-form-grid">
        <label class="board-field">시작 날짜<input v-model="form.startDate" class="board-control" type="date" required /></label>
        <label class="board-field">종료 날짜<input v-model="form.endDate" class="board-control" type="date" :min="form.startDate" required /></label>
        <label class="board-field">하루 시작 시간<input v-model="form.startTime" class="board-control" type="time" required /></label>
        <label class="board-field">하루 종료 시간<input v-model="form.endTime" class="board-control" type="time" required /></label>
        <label class="board-field">이동 수단<select v-model="form.transport" class="board-control"><option v-for="item in TRANSPORT_OPTIONS" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        <label class="board-field">여행 지역<select v-model="form.district" class="board-control"><option value="">부산 전체에서 추천</option><option v-for="district in districts" :key="district">{{ district }}</option></select></label>
      </div>

      <div class="trip-place-preferences">
        <section class="place-search-section">
          <div class="place-search-heading"><div><strong>출발 장소</strong><p>첫 장소까지의 이동시간 계산에 사용합니다.</p></div><button v-if="selectedStartPlace" type="button" @click="clearStartPlace">선택 해제</button></div>
          <div v-if="selectedStartPlace" class="selected-search-place"><span class="board-badge">출발</span><strong>{{ selectedStartPlace.title }}</strong><small>{{ selectedStartPlace.district }} · {{ selectedStartPlace.contentTypeName }}</small></div>
          <input v-else v-model="startPlaceQuery" class="board-control" type="search" placeholder="숙소나 출발 장소를 2글자 이상 검색" />
          <div v-if="startPlaceResults.length" class="place-search-results">
            <button v-for="place in startPlaceResults" :key="place.id" type="button" @click="selectStartPlace(place)"><strong>{{ place.title }}</strong><span>{{ place.district }} · {{ place.contentTypeName }}</span></button>
          </div>
          <label v-if="selectedStartPlace" class="daily-base-option"><input v-model="form.dailyStartAtBase" type="checkbox" /><span>숙소처럼 매일 이 장소에서 출발</span></label>
        </section>

        <section class="place-search-section">
          <div class="place-search-heading"><div><strong>필수 방문 장소</strong><p>시간이 부족해도 일정에 우선 배치합니다.</p></div><span>{{ selectedMustVisitPlaces.length }}곳</span></div>
          <div v-if="selectedMustVisitPlaces.length" class="must-visit-chips">
            <span v-for="place in selectedMustVisitPlaces" :key="place.id"><strong>{{ place.title }}</strong><button type="button" :aria-label="`${place.title} 필수 방문 해제`" @click="removeMustVisit(place.id)">×</button></span>
          </div>
          <input v-model="mustVisitQuery" class="board-control" type="search" placeholder="반드시 가고 싶은 장소 검색" />
          <div v-if="mustVisitResults.length" class="place-search-results">
            <button v-for="place in mustVisitResults" :key="place.id" type="button" @click="addMustVisit(place)"><strong>{{ place.title }}</strong><span>{{ place.district }} · {{ place.contentTypeName }}</span></button>
          </div>
        </section>
      </div>

      <fieldset class="trip-fieldset">
        <legend>여행 스타일</legend>
        <div class="pace-grid">
          <label v-for="pace in TRIP_PACES" :key="pace.id" :class="['pace-option', { active: form.pace === pace.id }]">
            <input v-model="form.pace" type="radio" :value="pace.id" />
            <span><strong>{{ pace.name }}</strong><small>{{ pace.description }}</small></span>
          </label>
        </div>
      </fieldset>

      <fieldset class="trip-fieldset">
        <legend>관심 분야</legend>
        <div class="purpose-options">
          <button v-for="purpose in TRIP_PURPOSES" :key="purpose.id" type="button" :class="{ active: form.purposes.includes(purpose.id) }" :aria-pressed="form.purposes.includes(purpose.id)" @click="togglePurpose(purpose.id)">{{ purpose.name }}</button>
        </div>
      </fieldset>

      <p v-if="errorMessage" class="board-error" role="alert">{{ errorMessage }}</p>
      <button class="button board-button board-button--primary trip-submit" type="submit">내 여행 일정 만들기</button>
    </form>

    <section v-if="result" class="trip-result" aria-labelledby="trip-result-title">
      <header class="trip-result-heading">
        <div><p class="eyebrow">YOUR CURATED TRIP</p><h2 id="trip-result-title">{{ result.pace }} 부산 여행</h2></div>
        <div><strong>{{ result.days.length }}</strong><span>일</span><strong>{{ result.totalPlaces }}</strong><span>장소</span></div>
      </header>

      <div class="trip-save-bar board-card">
        <label class="sr-only" for="trip-save-name">저장할 여행 이름</label>
        <input id="trip-save-name" v-model="saveName" class="board-control" maxlength="40" :placeholder="`${form.startDate} 부산 여행`" />
        <button class="button board-button board-button--secondary" type="button" @click="handleSaveTrip">내 여행 저장</button>
        <span v-if="saveFeedback" role="status">{{ saveFeedback }}</span>
      </div>

      <p class="trip-notice">Google Directions 응답이 있는 구간은 실제 경로를, 호출할 수 없는 구간은 거리 기반 예상값을 사용합니다. 방문 전 운영시간을 확인해 주세요.</p>
      <p v-if="directionsNotice" class="directions-notice" role="status">{{ directionsNotice }}</p>
      <div ref="mapContainer" class="map-frame trip-map" aria-label="추천 여행 경로 지도"></div>

      <div class="trip-days">
        <article v-for="(day, dayIndex) in result.days" :key="day.date" class="trip-day board-card">
          <header><div><span>DAY {{ dayIndex + 1 }}</span><h3>{{ formatDate(day.date) }}</h3></div><p>{{ day.district }} · 약 {{ formatDuration(day.totalMinutes) }}</p></header>
          <div v-if="result.startPlace && (dayIndex === 0 || form.dailyStartAtBase)" class="day-start-place"><span>출발</span><strong>{{ result.startPlace.title }}</strong><small>{{ form.startTime }}</small></div>
          <ol>
            <li v-for="(item, itemIndex) in day.items" :key="item.id" :class="{ 'time-overrun': item.exceedsEndTime }">
              <div class="trip-time"><strong>{{ item.arrivalTime }}</strong><span>{{ item.departureTime }}까지</span></div>
              <div class="trip-line"><span>{{ itemIndex + 1 }}</span><i v-if="itemIndex < day.items.length - 1"></i></div>
              <div class="trip-place">
                <div class="trip-place-badges"><span class="board-badge">{{ item.contentTypeName }}</span><span v-if="item.isRequired" class="required-badge">필수 방문</span></div>
                <h4><RouterLink :to="{ name: 'region-detail', params: { contentId: item.id } }">{{ item.title }}</RouterLink></h4>
                <p>{{ item.address || '주소 정보 없음' }}</p>
                <small><template v-if="item.travelMinutes">이전 장소에서 예상 {{ item.travelMinutes }}분 · </template>체류 {{ item.visitMinutes }}분</small>
                <small v-if="item.exceedsEndTime" class="overrun-warning">설정한 종료 시간을 초과합니다.</small>
                <div class="trip-item-actions">
                  <button type="button" :disabled="itemIndex === 0" aria-label="방문 순서 위로 이동" @click="movePlace(dayIndex, itemIndex, -1)">↑</button>
                  <button type="button" :disabled="itemIndex === day.items.length - 1" aria-label="방문 순서 아래로 이동" @click="movePlace(dayIndex, itemIndex, 1)">↓</button>
                  <button type="button" @click="editingItemKey = editingItemKey === `${dayIndex}-${itemIndex}` ? '' : `${dayIndex}-${itemIndex}`">교체</button>
                  <button class="danger" type="button" @click="removePlace(dayIndex, itemIndex)">삭제</button>
                </div>
                <div v-if="editingItemKey === `${dayIndex}-${itemIndex}`" class="replace-place-control">
                  <select class="board-control" aria-label="교체할 장소" @change="replacePlace(dayIndex, itemIndex, $event.target.value)">
                    <option value="">교체할 장소를 선택하세요</option>
                    <option v-for="candidate in dayCandidates(day)" :key="candidate.id" :value="candidate.id">{{ candidate.contentTypeName }} · {{ candidate.title }}</option>
                  </select>
                </div>
              </div>
            </li>
          </ol>
          <div class="add-place-control">
            <select v-model="addSelections[dayIndex]" class="board-control" aria-label="일정에 추가할 장소">
              <option value="">{{ day.district }}에서 장소 추가</option>
              <option v-for="candidate in dayCandidates(day)" :key="candidate.id" :value="candidate.id">{{ candidate.contentTypeName }} · {{ candidate.title }}</option>
            </select>
            <button class="button board-button board-button--outline" type="button" :disabled="!addSelections[dayIndex]" @click="addPlace(dayIndex)">추가</button>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.trip-page { max-width: 1040px; }
.saved-trips { margin-bottom: 20px; padding: 22px; }
.saved-trips > header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.saved-trips h2 { margin: 0; color: var(--green); font-size: 21px; }
.saved-trips > header .eyebrow { margin-bottom: 5px; }
.saved-trips > header > span { color: #7b8580; font-size: 12px; }
.saved-trip-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.saved-trip-list article { display: grid; grid-template-columns: 1fr auto; overflow: hidden; border: 1px solid #dce4dd; border-radius: 9px; background: #f8faf7; }
.saved-trip-list button { border: 0; cursor: pointer; }
.saved-trip-main { display: grid; gap: 5px; min-width: 0; padding: 12px; text-align: left; background: transparent; }
.saved-trip-main strong { overflow: hidden; color: var(--green); text-overflow: ellipsis; white-space: nowrap; }
.saved-trip-main span { color: #7b8580; font-size: 10px; }
.saved-trip-main:hover { background: var(--mint); }
.saved-trip-delete { padding: 0 10px; color: #a04b3b; border-left: 1px solid #e1e7e2 !important; background: white; font-size: 11px; font-weight: 700; }
.trip-form { display: grid; gap: 28px; padding: 32px; }
.trip-form > header, .trip-result-heading, .trip-day > header { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.trip-form > header div { display: flex; align-items: center; gap: 12px; }
.trip-form > header span { display: grid; place-items: center; width: 36px; height: 36px; color: white; border-radius: 50%; background: var(--orange); font-weight: 800; }
.trip-form h2 { margin: 0; color: var(--green); font-size: 23px; }
.trip-form > header p { margin: 0; color: #77817c; font-size: 12px; }
.trip-form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.trip-place-preferences { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.place-search-section { position: relative; min-width: 0; padding: 18px; border: 1px solid #dbe4dc; border-radius: 11px; background: #f8faf7; }
.place-search-heading { display: flex; align-items: start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.place-search-heading strong { color: var(--green); font-size: 14px; }
.place-search-heading p { margin: 4px 0 0; color: #7b8580; font-size: 11px; }
.place-search-heading > button { padding: 0; color: #a04b3b; border: 0; background: transparent; cursor: pointer; font-size: 11px; font-weight: 700; }
.place-search-heading > span { color: var(--orange); font-size: 12px; font-weight: 800; }
.selected-search-place { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 6px 10px; padding: 11px; border: 1px solid #cfddd2; border-radius: 8px; background: white; }
.selected-search-place small { grid-column: 2; color: #7b8580; font-size: 10px; }
.place-search-results { position: absolute; left: 18px; right: 18px; z-index: 9; max-height: 230px; overflow-y: auto; border: 1px solid #bddde5; border-radius: 12px; background: white; box-shadow: 0 14px 34px rgba(5,83,113,.15); }
.place-search-results button { display: grid; gap: 3px; width: 100%; padding: 10px 12px; text-align: left; border: 0; border-bottom: 1px solid #edf1ed; background: white; cursor: pointer; }
.place-search-results button:hover { background: var(--mint); }
.place-search-results strong { color: var(--green); font-size: 12px; }
.place-search-results span { color: #7b8580; font-size: 10px; }
.daily-base-option { display: flex; align-items: center; gap: 8px; margin-top: 11px; color: #5f6b65; cursor: pointer; font-size: 12px; font-weight: 700; }
.must-visit-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.must-visit-chips > span { display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 10px; color: var(--green); border-radius: 15px; background: var(--mint); font-size: 11px; }
.must-visit-chips button { display: grid; place-items: center; width: 18px; height: 18px; padding: 0; color: #7b5145; border: 0; border-radius: 50%; background: rgba(255,255,255,.7); cursor: pointer; }
.trip-fieldset { min-width: 0; padding: 0; border: 0; }
.trip-fieldset legend { margin-bottom: 10px; color: var(--green); font-size: 13px; font-weight: 700; }
.pace-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.pace-option { position: relative; padding: 17px; border: 1px solid #d6dfd8; border-radius: 10px; background: #fafbf8; cursor: pointer; }
.pace-option.active { border-color: var(--orange); background: #fff5f1; box-shadow: 0 0 0 3px rgba(255,112,82,.1); }
.pace-option input { position: absolute; opacity: 0; }
.pace-option span { display: grid; gap: 5px; }
.pace-option strong { color: var(--green); font-size: 14px; }
.pace-option small { color: #78827d; font-size: 11px; }
.purpose-options { display: flex; flex-wrap: wrap; gap: 8px; }
.purpose-options button { min-height: 40px; padding: 0 16px; color: #5e6a64; border: 1px solid #d3ddd5; border-radius: 20px; background: white; cursor: pointer; font-weight: 700; }
.purpose-options button.active { color: white; border-color: var(--green); background: var(--green); }
.trip-submit { width: 100%; min-height: 52px; }
.trip-result { margin-top: 60px; }
.trip-result-heading { margin-bottom: 20px; }
.trip-result-heading h2 { margin: 0; color: var(--green); font-family: var(--display-font); font-size: 38px; font-weight: 400; letter-spacing: -.04em; }
.trip-result-heading > div:last-child { display: flex; align-items: baseline; gap: 6px; }
.trip-result-heading > div:last-child strong { margin-left: 13px; color: var(--orange); font-size: 28px; }
.trip-result-heading > div:last-child span { color: #748079; font-size: 13px; }
.trip-save-bar { display: grid; grid-template-columns: minmax(180px, 1fr) auto; align-items: center; gap: 9px; margin-bottom: 16px; padding: 12px; }
.trip-save-bar > span { grid-column: 1 / -1; color: var(--green); font-size: 12px; font-weight: 700; }
.trip-notice { padding: 13px 16px; color: #69746e; border: 1px solid #dce4dd; border-radius: 9px; background: #f4f7f2; font-size: 12px; line-height: 1.6; }
.directions-notice { margin: 10px 0 0; color: var(--green); font-size: 12px; font-weight: 700; }
.trip-map { height: 440px; margin-top: 18px; }
.trip-map :deep(.leaflet-container) { height: 100%; }
.trip-map :deep(.trip-number-marker-wrap) { background: transparent; border: 0; }
.trip-map :deep(.trip-number-marker) { display: grid; place-items: center; width: 32px; height: 32px; color: white; border: 3px solid white; border-radius: 50%; box-shadow: 0 3px 10px rgba(0,0,0,.24); font-size: 12px; font-weight: 800; }
.trip-map :deep(.trip-number-marker.required) { border-color: #ffd4ca; box-shadow: 0 0 0 3px #ff7052, 0 3px 10px rgba(0,0,0,.24); }
.trip-map :deep(.trip-start-marker-wrap) { background: transparent; border: 0; }
.trip-map :deep(.trip-start-marker) { display: grid; place-items: center; width: 44px; height: 28px; color: white; border: 2px solid white; border-radius: 14px; background: #173f75; box-shadow: 0 3px 10px rgba(0,0,0,.24); font-size: 10px; font-weight: 800; }
.trip-days { display: grid; gap: 18px; margin-top: 24px; }
.trip-day { padding: 26px; }
.trip-day > header { padding-bottom: 18px; border-bottom: 1px solid #e8ede9; }
.trip-day > header span { color: var(--orange); font-size: 11px; font-weight: 800; letter-spacing: .12em; }
.trip-day h3 { margin: 4px 0 0; color: var(--green); font-size: 21px; }
.trip-day > header p { margin: 0; color: #748079; font-size: 12px; }
.day-start-place { display: flex; align-items: center; gap: 9px; margin-top: 14px; padding: 10px 12px; border-radius: 8px; background: #eef3f8; }
.day-start-place span { padding: 4px 7px; color: white; border-radius: 10px; background: #173f75; font-size: 9px; font-weight: 800; }
.day-start-place strong { color: #294866; font-size: 12px; }
.day-start-place small { margin-left: auto; color: #718394; }
.trip-day ol { display: grid; gap: 0; margin: 25px 0 0; padding: 0; list-style: none; }
.trip-day li { display: grid; grid-template-columns: 74px 34px 1fr; gap: 14px; min-height: 128px; }
.trip-time { display: grid; align-content: start; gap: 4px; padding-top: 3px; text-align: right; }
.trip-time strong { color: var(--green); font-size: 15px; }
.trip-time span { color: #8a938e; font-size: 10px; }
.trip-line { display: flex; align-items: center; flex-direction: column; }
.trip-line span { display: grid; place-items: center; width: 30px; height: 30px; flex: 0 0 auto; color: white; border-radius: 50%; background: var(--orange); font-size: 12px; font-weight: 800; }
.trip-line i { width: 2px; height: 100%; background: #dce5de; }
.trip-place { padding-bottom: 25px; }
.trip-place-badges { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.required-badge { display: inline-flex; padding: 5px 9px; color: #a4482e; border-radius: 999px; background: #ffdfc9; font-size: 10px; font-weight: 800; }
.trip-place h4 { margin: 8px 0 5px; color: var(--green); font-size: 18px; }
.trip-place h4 a:hover { color: var(--orange); }
.trip-place p { margin: 0 0 7px; color: #707b75; font-size: 12px; }
.trip-place small { color: #929a96; font-size: 11px; }
.trip-place .overrun-warning { display: block; margin-top: 6px; color: #b74f3b; font-weight: 700; }
.trip-item-actions { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 12px; }
.trip-item-actions button { min-height: 29px; padding: 0 9px; color: var(--green); border: 1px solid #d4ded6; border-radius: 6px; background: white; cursor: pointer; font-size: 11px; font-weight: 700; }
.trip-item-actions button:hover:not(:disabled) { border-color: var(--green); background: var(--mint); }
.trip-item-actions button:disabled { opacity: .35; cursor: default; }
.trip-item-actions button.danger { color: #a04b3b; }
.replace-place-control { margin-top: 9px; }
.replace-place-control .board-control { min-height: 40px; font-size: 12px; }
.add-place-control { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding-top: 15px; border-top: 1px dashed #d7e0d9; }
.add-place-control .board-control { font-size: 12px; }
.time-overrun .trip-line span { background: #b74f3b; }
@media (max-width: 800px) { .trip-form-grid { grid-template-columns: repeat(2, 1fr); } .trip-place-preferences { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .saved-trip-list { grid-template-columns: 1fr; } .trip-form { padding: 22px; } .trip-form > header, .trip-result-heading, .trip-day > header { align-items: flex-start; flex-direction: column; } .trip-form-grid, .pace-grid, .trip-save-bar { grid-template-columns: 1fr; } .trip-map { height: 340px; } .trip-day { padding: 20px 14px; } .trip-day li { grid-template-columns: 58px 28px 1fr; gap: 9px; } .trip-line span { width: 27px; height: 27px; } }
</style>
