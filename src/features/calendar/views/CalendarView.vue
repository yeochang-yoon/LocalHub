<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getBusanFestivalCalendarItems } from '../services/api/calendarApi'
import { getBusanHistoricalWeather, getBusanWeather } from '../services/api/weatherApi'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const loadError = ref('')
const festivals = ref([])
const weatherItems = ref([])
const historicalWeatherItems = ref([])
const weatherLoading = ref(false)
const historicalWeatherLoading = ref(false)
const weatherError = ref('')
const weatherController = ref(null)
const historicalWeatherController = ref(null)
const loadedHistoricalMonths = new Set()

const today = new Date()
today.setHours(0, 0, 0, 0)
const todayKey = toDateKey(today)

function getInitialMonth() {
  const year = Number(route.query.year)
  const month = Number(route.query.month)

  if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
    return new Date(year, month - 1, 1)
  }

  return new Date(today.getFullYear(), today.getMonth(), 1)
}

const currentMonth = ref(getInitialMonth())

const monthFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
})

const shortDateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토']

const rangeFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseModifiedTime(value) {
  const text = String(value ?? '').trim()
  if (!text) return null

  const compactMatch = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  if (compactMatch) {
    const [, yearText, monthText, dayText, hourText, minuteText, secondText] = compactMatch
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    const hour = Number(hourText)
    const minute = Number(minuteText)
    const second = Number(secondText)
    const date = new Date(year, month - 1, day, hour, minute, second)

    const isValid =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date.getHours() === hour &&
      date.getMinutes() === minute &&
      date.getSeconds() === second

    return isValid ? date : null
  }

  const timestamp = Date.parse(text)
  return Number.isFinite(timestamp) ? new Date(timestamp) : null
}

function formatModifiedTime(value) {
  const parsed = parseModifiedTime(value)
  if (!parsed) return '-'
  return shortDateTimeFormatter.format(parsed)
}

const normalizedFestivals = computed(() => {
  return festivals.value
    .map((item) => {
      const modifiedAt = parseModifiedTime(item.modifiedtime)
      if (!modifiedAt) return null

      return {
        ...item,
        modifiedAt,
        dateKey: toDateKey(modifiedAt),
      }
    })
    .filter(Boolean)
})

const festivalsByDate = computed(() => {
  const grouped = new Map()
  const targetYear = currentMonth.value.getFullYear()
  const targetMonth = currentMonth.value.getMonth()

  for (const festival of normalizedFestivals.value) {
    if (festival.modifiedAt.getFullYear() !== targetYear || festival.modifiedAt.getMonth() !== targetMonth) continue
    const existing = grouped.get(festival.dateKey) || []
    existing.push(festival)
    grouped.set(festival.dateKey, existing)
  }

  return grouped
})

const weatherByDate = computed(() => new Map(
  [...historicalWeatherItems.value, ...weatherItems.value].map((item) => [item.dateKey, item])
))

function addDays(date, amount) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

const rangeStart = addDays(today, -14)
const rangeEnd = addDays(today, 14)
const historicalRangeStart = new Date(today)
historicalRangeStart.setFullYear(historicalRangeStart.getFullYear() - 2)
const rangeLabel = `${rangeFormatter.format(rangeStart)} ~ ${rangeFormatter.format(rangeEnd)}`
const monthLabel = computed(() => monthFormatter.format(currentMonth.value))

const calendarCells = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let index = 0; index < firstDay.getDay(); index += 1) {
    cells.push({ key: `empty-${index}`, empty: true })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day)
    const dateKey = toDateKey(date)
    cells.push({
      key: dateKey,
      empty: false,
      dateKey,
      day,
      month: date.getMonth() + 1,
      isToday: dateKey === todayKey,
      isPast: date < today,
      isWeatherRange: date >= historicalRangeStart && date <= rangeEnd,
      weather: weatherByDate.value.get(dateKey) || null,
      festivals: festivalsByDate.value.get(dateKey) || [],
    })
  }

  return cells
})

function syncCalendarRoute(targetMonth) {
  router.replace({
    name: 'calendar',
    query: {
      ...route.query,
      year: String(targetMonth.getFullYear()),
      month: String(targetMonth.getMonth() + 1),
    },
  })
}

function moveMonth(offset) {
  const nextMonth = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + offset, 1)
  currentMonth.value = nextMonth
  syncCalendarRoute(nextMonth)
}

function goToToday() {
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  currentMonth.value = thisMonth
  syncCalendarRoute(thisMonth)
}

function loadFestivals() {
  loadError.value = ''
  loading.value = true

  try {
    festivals.value = getBusanFestivalCalendarItems()
  } catch (error) {
    festivals.value = []
    loadError.value = `축제 데이터를 불러오지 못했습니다: ${error.message}`
  } finally {
    loading.value = false
  }
}

async function loadWeather() {
  weatherController.value?.abort()
  weatherController.value = new AbortController()
  weatherLoading.value = true
  weatherError.value = ''

  try {
    weatherItems.value = await getBusanWeather({ signal: weatherController.value.signal })
  } catch (error) {
    if (error.name !== 'AbortError') {
      weatherItems.value = []
      weatherError.value = '날씨 정보를 잠시 불러오지 못했어요.'
    }
  } finally {
    weatherLoading.value = false
  }
}

async function loadHistoricalWeatherForMonth() {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  if (loadedHistoricalMonths.has(monthKey)) return

  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)
  const historicalEnd = addDays(rangeStart, -1)
  const requestStart = monthStart < historicalRangeStart ? historicalRangeStart : monthStart
  const requestEnd = monthEnd > historicalEnd ? historicalEnd : monthEnd

  if (requestStart > requestEnd) return

  historicalWeatherController.value?.abort()
  const controller = new AbortController()
  historicalWeatherController.value = controller
  historicalWeatherLoading.value = true
  weatherError.value = ''

  try {
    const items = await getBusanHistoricalWeather({
      startDate: toDateKey(requestStart),
      endDate: toDateKey(requestEnd),
      signal: controller.signal,
    })
    historicalWeatherItems.value = [
      ...new Map([...historicalWeatherItems.value, ...items].map((item) => [item.dateKey, item])).values(),
    ]
    loadedHistoricalMonths.add(monthKey)
  } catch (error) {
    if (error.name !== 'AbortError') weatherError.value = '과거 날씨 정보를 잠시 불러오지 못했어요.'
  } finally {
    if (historicalWeatherController.value === controller) historicalWeatherLoading.value = false
  }
}

watch(
  () => [route.query.year, route.query.month],
  ([yearText, monthText]) => {
    const year = Number(yearText)
    const month = Number(monthText)

    if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
      const nextMonth = new Date(year, month - 1, 1)
      const sameMonth =
        nextMonth.getFullYear() === currentMonth.value.getFullYear() &&
        nextMonth.getMonth() === currentMonth.value.getMonth()

      if (!sameMonth) currentMonth.value = nextMonth
    }
  },
  { immediate: true }
)

watch(currentMonth, loadHistoricalWeatherForMonth)

onMounted(() => {
  loadFestivals()
  loadWeather()
  loadHistoricalWeatherForMonth()
  syncCalendarRoute(currentMonth.value)
})

onBeforeUnmount(() => {
  weatherController.value?.abort()
  historicalWeatherController.value?.abort()
})
</script>

<template>
  <section class="page-hero">
    <div class="container">
      <p class="eyebrow">BUSAN FESTIVAL CALENDAR</p>
      <h1><span class="title-emoji" aria-hidden="true">🎉</span> 부산 캘린더</h1>
      <p>월별 부산 축제·공연과 오늘을 중심으로 앞뒤 2주의 날씨를 만나보세요.</p>
    </div>
  </section>

  <section class="container page-content calendar-page">
    <p v-if="loading" class="empty-state">캘린더 데이터를 불러오는 중입니다.</p>
    <p v-else-if="loadError" class="empty-state">{{ loadError }}</p>

    <div v-else class="calendar-card board-card">
      <header class="calendar-header">
        <button class="button board-button board-button--outline" type="button" @click="moveMonth(-1)">이전</button>
        <div class="calendar-title">
          <h2>{{ monthLabel }}</h2>
          <button class="today-badge" type="button" @click="goToToday">📌 오늘 {{ today.getMonth() + 1 }}월 {{ today.getDate() }}일</button>
        </div>
        <button class="button board-button board-button--outline" type="button" @click="moveMonth(1)">다음</button>
      </header>

      <p v-if="weatherLoading || historicalWeatherLoading" class="weather-status">🌦️ 부산 날씨를 불러오는 중...</p>
      <p v-else-if="weatherError" class="weather-status weather-status--error">{{ weatherError }}</p>
      <p v-else class="weather-status">🌊 최근 2년의 지난 날씨 · 예보 범위 {{ rangeLabel }}</p>

      <div class="calendar-grid weekday-grid" aria-hidden="true">
        <span v-for="label in weekdayLabels" :key="label">{{ label }}</span>
      </div>

      <div class="calendar-grid day-grid">
        <article
          v-for="cell in calendarCells"
          :key="cell.key"
          class="calendar-cell"
          :class="{ empty: cell.empty, today: cell.isToday, past: cell.isPast }"
        >
          <template v-if="!cell.empty">
            <header class="calendar-date">
              <span>{{ cell.month }}/{{ cell.day }}</span>
              <strong v-if="cell.isToday">오늘</strong>
            </header>
            <div v-if="cell.weather" class="weather-summary" :title="cell.weather.label">
              <span class="weather-emoji" aria-hidden="true">{{ cell.weather.emoji }}</span>
              <div>
                <strong>{{ cell.weather.label }}</strong>
                <span>{{ Math.round(cell.weather.temperatureMin) }}° / {{ Math.round(cell.weather.temperatureMax) }}°</span>
                <small v-if="cell.weather.historical && cell.weather.precipitationAmount > 0">💧 {{ cell.weather.precipitationAmount }}mm</small>
                <small v-if="cell.weather.precipitationProbability > 0">💧 {{ cell.weather.precipitationProbability }}%</small>
              </div>
            </div>
            <div v-else-if="cell.isWeatherRange" class="weather-empty">🎈 날씨 대기 중</div>
            <div v-else class="weather-empty weather-empty--outside">날씨 제공 범위 밖</div>
            <div class="festival-list">
              <RouterLink
                v-for="festival in cell.festivals"
                :key="festival.contentId"
                class="festival-chip"
                :to="{
                  name: 'region-detail',
                  params: { contentId: festival.contentId },
                  query: {
                    from: 'calendar',
                    year: currentMonth.getFullYear(),
                    month: currentMonth.getMonth() + 1,
                  },
                }"
              >
                <span class="festival-chip-label">{{ festival.title }}</span>
                <span class="festival-tooltip" role="tooltip">
                  <strong>{{ festival.title }}</strong>
                  <span>{{ formatModifiedTime(festival.modifiedtime) }}</span>
                  <span>주소: {{ festival.address1 || '-' }} {{ festival.address2 || '' }}</span>
                </span>
              </RouterLink>
            </div>
          </template>
        </article>
      </div>
      <footer class="weather-source">
        <span>※ 축제 정보는 모든 월에서 확인할 수 있고, 지난 날씨는 최근 2년까지 월별로 불러옵니다.</span>
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">날씨 출처: Open-Meteo</a>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.calendar-page {
  max-width: 1100px;
}

.calendar-card {
  padding: 20px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.calendar-header h2 {
  margin: 0;
  color: var(--green);
  font-size: 24px;
}

.calendar-title {
  display: grid;
  justify-items: center;
  gap: 7px;
  text-align: center;
}

.today-badge {
  display: inline-flex;
  padding: 5px 10px;
  color: #075d91;
  border: 0;
  border-radius: 999px;
  background: #dff6ff;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.today-badge:hover,
.today-badge:focus-visible {
  outline: 2px solid rgba(7, 93, 145, .2);
  background: #c8efff;
}

.weather-status {
  margin: 0 0 12px;
  text-align: center;
  color: #277d9c;
  font-size: 13px;
  font-weight: 700;
}

.weather-status--error {
  color: #b34f3d;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.weekday-grid span {
  padding: 10px 8px;
  text-align: center;
  color: #738079;
  font-size: 13px;
  font-weight: 700;
}

.day-grid {
  overflow: hidden;
  border-top: 1px solid #d8ebef;
  border-left: 1px solid #d8ebef;
  border-radius: 14px;
}

.calendar-cell {
  min-height: 175px;
  padding: 8px;
  border-right: 1px solid #d8ebef;
  border-bottom: 1px solid #d8ebef;
  background: #fff;
}

.calendar-cell.past:not(.today) {
  background: #f9fcfd;
}

.calendar-cell.today {
  position: relative;
  z-index: 1;
  background: #fff8d9;
  box-shadow: inset 0 0 0 3px #ffbd3e;
}

.calendar-cell.empty {
  background: #f3fafc;
}

.calendar-date {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  color: #60716a;
  font-size: 12px;
  font-weight: 700;
}

.calendar-date strong {
  padding: 2px 6px;
  color: white;
  border-radius: 999px;
  background: #ff8a3d;
  font-size: 10px;
}

.weather-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 55px;
  margin-bottom: 8px;
  padding: 6px;
  border-radius: 10px;
  background: linear-gradient(135deg, #e8f9ff, #f4fcff);
}

.weather-emoji {
  font-size: 25px;
}

.weather-summary div {
  display: grid;
  min-width: 0;
  color: #366275;
  font-size: 10px;
}

.weather-summary strong {
  overflow: hidden;
  color: #146f9a;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weather-summary small {
  color: #3189b6;
  font-size: 10px;
}

.weather-empty {
  min-height: 55px;
  margin-bottom: 8px;
  padding: 8px 5px;
  color: #91a9b2;
  border-radius: 10px;
  background: #f3f8fa;
  font-size: 10px;
}

.weather-empty--outside {
  color: #a1adb1;
  background: #f7f9fa;
}

.festival-list {
  display: grid;
  gap: 6px;
}

.festival-chip {
  position: relative;
  display: block;
  padding: 6px 8px;
  border: 1px solid #bddde5;
  border-radius: 8px;
  background: #eaf8fb;
  color: var(--green);
  font-size: 12px;
  font-weight: 700;
}

.festival-chip:hover {
  border-color: var(--orange);
  background: #fff3ef;
}

.festival-chip-label {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.festival-tooltip {
  position: absolute;
  left: 0;
  top: calc(100% + 8px);
  z-index: 6;
  display: none;
  width: min(260px, 90vw);
  padding: 10px;
  border: 1px solid #d8e3da;
  border-radius: 10px;
  background: white;
  box-shadow: 0 14px 30px rgba(5, 83, 113, .16);
  color: #294957;
  font-size: 12px;
  line-height: 1.45;
}

.festival-tooltip strong {
  display: block;
  margin-bottom: 6px;
  color: var(--green);
  font-size: 13px;
}

.festival-tooltip span {
  display: block;
}

.festival-chip:hover .festival-tooltip,
.festival-chip:focus-visible .festival-tooltip {
  display: block;
}

.weather-source {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  color: #71858d;
  font-size: 11px;
}

.weather-source a {
  color: #177ca3;
  font-weight: 700;
}

@media (max-width: 980px) {
  .calendar-card {
    padding: 12px;
  }

  .calendar-cell {
    min-height: 160px;
    padding: 6px;
  }

  .calendar-header,
  .weather-source {
    align-items: center;
  }

  .weather-source { align-items: flex-start; flex-direction: column; }
}
</style>
