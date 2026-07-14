<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
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

// contentid -> Leaflet marker 캐시 (선택 변경 시 재생성하지 않기 위함)
const markerMap = new Map()

// 카테고리 전환에 의한 재렌더링 중인지 여부 (이때는 panTo 하지 않음)
let isRendering = false
let resizeObserver = null
let canvasRenderer = null

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

// 줌 레벨 → 마커 반지름(px)
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
    fillColor: isSelected ? '#e86f42' : '#174f40',
    fillOpacity: 1,
  }
}

/**
 * 줌이 끝난 뒤 반지름/색상만 갱신.
 * canvas 렌더러라 DOM 재생성이 없어 수백~수천 개여도 프레임 드랍이 없다.
 */
const refreshMarkerSizes = () => {
  if (!mapInstance.value) return
  const zoom = mapInstance.value.getZoom()
  const selected = selectedItem.value?.contentid
  markerMap.forEach((marker, id) => {
    marker.setStyle(markerStyle(id === selected, zoom))
  })
}

/**
 * 카테고리(=마커 목록)가 바뀔 때만 호출.
 * 마커를 새로 그리고, 이때만 fitBounds로 화면을 맞춘다.
 */
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
        renderer: canvasRenderer, // canvas에 그리므로 마커당 DOM 노드가 생기지 않는다
        interactive: true,
        bubblingMouseEvents: false,
      }
    )

    marker.on('click', () => {
      // 시점 변경 없이 선택 상태만 변경
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

  // 이전 카테고리에서 열려 있던 팝업 정리
  mapInstance.value.closePopup()

  if (markers.length) {
    const bounds = window.L.latLngBounds(markers.map((marker) => marker.getLatLng()))
    mapInstance.value.fitBounds(bounds.pad(0.2), { animate: false })
  }

  isRendering = false

  // fitBounds로 줌이 바뀐 경우를 대비해 크기 동기화
  refreshMarkerSizes()
}

/**
 * 선택이 바뀔 때는 마커를 다시 만들지 않고 아이콘만 교체.
 * 줌 레벨은 그대로 두고, 선택한 마커로만 부드럽게 팬(pan)한다.
 */
const updateSelectedMarkerStyle = (newId, oldId) => {
  if (!mapInstance.value) return
  const zoom = mapInstance.value.getZoom()

  const oldMarker = markerMap.get(oldId)
  if (oldMarker) oldMarker.setStyle(markerStyle(false, zoom))

  const newMarker = markerMap.get(newId)
  if (!newMarker) return

  newMarker.setStyle(markerStyle(true, zoom))
  newMarker.bringToFront()

  // 카테고리 전환으로 인한 자동 선택일 때는 이동시키지 않는다(fitBounds가 이미 처리).
  if (isRendering) return

  // 줌 레벨 유지 + 부드러운 이동
  mapInstance.value.panTo(newMarker.getLatLng(), {
    animate: true,
    duration: 0.45,
    easeLinearity: 0.25,
  })
}

// 마커 목록(=카테고리) 자체가 바뀔 때만 재렌더링 + fitBounds.
// flush: 'post' → selectedId 리셋 등 다른 watch가 모두 끝난 뒤에 실행되므로
// 새 카테고리의 선택 상태가 정확히 반영된 채로 마커가 그려진다.
watch(
  activeItems,
  () => {
    renderMarkers()
  },
  { flush: 'post' }
)

// 선택만 바뀔 때는 아이콘 색상만 교체 (지도 시점 그대로 유지)
watch(
  () => selectedItem.value?.contentid,
  (newId, oldId) => {
    updateSelectedMarkerStyle(newId, oldId)
  },
  { flush: 'post' }
)

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

  // 마커를 DOM이 아닌 단일 canvas에 그린다 → 줌/팬 시 렉 제거
  canvasRenderer = window.L.canvas({ padding: 0.5 })

  markerLayer.value = window.L.layerGroup()
  markerLayer.value.addTo(mapInstance.value)

  // 줌이 끝날 때마다 아이콘 크기 재계산 (줌 중에는 건드리지 않아 어긋남 없음)
  mapInstance.value.on('zoomend', refreshMarkerSizes)

  renderMarkers()

  // 컨테이너 크기가 초기화 이후에 바뀌면 Leaflet 내부 좌표계가 어긋나
  // 줌할 때 마커가 타일과 따로 노는 현상이 생긴다 → invalidateSize로 재계산
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

<style>
/* Leaflet의 줌 애니메이션은 .leaflet-zoom-animated의 CSS transform 전환에 의존한다.
   전역 CSS(* { transition: ... })가 이를 덮으면 줌이 끊겨 보이므로,
   Leaflet 내부 요소는 전역 전환 효과에서 제외하되 Leaflet 자체 애니메이션은 살려 둔다. */
.leaflet-container * {
  transition: none;
}

.leaflet-zoom-anim .leaflet-zoom-animated {
  transition: transform 0.25s cubic-bezier(0, 0, 0.25, 1) !important;
  will-change: transform;
}

.map-frame {
  min-height: 420px;
}
</style>