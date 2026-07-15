<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BoardFilterBar from '../components/BoardFilterBar.vue'
import BoardPostCard from '../components/BoardPostCard.vue'
import { DEFAULT_POST_CATEGORY } from '../data/boardOptions.js'
import { getPostTimestamp } from '../utils/boardDate.js'
import { loadPosts, deletePost, toggleLike, toggleBookmark, validatePassword } from '../services/boardStorage'

const props = defineProps({
  showBookmarks: {
    type: Boolean,
    default: false,
  },
})

const router = useRouter()
const posts = ref(loadPosts())
const searchTarget = ref('title')
const query = ref('')
const sortOrder = ref('latest')
const selectedCategory = ref('전체')
const pageSize = ref(10)
const currentPage = ref(1)
const pageSizeOptions = [10, 20, 30, 50]

const isBookmarkPage = computed(() => props.showBookmarks)
const hasActiveFilter = computed(() => {
  return query.value.trim().length > 0 || selectedCategory.value !== '전체'
})

watch(
  () => props.showBookmarks,
  () => {
    refreshPosts()
  }
)

function compareDates(left, right, direction = 'desc') {
  const leftTimestamp = getPostTimestamp(left.createdAt)
  const rightTimestamp = getPostTimestamp(right.createdAt)

  if (leftTimestamp === null && rightTimestamp === null) return 0
  if (leftTimestamp === null) return 1
  if (rightTimestamp === null) return -1

  return direction === 'asc'
    ? leftTimestamp - rightTimestamp
    : rightTimestamp - leftTimestamp
}

function getCount(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function sortPosts(items) {
  const nextItems = [...items]

  if (sortOrder.value === 'oldest') {
    return nextItems.sort((left, right) => compareDates(left, right, 'asc'))
  }

  if (sortOrder.value === 'likes') {
    return nextItems.sort((left, right) => {
      const countDifference = getCount(right.likes) - getCount(left.likes)
      return countDifference || compareDates(left, right)
    })
  }

  if (sortOrder.value === 'views') {
    return nextItems.sort((left, right) => {
      const countDifference = getCount(right.views) - getCount(left.views)
      return countDifference || compareDates(left, right)
    })
  }

  return nextItems.sort((left, right) => compareDates(left, right))
}

const filteredPosts = computed(() => {
  const term = query.value.trim().toLowerCase()
  const target = searchTarget.value === 'author' ? 'author' : 'title'

  const matches = posts.value.filter((post) => {
    if (isBookmarkPage.value && !post.bookmarked) return false

    const category = post.postCategory || DEFAULT_POST_CATEGORY
    if (selectedCategory.value !== '전체' && category !== selectedCategory.value) return false

    if (!term) return true
    return String(post[target] ?? '').trim().toLowerCase().includes(term)
  })

  return sortPosts(matches)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredPosts.value.length / pageSize.value)))
const paginatedPosts = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize.value
  return filteredPosts.value.slice(startIndex, startIndex + pageSize.value)
})
const pageRangeStart = computed(() => {
  if (!filteredPosts.value.length) return 0
  return (currentPage.value - 1) * pageSize.value + 1
})
const pageRangeEnd = computed(() => {
  return Math.min(currentPage.value * pageSize.value, filteredPosts.value.length)
})
const paginationItems = computed(() => {
  if (totalPages.value <= 7) {
    return Array.from({ length: totalPages.value }, (_, index) => index + 1)
  }

  const pages = [...new Set([
    1,
    currentPage.value - 1,
    currentPage.value,
    currentPage.value + 1,
    totalPages.value,
  ])]
    .filter((page) => page >= 1 && page <= totalPages.value)
    .sort((left, right) => left - right)

  const items = []
  pages.forEach((page, index) => {
    const previousPage = pages[index - 1]
    if (previousPage && page - previousPage > 1) items.push(`ellipsis-${previousPage}`)
    items.push(page)
  })
  return items
})

watch(
  [searchTarget, query, sortOrder, selectedCategory, pageSize, isBookmarkPage],
  () => {
    currentPage.value = 1
  },
)

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages
})

const emptyStateMessage = computed(() => {
  if (filteredPosts.value.length) return ''

  if (isBookmarkPage.value) {
    return hasActiveFilter.value
      ? '북마크한 게시글 중 조건에 맞는 결과가 없습니다.'
      : '북마크한 게시글이 없습니다.'
  }

  if (!posts.value.length) return '게시글이 없습니다. 새 글을 작성해 보세요.'
  if (hasActiveFilter.value) return '조건에 맞는 게시글이 없습니다.'
  return ''
})

function refreshPosts() {
  posts.value = loadPosts()
}

function goToPage(page) {
  currentPage.value = Math.min(Math.max(Number(page) || 1, 1), totalPages.value)
}

function goToCreate() {
  router.push({ name: 'board-new' })
}

function goToBookmarkList() {
  router.push({ name: 'board-bookmarks' })
}

function goToAllPosts() {
  router.push({ name: 'board-list' })
}

function handleDelete(postId) {
  const password = window.prompt('삭제 비밀번호를 입력하세요.')
  if (password === null) return
  if (!password.trim()) {
    alert('비밀번호를 입력해주세요.')
    return
  }
  if (!validatePassword(postId, password)) {
    alert('비밀번호가 올바르지 않습니다.')
    return
  }
  if (!window.confirm('게시물을 삭제하시겠어요?')) return
  deletePost(postId)
  refreshPosts()
}

function handleLike(postId) {
  toggleLike(postId)
  refreshPosts()
}

function handleBookmark(postId) {
  toggleBookmark(postId)
  refreshPosts()
}
</script>

<template>
  <section class="page-hero">
    <div class="container">
      <p class="eyebrow">COMMUNITY</p>
      <h1><span class="title-emoji" aria-hidden="true">💬</span> 동네 이야기</h1>
      <p>부산에서 발견한 소식과 경험을 이웃들과 나눠보세요.</p>
    </div>
  </section>

  <section class="container page-content board-page">
    <div class="content-toolbar board-list-toolbar">
      <p>{{ isBookmarkPage ? '북마크' : '전체' }} <strong>{{ filteredPosts.length }}</strong>개</p>
      <div class="board-list-toolbar-actions">
        <button class="button board-button board-button--primary" type="button" @click="goToCreate">새 글 쓰기</button>
        <button
          class="button board-button board-button--secondary"
          type="button"
          @click="isBookmarkPage ? goToAllPosts() : goToBookmarkList()"
        >
          {{ isBookmarkPage ? '전체 게시물 보기' : '북마크 목록 보기' }}
        </button>
      </div>
    </div>

    <BoardFilterBar
      v-model:search-target="searchTarget"
      v-model:query="query"
      v-model:sort-order="sortOrder"
      v-model:category="selectedCategory"
    />

    <div v-if="filteredPosts.length" class="board-page-options">
      <p>
        전체 {{ filteredPosts.length.toLocaleString() }}개 중
        <strong>{{ pageRangeStart }}–{{ pageRangeEnd }}</strong>개 표시
      </p>
      <label class="board-page-size">
        페이지당
        <select v-model.number="pageSize" class="board-control">
          <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }}개</option>
        </select>
      </label>
    </div>

    <div class="board-post-list">
      <BoardPostCard
        v-for="post in paginatedPosts"
        :key="post.id"
        :post="post"
        @like="handleLike"
        @bookmark="handleBookmark"
      >
        <template #actions>
          <button
            class="button board-button board-button--danger board-button--compact"
            type="button"
            @click="handleDelete(post.id)"
          >
            삭제
          </button>
        </template>
      </BoardPostCard>

      <p v-if="emptyStateMessage && !filteredPosts.length" class="empty-state">
        {{ emptyStateMessage }}
      </p>
    </div>

    <nav v-if="filteredPosts.length && totalPages > 1" class="board-pagination" aria-label="게시글 페이지 이동">
      <button
        class="board-page-button board-page-move"
        type="button"
        :disabled="currentPage === 1"
        @click="goToPage(currentPage - 1)"
      >
        이전
      </button>
      <template v-for="item in paginationItems" :key="item">
        <span v-if="typeof item === 'string'" class="board-page-ellipsis" aria-hidden="true">…</span>
        <button
          v-else
          class="board-page-button"
          :class="{ active: currentPage === item }"
          type="button"
          :aria-current="currentPage === item ? 'page' : undefined"
          :aria-label="`${item}페이지`"
          @click="goToPage(item)"
        >
          {{ item }}
        </button>
      </template>
      <button
        class="board-page-button board-page-move"
        type="button"
        :disabled="currentPage === totalPages"
        @click="goToPage(currentPage + 1)"
      >
        다음
      </button>
    </nav>
  </section>
</template>

<style scoped>
.board-list-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.board-post-list {
  display: grid;
  gap: 14px;
}

.board-page-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: -6px 0 16px;
}

.board-page-options p {
  margin: 0;
  color: #6d7772;
  font-size: 13px;
}

.board-page-options strong {
  color: var(--green);
}

.board-page-size {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5d6862;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.board-page-size .board-control {
  width: 92px;
  min-height: 40px;
  padding: 8px 30px 8px 10px;
}

.board-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 28px;
}

.board-page-button {
  display: grid;
  place-items: center;
  min-width: 40px;
  height: 40px;
  padding: 0 10px;
  color: var(--green);
  border: 1px solid #d4ddd7;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-weight: 700;
}

.board-page-button:hover:not(:disabled),
.board-page-button:focus-visible,
.board-page-button.active {
  color: white;
  border-color: var(--green);
  background: var(--green);
}

.board-page-button:disabled {
  color: #a8b0ac;
  background: #f2f4f1;
  cursor: not-allowed;
}

.board-page-move {
  min-width: 66px;
}

.board-page-ellipsis {
  padding: 0 3px;
  color: #7b8580;
}

@media (max-width: 760px) {
  .board-list-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 14px;
  }

  .board-list-toolbar-actions .button {
    flex: 1 1 180px;
  }

  .board-page-options {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
