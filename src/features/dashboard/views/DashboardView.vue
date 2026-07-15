<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  DASHBOARD_CONTENT_TYPES,
  TRAVEL_PURPOSES,
  getContentTypeDistribution,
  getDashboardPlaces,
  getDashboardSummary,
  getDistrictDistribution,
  getDistrictRecommendations,
} from '../services/api/dashboardApi'

const route = useRoute()
const router = useRouter()
const defaultPurposes = ['sightseeing', 'culture', 'rest']
const validPurposeIds = new Set(TRAVEL_PURPOSES.map((purpose) => purpose.id))

const selectedPurposes = ref([])
const selectedDistrict = ref('')
const keyword = ref('')
const summary = ref({ totalPlaces: 0, totalContentTypes: 0, totalDistricts: 0, filteredPlaces: 0 })
const typeDistribution = ref([])
const districtDistribution = ref([])
const recommendations = ref([])
const places = ref([])
const loadError = ref('')
const mapContainer = ref(null)
const mapInstance = ref(null)
const markerLayer = ref(null)
let resizeObserver = null

const markerColors = {
  12: '#2f855a', 14: '#805ad5', 15: '#dd6b20', 25: '#3182ce',
  28: '#008b8b', 32: '#d53f8c', 38: '#9c6b16',
}

function parsePurposes(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '')
  const parsed = raw.split(',').filter((purpose) => validPurposeIds.has(purpose))
  return parsed.length ? [...new Set(parsed)] : [...defaultPurposes]
}

function applyRouteQuery() {
  selectedPurposes.value = parsePurposes(route.query.purposes)
  selectedDistrict.value = String(route.query.district || '')
  keyword.value = String(route.query.keyword || '')
}

applyRouteQuery()

const filters = computed(() => ({
  purposes: selectedPurposes.value,
  district: selectedDistrict.value,
  keyword: keyword.value,
}))

const maxDistrictCount = computed(() => Math.max(1, ...districtDistribution.value.map((item) => Number(item.count))))
const visiblePlaces = computed(() => places.value.slice(0, 20))
const mappablePlaces = computed(() => places.value.filter((place) => Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude))))

function togglePurpose(purposeId) {
  if (!selectedPurposes.value.includes(purposeId)) {
    selectedPurposes.value = [...selectedPurposes.value, purposeId]
    return
  }

  const nextPurposes = selectedPurposes.value.filter((id) => id !== purposeId)
  selectedPurposes.value = nextPurposes.length
    ? nextPurposes
    : TRAVEL_PURPOSES.map((purpose) => purpose.id)
}

function resetFilters() {
  selectedPurposes.value = [...defaultPurposes]
  selectedDistrict.value = ''
  keyword.value = ''
}

function selectDistrict(district) {
  selectedDistrict.value = selectedDistrict.value === district ? '' : district
}

function loadDashboard() {
  try {
    loadError.value = ''
    summary.value = getDashboardSummary(filters.value)
    typeDistribution.value = getContentTypeDistribution(filters.value)
    districtDistribution.value = getDistrictDistribution(filters.value)
    recommendations.value = getDistrictRecommendations(filters.value)
    places.value = getDashboardPlaces(filters.value)
  } catch (error) {
    loadError.value = `대시보드 데이터를 불러오지 못했습니다: ${error.message}`
  }
}

function syncQuery() {
  const query = {}
  if (selectedPurposes.value.length) query.purposes = selectedPurposes.value.join(',')
  if (selectedDistrict.value) query.district = selectedDistrict.value
  if (keyword.value.trim()) query.keyword = keyword.value.trim()
  const current = new URLSearchParams(route.query).toString()
  const next = new URLSearchParams(query).toString()
  if (current !== next) router.replace({ name: 'dashboard', query })
}

function renderMarkers() {
  if (!mapInstance.value || !markerLayer.value || !window.L) return
  markerLayer.value.clearLayers()
  const latLngs = []

  for (const place of mappablePlaces.value) {
    const latLng = [Number(place.latitude), Number(place.longitude)]
    latLngs.push(latLng)
    const color = markerColors[place.contentTypeId] || '#174f40'
    const marker = window.L.circleMarker(latLng, {
      radius: 6,
      color: '#fff',
      weight: 1.5,
      fillColor: color,
      fillOpacity: 0.9,
    })
    marker.bindPopup(`
      <strong>${place.title}</strong><br>
      <span>${place.contentTypeName} · ${place.district || '지역 미분류'}</span><br>
      <a href="/regions/${place.id}">상세보기</a>
    `)
    markerLayer.value.addLayer(marker)
  }

  if (latLngs.length) {
    mapInstance.value.fitBounds(window.L.latLngBounds(latLngs).pad(0.12), { animate: false, maxZoom: 13 })
  } else {
    mapInstance.value.setView([35.17, 129.07], 10)
  }
}

watch(filters, () => {
  loadDashboard()
  syncQuery()
}, { deep: true, immediate: true })

watch(mappablePlaces, () => nextTick(renderMarkers), { deep: true })

watch(() => route.query, (query) => {
  const routePurposes = parsePurposes(query.purposes)
  const routeDistrict = String(query.district || '')
  const routeKeyword = String(query.keyword || '')
  if (routePurposes.join(',') !== selectedPurposes.value.join(',')) selectedPurposes.value = routePurposes
  if (routeDistrict !== selectedDistrict.value) selectedDistrict.value = routeDistrict
  if (routeKeyword !== keyword.value) keyword.value = routeKeyword
}, { deep: true })

onMounted(() => {
  if (!mapContainer.value || typeof window === 'undefined' || !window.L) return
  mapInstance.value = window.L.map(mapContainer.value, { scrollWheelZoom: true }).setView([35.17, 129.07], 10)
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(mapInstance.value)
  markerLayer.value = window.L.layerGroup().addTo(mapInstance.value)
  renderMarkers()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => mapInstance.value?.invalidateSize())
    resizeObserver.observe(mapContainer.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  mapInstance.value?.remove()
  mapInstance.value = null
  markerLayer.value = null
})
</script>

<template>
  <section class="page-hero dashboard-hero">
    <div class="container">
      <p class="eyebrow">BUSAN TRAVEL GUIDE</p>
      <h1>부산 여행 데이터 대시보드</h1>
      <p>여행 목적에 맞는 지역과 주변 시설을 데이터로 비교해 보세요.</p>
    </div>
  </section>

  <section class="container page-content dashboard-page" aria-labelledby="dashboard-heading">
    <header class="dashboard-heading">
      <div>
        <p class="eyebrow">TRAVEL MATCH</p>
        <h2 id="dashboard-heading">나에게 맞는 부산 찾기</h2>
      </div>
      <RouterLink class="button board-button board-button--outline" to="/regions">전체 시설 탐색</RouterLink>
    </header>

    <section class="dashboard-filters board-card" aria-label="대시보드 필터">
      <fieldset>
        <legend>여행 목적</legend>
        <div class="purpose-list">
          <button
            v-for="purpose in TRAVEL_PURPOSES"
            :key="purpose.id"
            type="button"
            class="purpose-chip"
            :class="{ active: selectedPurposes.includes(purpose.id) }"
            :aria-pressed="selectedPurposes.includes(purpose.id)"
            @click="togglePurpose(purpose.id)"
          >{{ purpose.name }}</button>
        </div>
      </fieldset>
      <label>
        <span>시설명 또는 주소</span>
        <input v-model="keyword" class="board-control" type="search" placeholder="예: 해운대, 박물관" />
      </label>
      <button class="button board-button board-button--outline" type="button" @click="resetFilters">필터 초기화</button>
    </section>

    <p v-if="loadError" class="empty-state" role="alert">{{ loadError }}</p>

    <template v-else>
      <section class="summary-grid" aria-label="관광 데이터 요약">
        <article class="summary-card board-card"><span>전체 시설</span><strong>{{ Number(summary.totalPlaces).toLocaleString() }}</strong></article>
        <article class="summary-card board-card"><span>콘텐츠 유형</span><strong>{{ summary.totalContentTypes }}</strong></article>
        <article class="summary-card board-card"><span>분류된 구·군</span><strong>{{ summary.totalDistricts }}</strong></article>
        <article class="summary-card board-card accent"><span>현재 조건</span><strong>{{ Number(summary.filteredPlaces).toLocaleString() }}</strong></article>
      </section>

      <section class="dashboard-section" aria-labelledby="recommendation-title">
        <div class="section-title">
          <div><p class="eyebrow">RECOMMENDED DISTRICTS</p><h2 id="recommendation-title">여행 조건과 잘 맞는 지역</h2></div>
          <p>시설별 최대 분포를 기준으로 계산한 조건 일치도이며 인기 순위가 아닙니다.</p>
        </div>
        <div v-if="recommendations.length" class="recommendation-grid">
          <article v-for="(item, index) in recommendations" :key="item.district" class="recommendation-card board-card">
            <header><span>{{ index + 1 }}</span><div><h3>{{ item.district }}</h3><p>조건 일치도 {{ item.matchRate }}%</p></div></header>
            <div class="match-meter"><span :style="{ width: `${item.matchRate}%` }"></span></div>
            <ul class="count-tags">
              <li v-for="count in item.counts" :key="count.contentTypeId">{{ count.name }} {{ count.count }}</li>
            </ul>
            <p class="representative-title">대표 시설</p>
            <RouterLink v-for="place in item.representativePlaces" :key="place.id" :to="`/regions/${place.id}`" class="place-link">{{ place.title }}</RouterLink>
            <button class="district-select" type="button" @click="selectDistrict(item.district)">{{ item.district }}만 보기</button>
          </article>
        </div>
        <p v-else class="empty-state board-card">조건에 맞는 추천 지역이 없습니다.</p>
      </section>

      <div class="analytics-grid">
        <section class="dashboard-section chart-card board-card" aria-labelledby="district-chart-title">
          <div class="chart-heading"><h2 id="district-chart-title">구·군별 시설 분포</h2><button v-if="selectedDistrict" type="button" @click="selectedDistrict = ''">{{ selectedDistrict }} 선택 해제</button></div>
          <div v-if="districtDistribution.length" class="bar-chart">
            <button v-for="item in districtDistribution" :key="item.district" type="button" :class="{ active: selectedDistrict === item.district }" @click="selectDistrict(item.district)">
              <span class="bar-label">{{ item.district }}</span>
              <span class="bar-track"><span :style="{ width: `${Number(item.count) / maxDistrictCount * 100}%` }"></span></span>
              <strong>{{ item.count }}</strong>
            </button>
          </div>
          <p v-else class="empty-state">표시할 지역 데이터가 없습니다.</p>
        </section>

        <section class="dashboard-section chart-card board-card" aria-labelledby="type-chart-title">
          <h2 id="type-chart-title">유형별 시설 구성</h2>
          <div class="type-list">
            <div v-for="item in typeDistribution" :key="item.id"><span :style="{ background: markerColors[item.id] }"></span><p>{{ item.name }}</p><strong>{{ item.count }}</strong></div>
          </div>
        </section>
      </div>

      <section class="dashboard-section map-card dashboard-map-card" aria-labelledby="dashboard-map-title">
        <div class="map-header"><div><p class="eyebrow">LOCATION</p><h2 id="dashboard-map-title">조건에 맞는 시설 위치</h2></div><span>{{ mappablePlaces.length.toLocaleString() }}개 표시</span></div>
        <div class="map-legend" aria-label="시설 유형 범례"><span v-for="type in DASHBOARD_CONTENT_TYPES" :key="type.id"><i :style="{ background: markerColors[type.id] }"></i>{{ type.name }}</span></div>
        <div ref="mapContainer" class="map-frame dashboard-map"></div>
      </section>

      <section class="dashboard-section board-card place-results" aria-labelledby="place-results-title">
        <div class="chart-heading"><h2 id="place-results-title">추천 시설</h2><span>최대 20개 표시</span></div>
        <div v-if="visiblePlaces.length" class="place-grid">
          <RouterLink v-for="place in visiblePlaces" :key="place.id" :to="`/regions/${place.id}`" class="place-item">
            <div class="place-thumb"><img v-if="place.image" :src="place.image" :alt="`${place.title} 이미지`" loading="lazy" /><span v-else>NO IMAGE</span></div>
            <div><span class="board-badge">{{ place.contentTypeName }}</span><h3>{{ place.title }}</h3><p>{{ place.district || '지역 미분류' }} · {{ place.address || '주소 정보 없음' }}</p></div>
          </RouterLink>
        </div>
        <p v-else class="empty-state">조건에 맞는 시설이 없습니다.</p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.dashboard-page { max-width: 1120px; }
.dashboard-heading, .section-title, .chart-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; }
.dashboard-heading { margin-bottom: 24px; }
.dashboard-heading h2, .section-title h2, .chart-card h2, .place-results h2 { margin: 0; color: var(--green); font-size: clamp(22px, 3vw, 32px); }
.dashboard-filters { display: grid; grid-template-columns: 1.5fr 1fr auto; align-items: end; gap: 20px; padding: 20px; }
.dashboard-filters fieldset { min-width: 0; padding: 0; border: 0; }
.dashboard-filters legend, .dashboard-filters label span { display: block; margin-bottom: 9px; color: var(--green); font-size: 13px; font-weight: 700; }
.purpose-list { display: flex; flex-wrap: wrap; gap: 8px; }
.purpose-chip { min-height: 42px; padding: 0 16px; color: var(--green); border: 1px solid #c9d5cd; border-radius: 999px; background: white; cursor: pointer; font-weight: 700; }
.purpose-chip.active { color: white; border-color: var(--green); background: var(--green); }
.summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 22px; }
.summary-card { padding: 22px; }
.summary-card span { color: #758079; font-size: 13px; }
.summary-card strong { display: block; margin-top: 7px; color: var(--green); font-size: 30px; }
.summary-card.accent { background: var(--green); }
.summary-card.accent span, .summary-card.accent strong { color: white; }
.dashboard-section { margin-top: 36px; }
.section-title > p { max-width: 440px; margin: 0; color: #758079; font-size: 12px; line-height: 1.6; text-align: right; }
.recommendation-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 18px; }
.recommendation-card { padding: 22px; }
.recommendation-card header { display: flex; align-items: center; gap: 12px; }
.recommendation-card header > span { display: grid; place-items: center; width: 36px; height: 36px; color: white; border-radius: 50%; background: var(--orange); font-weight: 700; }
.recommendation-card h3 { margin: 0; color: var(--green); font-size: 20px; }
.recommendation-card header p { margin: 3px 0 0; color: #758079; font-size: 12px; }
.match-meter { height: 7px; margin: 17px 0; overflow: hidden; border-radius: 8px; background: #e9eeea; }
.match-meter span { display: block; height: 100%; background: var(--orange); }
.count-tags { display: flex; flex-wrap: wrap; gap: 6px; padding: 0; list-style: none; }
.count-tags li { padding: 5px 8px; color: #54625b; border-radius: 5px; background: #f0f4ef; font-size: 11px; }
.representative-title { margin: 18px 0 8px; color: var(--green); font-size: 12px; font-weight: 700; }
.place-link { display: block; overflow: hidden; margin: 6px 0; color: #59665f; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.place-link:hover { color: var(--orange); }
.district-select { width: 100%; margin-top: 14px; padding: 10px; color: var(--green); border: 1px solid #c5d4ca; border-radius: 7px; background: white; cursor: pointer; font-weight: 700; }
.analytics-grid { display: grid; grid-template-columns: 1.5fr .8fr; gap: 18px; }
.chart-card { padding: 22px; }
.chart-card h2, .place-results h2 { font-size: 21px; }
.chart-heading button { padding: 6px 10px; color: var(--orange); border: 0; background: transparent; cursor: pointer; font-weight: 700; }
.bar-chart { display: grid; gap: 10px; margin-top: 20px; }
.bar-chart button { display: grid; grid-template-columns: 72px 1fr 34px; align-items: center; gap: 10px; padding: 5px; border: 0; border-radius: 6px; background: transparent; cursor: pointer; }
.bar-chart button:hover, .bar-chart button.active { background: #f1f5f1; }
.bar-label { color: #53615a; font-size: 12px; text-align: left; }
.bar-track { height: 12px; overflow: hidden; border-radius: 8px; background: #e9eeea; }
.bar-track span { display: block; height: 100%; border-radius: inherit; background: var(--green); }
.bar-chart strong { color: var(--green); font-size: 12px; }
.type-list { display: grid; gap: 12px; margin-top: 20px; }
.type-list div { display: grid; grid-template-columns: 10px 1fr auto; align-items: center; gap: 9px; padding-bottom: 10px; border-bottom: 1px solid #edf0ed; }
.type-list div > span { width: 10px; height: 10px; border-radius: 50%; }
.type-list p { margin: 0; color: #59665f; font-size: 13px; }
.type-list strong { color: var(--green); }
.dashboard-map-card { padding: 24px; }
.map-legend { display: flex; flex-wrap: wrap; gap: 8px 15px; margin-bottom: 14px; color: #64716a; font-size: 11px; }
.map-legend span { display: inline-flex; align-items: center; gap: 5px; }
.map-legend i { width: 9px; height: 9px; border-radius: 50%; }
.dashboard-map { height: 440px; }
.place-results { padding: 24px; }
.place-results .chart-heading > span { color: #758079; font-size: 12px; }
.place-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 18px; }
.place-item { display: grid; grid-template-columns: 104px 1fr; gap: 14px; min-width: 0; padding: 12px; border: 1px solid #e0e7e1; border-radius: 9px; }
.place-item:hover { border-color: var(--orange); }
.place-thumb { display: grid; place-items: center; height: 90px; overflow: hidden; color: #9aa39e; border-radius: 7px; background: #eef2ed; font-size: 9px; }
.place-thumb img { width: 100%; height: 100%; object-fit: cover; }
.place-item h3 { overflow: hidden; margin: 8px 0 5px; color: var(--green); font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
.place-item p { margin: 0; color: #758079; font-size: 11px; line-height: 1.5; }
@media (max-width: 900px) {
  .dashboard-filters, .analytics-grid { grid-template-columns: 1fr; }
  .summary-grid, .recommendation-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 650px) {
  .dashboard-heading, .section-title { align-items: stretch; flex-direction: column; }
  .section-title > p { text-align: left; }
  .summary-grid, .recommendation-grid, .place-grid { grid-template-columns: 1fr; }
  .dashboard-map { height: 360px; }
  .place-item { grid-template-columns: 86px 1fr; }
}
</style>
