<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { regionCategories } from '../data/regionCategories'
import tourismData from '../../../../data/부산_관광지.json'
import leisureData from '../../../../data/부산_레포츠.json'
import cultureData from '../../../../data/부산_문화시설.json'
import shoppingData from '../../../../data/부산_쇼핑.json'
import lodgingData from '../../../../data/부산_숙박.json'
import courseData from '../../../../data/부산_여행코스.json'
import festivalData from '../../../../data/부산_축제공연행사.json'

const query = ref('')
const selectedCategory = ref('관광지')
const mapContainer = ref(null)
const mapInstance = ref(null)
const markerLayer = ref(null)

const categoryDataMap = {
  관광지: tourismData,
  레포츠: leisureData,
  문화시설: cultureData,
  쇼핑: shoppingData,
  숙박: lodgingData,
  여행코스: courseData,
  '축제·공연': festivalData,
  축제공연행사: festivalData,
}

const filteredCategories = computed(() => {
  const search = query.value.trim()
  return regionCategories.filter(
    (item) =>
      Object.keys(categoryDataMap).includes(item.name) &&
      item.name.includes(search)
  )
})

const activeItems = computed(() => {
  const source = categoryDataMap[selectedCategory.value]
  return source?.items || []
})

const selectedId = ref('')

watch(
  activeItems,
  (items) => {
    if (!items.length) return
    if (!items.some((item) => item.contentid === selectedId.value)) {
      selectedId.value = items[0].contentid
    }
  },
  { immediate: true }
)

const selectedItem = computed(() => {
  return (
    activeItems.value.find((item) => item.contentid === selectedId.value) ||
    activeItems.value[0] ||
    null
  )
})

const createMarkerIcon = (isSelected) => {
  if (typeof window === 'undefined' || !window.L) return null
  return window.L.divIcon({
    html: `<div style="width:14px;height:14px;border-radius:999px;border:2px solid white;background:${isSelected ? '#e86f42' : '#174f40'};box-shadow:0 4px 10px rgba(0,0,0,0.25);"></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

const renderMarkers = () => {
  if (!mapInstance.value || !markerLayer.value || typeof window === 'undefined' || !window.L) return

  markerLayer.value.clearLayers()

  const markers = activeItems.value.map((item) => {
    const marker = window.L.marker([Number(item.mapy), Number(item.mapx)], {
      title: item.title,
      icon: createMarkerIcon(item.contentid === selectedItem.value?.contentid),
      riseOnHover: true,
    })

    marker.on('click', () => {
      selectedId.value = item.contentid
    })

    marker.bindPopup(`<strong>${item.title}</strong><br>${item.addr1}`)
    return marker
  })

  markers.forEach((marker) => markerLayer.value.addLayer(marker))

  if (markers.length) {
    const bounds = window.L.latLngBounds(markers.map((marker) => marker.getLatLng()))
    mapInstance.value.fitBounds(bounds.pad(0.2))
  }
}

watch(
  activeItems,
  () => {
    renderMarkers()
  },
  { deep: true }
)

watch(selectedItem, () => {
  renderMarkers()
})

const selectCategory = (name) => {
  selectedCategory.value = name
}

onMounted(() => {
  if (!mapContainer.value || typeof window === 'undefined' || !window.L) return

  mapInstance.value = window.L
    .map(mapContainer.value, {
      zoomControl: true,
      scrollWheelZoom: true,
    })
    .setView([35.17, 129.07], 10)

  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(mapInstance.value)

  markerLayer.value = window.L.layerGroup()
  markerLayer.value.addTo(mapInstance.value)

  renderMarkers()
})

onBeforeUnmount(() => {
  if (mapInstance.value) {
    mapInstance.value.remove()
    mapInstance.value = null
  }
  markerLayer.value = null
})
</script>

<template>
  <section class="page-hero region-hero">
    <div class="container">
      <p class="eyebrow">EXPLORE BUSAN</p>
      <h1>권역 정보</h1>
      <p>관광지, 레포츠, 문화시설, 쇼핑, 숙박, 여행코스, 축제·공연 데이터를 지도 위에 바로 표시해보세요.</p>
      <label class="search-box">
        <span class="sr-only">분류 검색</span>
        <input v-model="query" type="search" placeholder="어떤 정보를 찾고 계신가요?" />
        <span aria-hidden="true">⌕</span>
      </label>
    </div>
  </section>

  <section class="container page-content">
    <div class="region-grid">
      <button
        v-for="item in filteredCategories"
        :key="item.name"
        type="button"
        class="region-card"
        :class="{ active: selectedCategory === item.name }"
        @click="selectCategory(item.name)"
      >
        <span class="service-icon">{{ item.icon }}</span>
        <div>
          <h2>{{ item.name }}</h2>
          <p>{{ item.description }}</p>
        </div>
        <strong>{{ item.count.toLocaleString() }}곳</strong>
      </button>
    </div>

    <div v-if="filteredCategories.length" class="map-panel">
      <div class="map-card">
        <div class="map-header">
          <div>
            <p class="eyebrow">LIVE MAP</p>
            <h2>{{ selectedCategory }} 샘플 마커</h2>
          </div>
          <span>{{ activeItems.length }}개 표시</span>
        </div>

        <div ref="mapContainer" class="map-frame"></div>
      </div>

      <aside class="map-detail-card">
        <p class="eyebrow">SELECTED</p>
        <h2>{{ selectedItem?.title || '마커를 선택해 주세요' }}</h2>
        <p>{{ selectedItem?.addr1 || '지도를 눌러서 상세 정보를 확인해보세요.' }}</p>
        <ul v-if="selectedItem">
          <li><strong>주소</strong><span>{{ selectedItem.addr1 }}</span></li>
          <li><strong>좌표</strong><span>{{ selectedItem.mapy }}, {{ selectedItem.mapx }}</span></li>
        </ul>
      </aside>
    </div>

    <p v-if="!filteredCategories.length" class="empty-state">일치하는 분류가 없습니다.</p>
    <p class="source-note">데이터 출처: 한국관광공사 TourAPI 4.0 · 공공누리 제3유형</p>
  </section>
</template>