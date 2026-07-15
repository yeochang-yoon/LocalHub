<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { queryDatabase } from '@/features/chatbot/services/chatbotDatabase'
import { getPostsByContentId } from '@/features/board/services/boardStorage'
import { formatPostDate } from '@/features/board/utils/boardDate'
import { regionCategories } from '../data/regionCategories'

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
        COALESCE(i.url, '') AS image,
        co.latitude AS latitude,
        co.longitude AS longitude
      FROM places p
      JOIN content_types ct ON ct.id = p.content_type_id
      LEFT JOIN place_addresses a ON a.place_id = p.id
      LEFT JOIN place_contacts c ON c.place_id = p.id
      LEFT JOIN place_images i ON i.place_id = p.id AND i.kind = 'original'
      LEFT JOIN place_coordinates co ON co.place_id = p.id
      WHERE p.id = ?
      LIMIT 1
      `,
      [contentId.value]
    )

    content.value = row ?? null
  } catch (error) {
    loadError.value = `콘텐츠 조회 중 오류가 발생했습니다: ${error.message}`
  } finally {
    isLoading.value = false
  }
}

function loadRelatedPosts() {
  relatedPosts.value = getPostsByContentId(contentId.value)
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
  router.push({
    name: 'calendar',
    query: {
      from: 'calendar',
      year: String(route.query.year || new Date().getFullYear()),
      month: String(route.query.month || new Date().getMonth() + 1),
    },
  })
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
}, { immediate: true })
watch(content, syncMap)
watch(() => route.fullPath, syncCurrentPageUrl, { immediate: true })

onMounted(() => {
  window.addEventListener('storage', handleStorageChange)
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
  if (typeof window !== 'undefined') window.removeEventListener('storage', handleStorageChange)
  if (mapInstance.value) {
    mapInstance.value.remove()
    mapInstance.value = null
  }
})
</script>

<template>
  <section class="page-hero">
    <div class="container">
      <p class="eyebrow">EXPLORE BUSAN</p>
      <h1>{{ heroTitle }}</h1>
      <p>{{ heroDescription }}</p>
    </div>
  </section>

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
  .related-posts-list a {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .related-post-meta {
    grid-column: 1 / -1;
  }
}
</style>
