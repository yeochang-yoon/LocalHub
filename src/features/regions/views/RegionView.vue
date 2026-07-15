<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { regionCategories } from '../data/regionCategories'
import { buildRegionDetailItems } from '../utils/regionDetailDisplay'
import { getChatbotPlacesByContentType, getRegionCategorySummaries } from '../../chatbot/services/chatbotDatabase'

const query = ref('')
const selectedCategory = ref('관광지')
const mapContainer = ref(null)
const mapInstance = ref(null)
const markerLayer = ref(null)

// contentid -> Leaflet marker 캐시 (선택 변경 시 재생성하지 않기 위함)
const markerMap = new Map()

// 카테고리 전환에 의한 재렌더링 중인지 여부 (이때는 panTo 하지 않음)
let isRendering = false
let resizeObserver = null
let canvasRenderer = null

const regionCategoryList = ref(regionCategories.map((item) => ({ ...item, count: 0 })))
const activeItems = ref([])

const filteredCategories = computed(() => {
  const search = query.value.trim()
  return regionCategoryList.value.filter((item) => item.name.includes(search))
})

const selectedId = ref('')
const selectedItem = computed(() => {
  return (
    activeItems.value.find((item) => item.contentid === selectedId.value) ||
    activeItems.value[0] ||
    null
  )
})
const detailItems = computed(() => buildRegionDetailItems(selectedItem.value, selectedCategory.value))

const MIN_RADIUS = 4
const MAX_RADIUS = 11

const radiusForZoom = (zoom) => {
  const z = typeof zoom === 'number' ? zoom : 10
  const r = (z - 8) * 1.25 + 5
  return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, r))
}

const markerStyle = (isSelected, zoom) => {
  const r = radiusForZoom(zoom)
  return {
    radius: isSelected ? r + 2 : r,
    color: '#fff',
    weight: r >= 7 ? 2 : 1,
    opacity: 1,
    fillColor: isSelected ? '#ff7052' : '#087fa7',
    fillOpacity: 1,
  }
}

const refreshMarkerSizes = () => {
  if (!mapInstance.value) return
  const zoom = mapInstance.value.getZoom()
  const selected = selectedItem.value?.contentid
  markerMap.forEach((marker, id) => {
    marker.setStyle(markerStyle(id === selected, zoom))
  })
}

const renderMarkers = () => {
  if (!mapInstance.value || !markerLayer.value || typeof window === 'undefined' || !window.L) return

  isRendering = true
  markerLayer.value.clearLayers()
  markerMap.clear()

  const zoom = mapInstance.value.getZoom()

  const markers = activeItems.value.map((item) => {
    const marker = window.L.circleMarker(
      [Number(item.mapy), Number(item.mapx)],
      {
        ...markerStyle(item.contentid === selectedItem.value?.contentid, zoom),
        renderer: canvasRenderer,
        interactive: true,
        bubblingMouseEvents: false,
      }
    )

    marker.on('click', () => {
      selectedId.value = item.contentid
    })

    marker.bindPopup(`<strong>${item.title}</strong><br>${item.addr1}`, {
      autoPan: false,
      closeButton: true,
    })

    markerMap.set(item.contentid, marker)
    return marker
  })

  markers.forEach((marker) => markerLayer.value.addLayer(marker))
  mapInstance.value.closePopup()

  if (markers.length) {
    const bounds = window.L.latLngBounds(markers.map((marker) => marker.getLatLng()))
    mapInstance.value.fitBounds(bounds.pad(0.2), { animate: false })
  }

  isRendering = false
  refreshMarkerSizes()
}

const updateSelectedMarkerStyle = (newId, oldId) => {
  if (!mapInstance.value) return
  const zoom = mapInstance.value.getZoom()

  const oldMarker = markerMap.get(oldId)
  if (oldMarker) oldMarker.setStyle(markerStyle(false, zoom))

  const newMarker = markerMap.get(newId)
  if (!newMarker) return

  newMarker.setStyle(markerStyle(true, zoom))
  newMarker.bringToFront()

  if (isRendering) return

  mapInstance.value.panTo(newMarker.getLatLng(), {
    animate: true,
    duration: 0.45,
    easeLinearity: 0.25,
  })
}

function loadItemsByCategory(name) {
  const category = regionCategoryList.value.find((item) => item.name === name)
  if (!category) {
    activeItems.value = []
    renderMarkers()
    return
  }

  activeItems.value = getChatbotPlacesByContentType(category.contentTypeId)
  renderMarkers()
}

function loadCategoryCounts() {
  const summaries = getRegionCategorySummaries()
  regionCategoryList.value = regionCategories.map((item) => ({
    ...item,
    count: summaries.find((summary) => summary.name === item.name)?.count ?? 0,
  }))
}

watch(
  activeItems,
  (items) => {
    if (!items.length) {
      renderMarkers()
      return
    }

    if (!items.some((item) => item.contentid === selectedId.value)) {
      selectedId.value = items[0].contentid
    }

    renderMarkers()
  },
  { immediate: true, flush: 'post' }
)

watch(
  () => selectedItem.value?.contentid,
  (newId, oldId) => {
    updateSelectedMarkerStyle(newId, oldId)
  },
  { flush: 'post' }
)

watch(selectedCategory, () => {
  loadItemsByCategory(selectedCategory.value)
})

const selectCategory = (name) => {
  if (selectedCategory.value === name) return
  selectedCategory.value = name
}

onMounted(() => {
  if (!mapContainer.value || typeof window === 'undefined' || !window.L) return

  mapInstance.value = window.L
    .map(mapContainer.value, {
      zoomControl: true,
      scrollWheelZoom: true,
      zoomAnimation: true,
      markerZoomAnimation: true,
    })
    .setView([35.17, 129.07], 10)

  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(mapInstance.value)

  canvasRenderer = window.L.canvas({ padding: 0.5 })

  markerLayer.value = window.L.layerGroup()
  markerLayer.value.addTo(mapInstance.value)

  mapInstance.value.on('zoomend', refreshMarkerSizes)

  loadCategoryCounts()
  loadItemsByCategory(selectedCategory.value)
  renderMarkers()

  nextTick(() => mapInstance.value?.invalidateSize())

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      mapInstance.value?.invalidateSize()
    })
    resizeObserver.observe(mapContainer.value)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (mapInstance.value) {
    mapInstance.value.off('zoomend', refreshMarkerSizes)
    mapInstance.value.remove()
    mapInstance.value = null
  }
  markerLayer.value = null
  markerMap.clear()
})
</script>

<template>
  <section class="page-hero region-hero">
    <div class="container">
      <p class="eyebrow">EXPLORE BUSAN</p>
      <h1><span class="title-emoji" aria-hidden="true">🗺️</span> 권역 정보</h1>
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

      <aside class="map-detail-card detail-panel">
        <p class="eyebrow">SELECTED</p>
        <h2>{{ selectedItem?.title || '마커를 선택해 주세요' }}</h2>
        <p class="detail-description">
          {{ selectedItem ? '선택한 권역 정보를 상세하게 확인해보세요.' : '지도를 눌러서 상세 정보를 확인해보세요.' }}
        </p>
        <ul v-if="detailItems.length">
          <li v-for="item in detailItems" :key="item.label">
            <strong>{{ item.label }}</strong>
            <span>{{ item.value }}</span>
          </li>
        </ul>
        <RouterLink
          v-if="selectedItem"
          class="button board-button board-button--secondary region-detail-link"
          :to="{ name: 'region-detail', params: { contentId: selectedItem.contentid } }"
        >
          상세페이지 보기
        </RouterLink>
      </aside>
    </div>

    <p v-if="!filteredCategories.length" class="empty-state">일치하는 분류가 없습니다.</p>
    <p class="source-note">데이터 출처: 한국관광공사 TourAPI 4.0 · 공공누리 제3유형</p>
  </section>
</template>

<style>
.leaflet-container * {
  transition: none;
}

.leaflet-zoom-anim .leaflet-zoom-animated {
  transition: transform 0.25s cubic-bezier(0, 0, 0.25, 1) !important;
  will-change: transform;
}

.map-panel {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 20px;
  align-items: stretch;
}

.map-card,
.map-detail-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.map-frame {
  flex: 1;
  min-height: 420px;
}

.map-detail-card {
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  flex-direction: column;
  height: 100%;
  gap: 12px;
  padding: 20px;
  overflow: hidden;        
}

.map-detail-card h2 {
  margin: 0;
  font-size: 20px;
  line-height: 1.3;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.map-detail-card p,
.map-detail-card li {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.map-detail-card ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.map-detail-card li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.map-detail-card li strong {
  color: var(--green);
  flex-shrink: 0;          
}

.map-detail-card li span {
  text-align: right;
  min-width: 0;            
}


.region-detail-link {
  margin-top: 8px;
}
</style>
