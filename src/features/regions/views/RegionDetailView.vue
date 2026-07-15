<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { queryDatabase } from '@/features/chatbot/services/chatbotDatabase'
import { getPostsByContentId } from '@/features/board/services/boardStorage'
import { formatPostDate } from '@/features/board/utils/boardDate'
import { getGooglePlaceDetails } from '../services/googlePlaceDetails'
import { getRegionImagesByContentId } from '../services/regionImageIndex'

const route = useRoute()
const router = useRouter()

const mapContainer = ref(null)
const mapInstance = ref(null)
const mapMarker = ref(null)

const isLoading = ref(false)
const loadError = ref('')
const content = ref(null)
const currentPageUrl = ref('')
const shareFeedback = ref('')
const isShareError = ref(false)
const isSharePopupOpen = ref(false)
const relatedPosts = ref([])
const carouselImages = ref([])
const activeCarouselIndex = ref(0)
const isLightboxOpen = ref(false)
const googlePlace = ref(null)
const isGooglePlaceLoading = ref(false)
let carouselTimer = null

const contentId = computed(() => String(route.params.contentId ?? '').trim())
const shouldShowCalendarBackButton = computed(() => route.query.from === 'calendar')
const heroTitle = computed(() => content.value?.contentType || '권역상세')
const categoryDescriptionMap = regionCategories.reduce((accumulator, item) => {
  accumulator[item.name] = item.description
  return accumulator
}, {})
categoryDescriptionMap.축제공연행사 = categoryDescriptionMap['축제·공연']

const heroDescription = computed(() => {
  const contentType = content.value?.contentType
  if (!contentType) return '지도와 콘텐츠 상세 정보를 함께 확인할 수 있습니다.'
  return categoryDescriptionMap[contentType] || '지도와 콘텐츠 상세 정보를 함께 확인할 수 있습니다.'
})
const shareText = computed(() => `${content.value?.title || '부산 권역상세'} | LocalHub`)
const readableDateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function formatContentDate(value, fallback = '-') {
  const text = String(value ?? '').trim()
  if (!text) return fallback

  const compactDateTimeMatch = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  if (compactDateTimeMatch) {
    const [, yearText, monthText, dayText, hourText, minuteText, secondText] = compactDateTimeMatch
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

    return isValid ? readableDateTimeFormatter.format(date) : fallback
  }

  const timestamp = Date.parse(text)
  if (!Number.isFinite(timestamp)) return fallback
  return readableDateTimeFormatter.format(new Date(timestamp))
}

function formatBusinessStatus(value) {
  return ({
    OPERATIONAL: '영업 중',
    CLOSED_TEMPORARILY: '임시 휴업',
    CLOSED_PERMANENTLY: '폐업',
  })[value] || '상태 정보 없음'
}

function loadContentDetail() {
  loadError.value = ''
  content.value = null

  if (!contentId.value) {
    loadError.value = '잘못된 콘텐츠 ID입니다.'
    return
  }

  isLoading.value = true
  try {
    const [row] = queryDatabase(
      `
      SELECT
        p.id,
        ct.name AS contentType,
        p.title,
        p.created_at AS createdAt,
        p.modified_at AS modifiedAt,
        COALESCE(a.address1, '') AS address1,
        COALESCE(a.address2, '') AS address2,
        COALESCE(a.zipcode, '') AS zipcode,
        COALESCE(c.telephone, '') AS telephone,
        COALESCE(i.url, it.url, '') AS image,
        co.latitude AS latitude,
        co.longitude AS longitude
      FROM places p
      JOIN content_types ct ON ct.id = p.content_type_id
      LEFT JOIN place_addresses a ON a.place_id = p.id
      LEFT JOIN place_contacts c ON c.place_id = p.id
      LEFT JOIN place_images i ON i.place_id = p.id AND i.kind = 'original'
      LEFT JOIN place_images it ON it.place_id = p.id AND it.kind = 'thumbnail'
      LEFT JOIN place_coordinates co ON co.place_id = p.id
      WHERE p.id = ?
      LIMIT 1
      `,
      [contentId.value]
    )

    if (row) {
      const [fallbackImage = ''] = getRegionImagesByContentId(row.id)
      content.value = { ...row, image: row.image || fallbackImage }
    } else {
      content.value = null
    }
  } catch (error) {
    loadError.value = `콘텐츠 조회 중 오류가 발생했습니다: ${error.message}`
  } finally {
    isLoading.value = false
  }
}

function loadRelatedPosts() {
  relatedPosts.value = getPostsByContentId(contentId.value)
}

function stopCarousel() {
  if (carouselTimer) clearInterval(carouselTimer)
  carouselTimer = null
}

function startCarousel() {
  stopCarousel()
  if (isLightboxOpen.value || carouselImages.value.length < 2) return
  carouselTimer = setInterval(() => {
    activeCarouselIndex.value = (activeCarouselIndex.value + 1) % carouselImages.value.length
  }, 5000)
}

function moveCarousel(offset) {
  const count = carouselImages.value.length
  if (!count) return
  activeCarouselIndex.value = (activeCarouselIndex.value + offset + count) % count
  startCarousel()
}

function selectCarouselImage(index) {
  activeCarouselIndex.value = index
  startCarousel()
}

function openLightbox() {
  if (!carouselImages.value.length) return
  isLightboxOpen.value = true
  stopCarousel()
  if (typeof document !== 'undefined') document.body.style.overflow = 'hidden'
}

function closeLightbox() {
  isLightboxOpen.value = false
  if (typeof document !== 'undefined') document.body.style.overflow = ''
  startCarousel()
}

function handleCarouselKeydown(event) {
  if (!isLightboxOpen.value) return
  if (event.key === 'Escape') closeLightbox()
  else if (event.key === 'ArrowLeft') moveCarousel(-1)
  else if (event.key === 'ArrowRight') moveCarousel(1)
}

async function loadCarouselImages() {
  const target = content.value
  const targetId = String(target?.id || '')
  activeCarouselIndex.value = 0
  const tourImages = target ? getRegionImagesByContentId(targetId) : []
  if (target?.image && !tourImages.includes(target.image)) tourImages.unshift(target.image)
  carouselImages.value = tourImages.map((url, index) => ({
    id: `tour-${targetId}-${index}`,
    url,
    alt: `${target.title} 사진 ${index + 1}`,
    source: '한국관광공사',
    attributions: [],
  }))
  googlePlace.value = null
  isGooglePlaceLoading.value = Boolean(target)
  startCarousel()
  if (!target) {
    isGooglePlaceLoading.value = false
    return
  }

  try {
    const details = await getGooglePlaceDetails(target)
    if (String(content.value?.id || '') !== targetId) return
    googlePlace.value = details
    const googleImages = details?.photos || []
    const knownUrls = new Set(carouselImages.value.map((image) => image.url))
    carouselImages.value = [...carouselImages.value, ...googleImages.filter((image) => !knownUrls.has(image.url))]
    startCarousel()
  } catch {
    // Google Places를 사용할 수 없으면 TourAPI 대표 이미지만 표시합니다.
  } finally {
    if (String(content.value?.id || '') === targetId) isGooglePlaceLoading.value = false
  }
}

function handleStorageChange(event) {
  if (!event.key || event.key === 'localhub-board-posts') loadRelatedPosts()
}

function setShareFeedbackMessage(message, isError = false) {
  shareFeedback.value = message
  isShareError.value = isError
}

function syncCurrentPageUrl() {
  if (typeof window === 'undefined') return
  currentPageUrl.value = window.location.href
}

function toggleSharePopup() {
  isSharePopupOpen.value = !isSharePopupOpen.value
}

function goBackToCalendar() {
  const query = {}

  if (route.query.year) query.year = route.query.year
  if (route.query.month) query.month = route.query.month

  router.push({ name: 'calendar', query })
}

function openSocialShare(platform) {
  if (typeof window === 'undefined') return
  if (!currentPageUrl.value) {
    setShareFeedbackMessage('공유할 URL을 찾을 수 없습니다.', true)
    return
  }

  const encodedUrl = encodeURIComponent(currentPageUrl.value)
  const encodedText = encodeURIComponent(shareText.value)

  let shareUrl = ''
  let platformName = ''

  if (platform === 'x') {
    shareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`
    platformName = 'X'
  } else if (platform === 'instagram') {
    shareUrl = 'https://www.instagram.com/'
    platformName = '인스타그램'
  } else {
    setShareFeedbackMessage('지원하지 않는 공유 플랫폼입니다.', true)
    return
  }

  const popup = window.open(shareUrl, '_blank', 'noopener,noreferrer,width=640,height=720')
  if (!popup) {
    setShareFeedbackMessage('팝업 차단으로 공유 창을 열지 못했습니다.', true)
    return
  }
  if (platform === 'instagram') {
    setShareFeedbackMessage(`${platformName}이 열렸습니다. 복사한 링크를 붙여넣어 공유하세요.`)
  } else {
    setShareFeedbackMessage(`${platformName} 공유 창을 열었습니다.`)
  }
  isSharePopupOpen.value = false
}

async function copyCurrentPageUrl() {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    setShareFeedbackMessage('클립보드 기능을 사용할 수 없습니다.', true)
    return
  }
  if (!currentPageUrl.value) {
    setShareFeedbackMessage('복사할 URL을 찾을 수 없습니다.', true)
    return
  }

  try {
    await navigator.clipboard.writeText(currentPageUrl.value)
    setShareFeedbackMessage('현재 페이지 링크를 복사했습니다.')
    isSharePopupOpen.value = false
  } catch (error) {
    setShareFeedbackMessage(`링크 복사에 실패했습니다: ${error.message}`, true)
  }
}

function syncMap() {
  if (!mapInstance.value || !mapContainer.value || !window.L) return

  if (mapMarker.value) {
    mapMarker.value.remove()
    mapMarker.value = null
  }

  const lat = Number(content.value?.latitude)
  const lng = Number(content.value?.longitude)
  const hasValidCoordinate = Number.isFinite(lat) && Number.isFinite(lng)

  if (!hasValidCoordinate) {
    mapInstance.value.setView([35.17, 129.07], 10)
    return
  }

  mapMarker.value = window.L.marker([lat, lng]).addTo(mapInstance.value)
  mapMarker.value.bindPopup(content.value?.title || '콘텐츠 상세').openPopup()
  mapInstance.value.setView([lat, lng], 14, { animate: false })
}

watch(contentId, () => {
  loadContentDetail()
  loadRelatedPosts()
  syncMap()
  loadCarouselImages()
}, { immediate: true })
watch(() => route.fullPath, syncCurrentPageUrl, { immediate: true })

onMounted(() => {
  window.addEventListener('storage', handleStorageChange)
  window.addEventListener('keydown', handleCarouselKeydown)
  if (!mapContainer.value || typeof window === 'undefined' || !window.L) return

  mapInstance.value = window.L.map(mapContainer.value, {
    zoomControl: true,
    scrollWheelZoom: true,
  })

  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(mapInstance.value)

  syncMap()
})

onBeforeUnmount(() => {
  stopCarousel()
  if (typeof document !== 'undefined') document.body.style.overflow = ''
  if (typeof window !== 'undefined') window.removeEventListener('storage', handleStorageChange)
  if (typeof window !== 'undefined') window.removeEventListener('keydown', handleCarouselKeydown)
  if (mapInstance.value) {
    mapInstance.value.remove()
    mapInstance.value = null
  }
})
</script>

<template>
  <section
    class="region-photo-carousel"
    :class="{ 'region-photo-carousel--empty': !carouselImages.length }"
    aria-label="장소 사진"
    @mouseenter="stopCarousel"
    @mouseleave="startCarousel"
  >
    <div
      v-if="carouselImages.length"
      class="carousel-slides"
      role="button"
      tabindex="0"
      aria-label="현재 사진 크게 보기"
      @click="openLightbox"
      @keydown.enter="openLightbox"
      @keydown.space.prevent="openLightbox"
    >
      <img
        v-for="(image, index) in carouselImages"
        :key="image.id"
        :class="{ active: index === activeCarouselIndex }"
        :src="image.url"
        :alt="index === activeCarouselIndex ? image.alt : ''"
        :aria-hidden="index !== activeCarouselIndex"
      />
    </div>
    <div v-else class="carousel-placeholder" aria-hidden="true"><span>LOCALHUB</span></div>

    <div v-if="content" class="carousel-caption container">
      <span>{{ carouselImages[activeCarouselIndex]?.source || 'BUSAN LOCAL GUIDE' }}</span>
      <strong>{{ content.title }}</strong>
      <small v-if="carouselImages[activeCarouselIndex]?.attributions?.length">
        사진: {{ carouselImages[activeCarouselIndex].attributions.join(', ') }}
      </small>
    </div>

    <template v-if="carouselImages.length > 1">
      <button class="carousel-arrow carousel-arrow--previous" type="button" aria-label="이전 사진" @click="moveCarousel(-1)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
      </button>
      <button class="carousel-arrow carousel-arrow--next" type="button" aria-label="다음 사진" @click="moveCarousel(1)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
      </button>
      <div class="carousel-indicators" role="tablist" aria-label="사진 선택">
        <button
          v-for="(image, index) in carouselImages"
          :key="`indicator-${image.id}`"
          type="button"
          role="tab"
          :class="{ active: index === activeCarouselIndex }"
          :aria-label="`${index + 1}번째 사진`"
          :aria-selected="index === activeCarouselIndex"
          @click="selectCarouselImage(index)"
        ></button>
      </div>
    </template>
    <div v-if="carouselImages.length" class="carousel-count">{{ activeCarouselIndex + 1 }} / {{ carouselImages.length }}</div>
  </section>

  <Teleport to="body">
    <Transition name="lightbox-fade">
      <div v-if="isLightboxOpen" class="photo-lightbox" role="dialog" aria-modal="true" aria-label="장소 사진 크게 보기" @click.self="closeLightbox">
        <button class="lightbox-close" type="button" aria-label="사진 크게 보기 닫기" @click="closeLightbox">×</button>
        <div class="lightbox-image-wrap">
          <img :src="carouselImages[activeCarouselIndex]?.url" :alt="carouselImages[activeCarouselIndex]?.alt" />
        </div>
        <button v-if="carouselImages.length > 1" class="lightbox-arrow lightbox-arrow--previous" type="button" aria-label="이전 사진" @click="moveCarousel(-1)">‹</button>
        <button v-if="carouselImages.length > 1" class="lightbox-arrow lightbox-arrow--next" type="button" aria-label="다음 사진" @click="moveCarousel(1)">›</button>
        <footer>
          <div><strong>{{ content?.title }}</strong><span>{{ carouselImages[activeCarouselIndex]?.source }}</span></div>
          <span>{{ activeCarouselIndex + 1 }} / {{ carouselImages.length }}</span>
        </footer>
      </div>
    </Transition>
  </Teleport>

  <section class="container page-content">
    <p v-if="isLoading" class="empty-state">콘텐츠 정보를 불러오는 중입니다.</p>
    <p v-else-if="loadError" class="empty-state">{{ loadError }}</p>
    <p v-else-if="!content" class="empty-state">해당 콘텐츠를 찾을 수 없습니다.</p>

    <div v-else class="detail-layout">
      <article class="map-card">
        <div class="map-header">
          <div>
            <p class="eyebrow">MAP</p>
            <h2>지도</h2>
          </div>
        </div>
        <div ref="mapContainer" class="map-frame region-detail-map"></div>
      </article>

      <article class="map-detail-card">
        <p class="eyebrow">CONTENT DETAIL</p>
        <h2>{{ content.title }}</h2>
        <ul>
          <li><strong>유형</strong><span>{{ content.contentType }}</span></li>
          <li><strong>주소</strong><span>{{ content.address1 || '-' }} {{ content.address2 || '' }}</span></li>
          <li><strong>우편번호</strong><span>{{ content.zipcode || '-' }}</span></li>
          <li><strong>전화번호</strong><span>{{ content.telephone || '-' }}</span></li>
          <li><strong>생성일</strong><span>{{ formatContentDate(content.createdAt) }}</span></li>
          <li><strong>수정일</strong><span>{{ formatContentDate(content.modifiedAt) }}</span></li>
        </ul>

        <section class="google-place-info" aria-labelledby="google-place-info-title">
          <div class="google-place-info__heading">
            <h3 id="google-place-info-title">Google 장소 정보</h3>
            <span v-if="googlePlace?.rating" class="google-place-rating">
              <span aria-hidden="true">★</span>
              {{ googlePlace.rating.toFixed(1) }}
              <small>리뷰 {{ googlePlace.userRatingCount.toLocaleString() }}개</small>
            </span>
          </div>
          <p v-if="isGooglePlaceLoading" class="google-place-loading">장소 정보를 불러오는 중입니다.</p>
          <template v-else-if="googlePlace">
            <dl class="google-place-summary">
              <div>
                <dt>영업 상태</dt>
                <dd>{{ formatBusinessStatus(googlePlace.businessStatus) }}</dd>
              </div>
              <div v-if="googlePlace.phoneNumber">
                <dt>전화</dt>
                <dd><a :href="`tel:${googlePlace.phoneNumber}`">{{ googlePlace.phoneNumber }}</a></dd>
              </div>
            </dl>
            <details v-if="googlePlace.openingHours.length" class="opening-hours">
              <summary>영업시간 보기</summary>
              <ul>
                <li v-for="hours in googlePlace.openingHours" :key="hours">{{ hours }}</li>
              </ul>
            </details>
            <div class="google-place-actions">
              <a v-if="googlePlace.websiteURI" :href="googlePlace.websiteURI" target="_blank" rel="noopener noreferrer">홈페이지</a>
              <a v-if="googlePlace.googleMapsURI" :href="googlePlace.googleMapsURI" target="_blank" rel="noopener noreferrer">Google 지도에서 보기</a>
            </div>
            <small class="google-place-source">Google 제공 정보</small>
          </template>
          <p v-else class="google-place-loading">Google에 등록된 추가 정보가 없습니다.</p>
        </section>

        <div class="detail-share">
          <div class="detail-actions">
            <button
              v-if="shouldShowCalendarBackButton"
              class="button board-button board-button--outline"
              type="button"
              @click="goBackToCalendar"
            >
              캘린더로 돌아가기
            </button>
            <button
              class="button board-button board-button--secondary"
              type="button"
              :aria-expanded="isSharePopupOpen"
              aria-haspopup="menu"
              @click="toggleSharePopup"
            >
              공유하기
            </button>
          </div>
          <Transition name="share-pop">
            <div v-if="isSharePopupOpen" class="share-popup board-subcard" role="menu" aria-label="공유 메뉴">
              <button class="button board-button board-button--outline share-popup-button" type="button" role="menuitem" @click="copyCurrentPageUrl">
                링크 복사
              </button>
              <button
                class="button board-button board-button--outline share-popup-icon-button"
                type="button"
                role="menuitem"
                aria-label="인스타그램 공유"
                @click="openSocialShare('instagram')"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3.5" y="3.5" width="17" height="17" rx="5"></rect>
                  <circle cx="12" cy="12" r="4.2"></circle>
                  <circle cx="17.4" cy="6.6" r="1.1"></circle>
                </svg>
              </button>
              <button
                class="button board-button board-button--outline share-popup-icon-button"
                type="button"
                role="menuitem"
                aria-label="X 공유"
                @click="openSocialShare('x')"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 4h4.7l5.3 7.6L18.9 4H21l-6 8.6L21 20h-4.7l-5.7-8.2L5.1 20H3l6.3-9L4 4z"></path>
                </svg>
              </button>
            </div>
          </Transition>
          <p v-if="shareFeedback" :class="['share-feedback', { 'share-feedback--error': isShareError }]" :role="isShareError ? 'alert' : 'status'">
            {{ shareFeedback }}
          </p>
        </div>
      </article>
    </div>

    <section v-if="content" class="related-posts-section board-subcard" aria-labelledby="related-posts-title">
      <div class="related-posts-heading">
        <h3 id="related-posts-title">관련 게시글</h3>
        <span>{{ relatedPosts.length }}개</span>
      </div>
      <ul v-if="relatedPosts.length" class="related-posts-list">
        <li v-for="post in relatedPosts" :key="post.id">
          <RouterLink :to="{ name: 'board-detail', params: { id: post.id } }">
            <span class="board-badge">{{ post.postCategory }}</span>
            <strong>{{ post.title }}</strong>
            <span class="related-post-meta">
              {{ post.author || '작성자 미상' }} · {{ formatPostDate(post.createdAt) }}
            </span>
          </RouterLink>
        </li>
      </ul>
      <p v-else>이 장소와 연결된 게시글이 없습니다.</p>
    </section>
  </section>
</template>

<style scoped>
.region-photo-carousel {
  position: relative;
  height: clamp(360px, 48vw, 560px);
  overflow: hidden;
  color: white;
  background: #173f35;
}

.region-photo-carousel::after {
  position: absolute;
  inset: 0;
  z-index: 1;
  content: '';
  pointer-events: none;
  background: linear-gradient(180deg, rgba(10, 35, 29, .05) 35%, rgba(10, 35, 29, .78) 100%);
}

.carousel-slides,
.carousel-slides img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.carousel-slides { z-index: 0; cursor: zoom-in; }
.carousel-slides:focus-visible { outline: 3px solid white; outline-offset: -6px; }

.carousel-slides img {
  opacity: 0;
  object-fit: cover;
  transform: scale(1.03);
  transition: opacity .65s ease, transform 5s ease;
}

.carousel-slides img.active {
  opacity: 1;
  transform: scale(1);
}

.carousel-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 70% 25%, #397967, transparent 35%), linear-gradient(135deg, #123e33, #1d5a49);
}

.carousel-placeholder span {
  opacity: .12;
  font-family: 'DM Serif Display', serif;
  font-size: clamp(70px, 16vw, 190px);
  letter-spacing: .08em;
}

.carousel-caption {
  position: absolute;
  right: 0;
  bottom: 44px;
  left: 0;
  z-index: 2;
  display: grid;
  gap: 6px;
}

.carousel-caption > span {
  color: #f2aa7e;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .12em;
}

.carousel-caption strong {
  max-width: 760px;
  font-family: 'DM Serif Display', 'Noto Sans KR', serif;
  font-size: clamp(28px, 4vw, 48px);
  font-weight: 400;
  line-height: 1.2;
}

.carousel-caption small { color: rgba(255,255,255,.72); font-size: 10px; }
.carousel-arrow { position: absolute; top: 50%; z-index: 3; display: flex; align-items: center; justify-content: center; width: 46px; height: 46px; padding: 0; color: white; border: 1px solid rgba(255,255,255,.55); border-radius: 50%; background: rgba(10,35,29,.32); backdrop-filter: blur(6px); cursor: pointer; font-family: Arial, sans-serif; font-size: 34px; line-height: 1; transform: translateY(-50%); }
.carousel-arrow svg { display: block; width: 24px; height: 24px; overflow: visible; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.carousel-arrow:hover, .carousel-arrow:focus-visible { outline: 0; background: var(--orange); }
.carousel-arrow--previous { left: max(18px, calc((100vw - 1220px) / 2)); }
.carousel-arrow--next { right: max(18px, calc((100vw - 1220px) / 2)); }
.carousel-indicators { position: absolute; bottom: 18px; left: 50%; z-index: 3; display: flex; gap: 7px; transform: translateX(-50%); }
.carousel-indicators button { width: 7px; height: 7px; padding: 0; border: 0; border-radius: 4px; background: rgba(255,255,255,.48); cursor: pointer; transition: width .2s, background .2s; }
.carousel-indicators button.active { width: 25px; background: white; }
.carousel-count { position: absolute; right: max(20px, calc((100vw - 1120px) / 2)); bottom: 20px; z-index: 3; color: rgba(255,255,255,.8); font-size: 11px; font-weight: 700; }

.photo-lightbox {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  padding: 54px 80px 24px;
  color: white;
  background: rgba(4, 12, 10, .94);
  backdrop-filter: blur(10px);
}

.lightbox-image-wrap { display: grid; min-height: 0; place-items: center; }
.lightbox-image-wrap img { display: block; width: auto; max-width: 100%; height: auto; max-height: calc(100vh - 145px); object-fit: contain; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
.lightbox-close { position: absolute; top: 16px; right: 20px; display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; padding: 0 0 3px; color: white; border: 1px solid rgba(255,255,255,.45); border-radius: 50%; background: rgba(255,255,255,.08); cursor: pointer; font-size: 29px; line-height: 1; }
.lightbox-close:hover, .lightbox-close:focus-visible { outline: 0; background: var(--orange); }
.lightbox-arrow { position: absolute; top: 50%; display: flex; align-items: center; justify-content: center; width: 52px; height: 52px; padding: 0; color: white; border: 1px solid rgba(255,255,255,.45); border-radius: 50%; background: rgba(255,255,255,.08); cursor: pointer; font-family: Arial, sans-serif; font-size: 39px; line-height: 1; transform: translateY(-50%); }
.lightbox-arrow:hover, .lightbox-arrow:focus-visible { outline: 0; background: var(--orange); }
.lightbox-arrow--previous { left: 18px; }
.lightbox-arrow--next { right: 18px; }
.photo-lightbox footer { display: flex; align-items: end; justify-content: space-between; gap: 20px; width: min(1100px, 100%); margin: 18px auto 0; }
.photo-lightbox footer div { display: grid; gap: 3px; }
.photo-lightbox footer strong { font-size: 15px; }
.photo-lightbox footer span { color: rgba(255,255,255,.66); font-size: 11px; }
.lightbox-fade-enter-active, .lightbox-fade-leave-active { transition: opacity .2s ease; }
.lightbox-fade-enter-from, .lightbox-fade-leave-to { opacity: 0; }

.detail-layout {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 20px;
  align-items: start;
}

.region-detail-map,
.region-detail-map :deep(.leaflet-container) {
  height: 420px;
}

.region-detail-map {
  position: relative;
  z-index: 0;
  isolation: isolate;
}

.related-posts-section {
  margin-top: 20px;
  padding: 18px;
}

.related-posts-section h3 {
  margin: 0;
  color: var(--green);
  font-size: 16px;
}

.related-posts-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.related-posts-heading > span {
  color: #6b756f;
  font-size: 13px;
}

.related-posts-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.related-posts-list a {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px;
  color: inherit;
  border: 1px solid #dbe5dc;
  border-radius: 8px;
  background: white;
  text-decoration: none;
}

.related-posts-list a:hover,
.related-posts-list a:focus-visible {
  border-color: var(--green);
  background: var(--mint);
}

.related-posts-list strong {
  overflow: hidden;
  color: var(--green);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.related-post-meta {
  color: #6b756f;
  font-size: 12px;
  white-space: nowrap;
}

.related-posts-section p {
  margin: 0;
  color: #6b756f;
  font-size: 14px;
  line-height: 1.6;
}

.google-place-info {
  margin-top: 18px;
  padding: 16px;
  border: 1px solid #dbe5dc;
  border-radius: 10px;
  background: #f8faf7;
}

.google-place-info__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.google-place-info h3 { margin: 0; color: var(--green); font-size: 15px; }
.google-place-rating { color: #d6653d; font-size: 14px; font-weight: 800; white-space: nowrap; }
.google-place-rating small { margin-left: 4px; color: #78827d; font-size: 10px; font-weight: 600; }
.google-place-loading { margin: 12px 0 0; color: #78827d; font-size: 12px; }
.google-place-summary { display: grid; gap: 8px; margin: 14px 0 0; }
.google-place-summary > div { display: grid; grid-template-columns: 76px 1fr; gap: 8px; font-size: 12px; }
.google-place-summary dt { color: #7a8580; }
.google-place-summary dd { margin: 0; color: var(--green); font-weight: 700; }
.google-place-summary a { color: inherit; }
.opening-hours { margin-top: 12px; color: var(--green); font-size: 12px; }
.opening-hours summary { cursor: pointer; font-weight: 700; }
.opening-hours ul { display: grid; gap: 4px; margin: 10px 0 0; padding: 0; color: #66716b; list-style: none; }
.google-place-actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 14px; }
.google-place-actions a { padding: 7px 10px; color: var(--green); border: 1px solid #cad8cd; border-radius: 7px; background: white; font-size: 11px; font-weight: 700; text-decoration: none; }
.google-place-actions a:hover, .google-place-actions a:focus-visible { border-color: var(--green); outline: 0; background: var(--mint); }
.google-place-source { display: block; margin-top: 10px; color: #929a96; font-size: 9px; text-align: right; }

.detail-share {
  position: relative;
  margin-top: 14px;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.share-feedback {
  margin: 10px 0 0;
  color: var(--green);
  font-size: 13px;
  font-weight: 600;
}

.share-feedback--error {
  color: #b74f3b;
}

.share-popup {
  position: absolute;
  z-index: 5;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  width: max-content;
  max-width: 100%;
  margin-top: 8px;
  padding: 12px;
  background: white;
}

.share-popup-button {
  justify-content: flex-start;
}

.share-popup-icon-button {
  width: 44px;
  min-height: 44px;
  padding: 0;
}

.share-popup-icon-button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.share-pop-enter-active,
.share-pop-leave-active {
  transition: opacity .2s ease, transform .2s ease;
  transform-origin: top left;
}

.share-pop-enter-from,
.share-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(.98);
}

@media (max-width: 980px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .photo-lightbox { padding: 55px 48px 18px; }
  .lightbox-arrow { width: 38px; height: 38px; font-size: 30px; }
  .lightbox-arrow--previous { left: 6px; }
  .lightbox-arrow--next { right: 6px; }
  .photo-lightbox footer { align-items: flex-start; flex-direction: column; gap: 7px; }

  .related-posts-list a {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .related-post-meta {
    grid-column: 1 / -1;
  }
}
</style>
