<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getBusanFestivalCalendarItems } from '../services/api/calendarApi'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const loadError = ref('')
const festivals = ref([])

function getInitialMonth() {
  const year = Number(route.query.year)
  const month = Number(route.query.month)

  if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
    return new Date(year, month - 1, 1)
  }

  return new Date(new Date().getFullYear(), new Date().getMonth(), 1)
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

const monthLabel = computed(() => monthFormatter.format(currentMonth.value))

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

const calendarCells = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()

  const firstDay = new Date(year, month, 1)
  const firstWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ key: `empty-${index}`, empty: true })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day)
    const dateKey = toDateKey(date)
    cells.push({
      key: dateKey,
      empty: false,
      day,
      festivals: festivalsByDate.value.get(dateKey) || [],
    })
  }

  return cells
})

function syncCalendarRoute(targetMonth) {
  const nextQuery = {
    ...route.query,
    year: String(targetMonth.getFullYear()),
    month: String(targetMonth.getMonth() + 1),
  }

  router.replace({ name: 'calendar', query: nextQuery })
}

function moveMonth(offset) {
  const nextMonth = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + offset, 1)
  currentMonth.value = nextMonth
  syncCalendarRoute(nextMonth)
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

      if (!sameMonth) {
        currentMonth.value = nextMonth
      }
    }
  },
  { immediate: true }
)

onMounted(() => {
  loadFestivals()
  syncCalendarRoute(currentMonth.value)
})
</script>

<template>
  <section class="page-hero">
    <div class="container">
      <p class="eyebrow">BUSAN FESTIVAL CALENDAR</p>
      <h1><span class="title-emoji" aria-hidden="true">🎉</span> 부산 캘린더</h1>
      <p>부산 축제·공연 일정을 확인해보세요.</p>
    </div>
  </section>

  <section class="container page-content calendar-page">
    <p v-if="loading" class="empty-state">캘린더 데이터를 불러오는 중입니다.</p>
    <p v-else-if="loadError" class="empty-state">{{ loadError }}</p>

    <div v-else class="calendar-card board-card">
      <header class="calendar-header">
        <button class="button board-button board-button--outline" type="button" @click="moveMonth(-1)">이전</button>
        <h2>{{ monthLabel }}</h2>
        <button class="button board-button board-button--outline" type="button" @click="moveMonth(1)">다음</button>
      </header>

      <div class="calendar-grid weekday-grid" aria-hidden="true">
        <span v-for="label in weekdayLabels" :key="label">{{ label }}</span>
      </div>

      <div class="calendar-grid day-grid">
        <article v-for="cell in calendarCells" :key="cell.key" class="calendar-cell" :class="{ empty: cell.empty }">
          <template v-if="!cell.empty">
            <header>{{ cell.day }}</header>
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
  min-height: 120px;
  padding: 8px;
  border-right: 1px solid #d8ebef;
  border-bottom: 1px solid #d8ebef;
  background: #fff;
}

.calendar-cell.empty {
  background: #f3fafc;
}

.calendar-cell > header {
  margin-bottom: 6px;
  color: #60716a;
  font-size: 12px;
  font-weight: 700;
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

@media (max-width: 980px) {
  .calendar-card {
    padding: 12px;
  }

  .calendar-cell {
    min-height: 95px;
    padding: 6px;
  }
}
</style>
