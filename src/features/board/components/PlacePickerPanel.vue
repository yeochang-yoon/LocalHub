<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DEFAULT_PLACE_CATEGORY, PLACE_CATEGORIES } from '../data/boardOptions.js'
import { searchBoardPlaces } from '../services/boardPlaces.js'

const props = defineProps({
  selectedPlace: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['select', 'clear', 'close'])

const initialCategory = PLACE_CATEGORIES.some((item) => item.value === props.selectedPlace?.category)
  ? props.selectedPlace.category
  : DEFAULT_PLACE_CATEGORY

const dialog = ref(null)
const selectedCategory = ref(initialCategory)
const query = ref('')
const results = ref([])
const loading = ref(false)
const errorMessage = ref('')
let searchSequence = 0

async function refreshResults() {
  const sequence = ++searchSequence
  loading.value = true
  errorMessage.value = ''
  results.value = []

  try {
    const nextResults = await searchBoardPlaces(selectedCategory.value, query.value)
    if (sequence !== searchSequence) return
    results.value = nextResults
  } catch {
    if (sequence !== searchSequence) return
    results.value = []
    errorMessage.value = '장소 정보를 불러오지 못했습니다.'
  } finally {
    if (sequence === searchSequence) loading.value = false
  }
}

function selectPlace(place) {
  emit('select', place)
  emit('close')
}

function clearSelection() {
  emit('clear')
}

function closePanel() {
  emit('close')
}

function handleKeydown(event) {
  if (event.key === 'Escape') closePanel()
}

watch([selectedCategory, query], refreshResults, { immediate: true })

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  await nextTick()
  dialog.value?.focus()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="place-picker-backdrop" @click.self="closePanel">
      <section
        ref="dialog"
        class="place-picker-panel board-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-picker-title"
        tabindex="-1"
      >
        <header class="place-picker-header">
          <div>
            <p class="place-picker-eyebrow">PLACE</p>
            <h2 id="place-picker-title">장소 등록</h2>
          </div>
          <button type="button" class="place-picker-close" aria-label="장소 선택 닫기" @click="closePanel">×</button>
        </header>

        <div v-if="selectedPlace" class="place-picker-current board-subcard">
          <div>
            <strong>현재 선택</strong>
            <span>{{ selectedPlace.category }} · {{ selectedPlace.name }}</span>
          </div>
          <button
            class="button board-button board-button--outline board-button--compact"
            type="button"
            @click="clearSelection"
          >
            선택 해제
          </button>
        </div>

        <div class="place-picker-controls">
          <label class="board-field">
            장소 카테고리
            <select v-model="selectedCategory" class="board-control">
              <option v-for="category in PLACE_CATEGORIES" :key="category.value" :value="category.value">
                {{ category.label }}
              </option>
            </select>
          </label>
          <label class="board-field">
            장소명 검색
            <input v-model="query" class="board-control" type="search" placeholder="장소명을 입력하세요" />
          </label>
        </div>

        <div class="place-picker-status" aria-live="polite">
          <span v-if="loading">장소를 불러오는 중입니다…</span>
          <span v-else-if="errorMessage" class="board-error">{{ errorMessage }}</span>
          <span v-else>{{ results.length }}개 장소 표시</span>
        </div>

        <div class="place-picker-results">
          <button
            v-for="place in results"
            :key="`${place.category}-${place.contentId}`"
            type="button"
            class="place-result board-subcard"
            :class="{ selected: selectedPlace?.contentId === place.contentId && selectedPlace?.category === place.category }"
            :aria-pressed="selectedPlace?.contentId === place.contentId && selectedPlace?.category === place.category"
            @click="selectPlace(place)"
          >
            <strong>{{ place.name || '이름 없는 장소' }}</strong>
            <span>{{ place.address || '주소 정보 없음' }}</span>
          </button>
          <p v-if="!loading && !errorMessage && !results.length" class="place-picker-empty">
            검색 결과가 없습니다.
          </p>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.place-picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(17, 24, 21, .45);
}

.place-picker-panel {
  display: flex;
  flex-direction: column;
  width: min(720px, 100%);
  max-height: calc(100vh - 40px);
  overflow: hidden;
  box-shadow: 0 24px 70px rgba(14, 48, 39, .28);
  outline: 0;
}

.place-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px;
  color: white;
  background: var(--green);
}

.place-picker-header h2,
.place-picker-eyebrow {
  margin: 0;
}

.place-picker-eyebrow {
  margin-bottom: 4px;
  color: #edb68c;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .16em;
}

.place-picker-close {
  color: white;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 28px;
  line-height: 1;
}

.place-picker-current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 16px 20px 0;
  padding: 12px 14px;
  background: var(--mint);
}

.place-picker-current div {
  display: grid;
  gap: 3px;
}

.place-picker-current span {
  color: #5d6862;
  font-size: 13px;
}

.place-picker-controls {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 14px;
  padding: 18px 20px 12px;
}

.place-picker-status {
  min-height: 28px;
  padding: 0 20px 8px;
  color: #77817c;
  font-size: 12px;
}

.place-picker-results {
  display: grid;
  flex: 1;
  gap: 8px;
  min-height: 0;
  max-height: 360px;
  overflow-y: auto;
  padding: 0 20px 20px;
}

.place-result {
  display: grid;
  gap: 5px;
  width: 100%;
  padding: 13px 14px;
  text-align: left;
  cursor: pointer;
}

.place-result:hover,
.place-result:focus-visible,
.place-result.selected {
  border-color: var(--orange);
  background: #fffaf6;
  outline: 0;
}

.place-result strong {
  color: var(--green);
}

.place-result span {
  color: #77817c;
  font-size: 12px;
}

.place-picker-empty {
  margin: 0;
  padding: 40px 16px;
  text-align: center;
  color: #77817c;
}

@media (max-width: 640px) {
  .place-picker-backdrop {
    align-items: end;
    padding: 12px;
  }

  .place-picker-panel {
    max-height: calc(100vh - 24px);
  }

  .place-picker-controls {
    grid-template-columns: 1fr;
  }

  .place-picker-results {
    max-height: 42vh;
  }
}
</style>
