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
      <h1>동네 이야기</h1>
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

    <div class="board-post-list">
      <BoardPostCard
        v-for="post in filteredPosts"
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

@media (max-width: 760px) {
  .board-list-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 14px;
  }

  .board-list-toolbar-actions .button {
    flex: 1 1 180px;
  }
}
</style>
