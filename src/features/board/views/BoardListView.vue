<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { loadPosts, deletePost, toggleLike, toggleBookmark, validatePassword } from '../services/boardStorage'

const router = useRouter()
const route = useRoute()
const posts = ref(loadPosts())
const query = ref('')
const showOnlyBookmarked = ref(route.name === 'board-bookmarks')

const isBookmarkPage = computed(() => route.name === 'board-bookmarks')
const isSearching = computed(() => query.value.trim().length > 0)

watch(
  () => route.name,
  () => {
    showOnlyBookmarked.value = route.name === 'board-bookmarks'
    refreshPosts()
  }
)

onMounted(() => {
  refreshPosts()
})

const filteredPosts = computed(() => {
  const term = query.value.trim().toLowerCase()
  return posts.value.filter((post) => {
    if (showOnlyBookmarked.value && !post.bookmarked) return false
    if (!term) return true
    return [post.title, post.author, post.content]
      .some((field) => field.toLowerCase().includes(term))
  })
})

const emptyStateMessage = computed(() => {
  if (filteredPosts.value.length) return ''
  if (showOnlyBookmarked.value) {
    if (isSearching.value) return '북마크한 게시글 중 검색 결과가 없습니다.'
    return '북마크한 게시글이 없습니다.'
  }
  if (isSearching.value) return '검색 결과가 없습니다.'
  if (!posts.value.length) return '게시글이 없습니다. 새 글을 작성해 보세요.'
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

function openDetail(postId) {
  router.push({ name: 'board-detail', params: { id: postId } })
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

  <section class="container page-content">
    <div class="content-toolbar">
      <p>전체 <strong>{{ filteredPosts.length }}</strong>개</p>
      <div>
        <button class="button button-primary" type="button" @click="goToCreate">새 글 쓰기</button>
        <button
          class="button button-secondary"
          type="button"
          @click="isBookmarkPage ? goToAllPosts() : goToBookmarkList()"
        >
          {{ isBookmarkPage ? '전체 게시물 보기' : '북마크 목록 보기' }}
        </button>
      </div>
    </div>

    <div class="board-search-box">
      <input v-model="query" type="search" placeholder="제목, 작성자, 내용을 검색하세요" />
    </div>

    <div class="post-list">
      <article v-for="post in filteredPosts" :key="post.id" class="post-card">
        <div class="post-card-body" style="cursor: pointer;" @click="openDetail(post.id)">
          <h2>{{ post.title }}</h2>
          <p>{{ post.content }}</p>
          <div class="post-meta">
            <span>{{ post.author }} · {{ post.createdAt }}</span>
            <span>조회 {{ post.views }}</span>
          </div>
        </div>
        <div class="post-actions">
          <button class="text-button" type="button" @click="handleLike(post.id)">좋아요 {{ post.likes }}</button>
          <button class="text-button" type="button" @click="handleBookmark(post.id)">{{ post.bookmarked ? '북마크 취소' : '북마크' }}</button>
          <button class="text-button danger" type="button" @click="handleDelete(post.id)">삭제</button>
        </div>
      </article>
      <p v-if="emptyStateMessage && !filteredPosts.length" class="empty-state">{{ emptyStateMessage }}</p>
    </div>
  </section>
</template>
