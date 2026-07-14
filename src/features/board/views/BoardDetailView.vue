<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  getPostById,
  deletePost,
  toggleLike,
  toggleBookmark,
  validatePassword,
  incrementViews,
} from '../services/boardStorage'

const router = useRouter()
const route = useRoute()
const post = ref(null)
const password = ref('')

function fetchPost() {
  const loaded = getPostById(route.params.id)
  post.value = loaded || null
}

function loadPost() {
  incrementViews(route.params.id)
  fetchPost()
}

onMounted(() => {
  loadPost()
})

watch(
  () => route.params.id,
  () => {
    loadPost()
  }
)

function goToEdit() {
  router.push({ name: 'board-edit', params: { id: route.params.id } })
}

function handleDelete() {
  if (!post.value) return
  if (!password.value.trim()) {
    alert('비밀번호를 입력해주세요.')
    return
  }
  if (!validatePassword(post.value.id, password.value)) {
    alert('비밀번호가 올바르지 않습니다.')
    return
  }
  if (!window.confirm('정말 삭제하시겠습니까?')) return
  deletePost(post.value.id)
  router.push({ name: 'board-list' })
}

function handleLike() {
  if (!post.value) return
  toggleLike(post.value.id)
  fetchPost()
}

function handleBookmark() {
  if (!post.value) return
  toggleBookmark(post.value.id)
  fetchPost()
}
</script>

<template>
  <section class="page-hero">
    <div class="container">
      <p class="eyebrow">COMMUNITY</p>
      <h1>게시글 상세</h1>
      <p>선택한 게시물을 확인하고, 수정하거나 삭제할 수 있습니다.</p>
    </div>
  </section>

  <section class="container page-content">
    <div v-if="!post" class="empty-state">
      해당 게시글을 찾을 수 없습니다.
    </div>

    <article v-else class="post-card post-detail-card">
      <div>
        <h2>{{ post.title }}</h2>
        <p class="post-content">{{ post.content }}</p>
        <div class="post-meta">
          <span>{{ post.author }} · {{ post.createdAt }}</span>
          <span>조회 {{ post.views }}</span>
        </div>
        <div class="post-meta">
          <span>좋아요 {{ post.likes }}</span>
          <span>{{ post.bookmarked ? '북마크됨' : '북마크되지 않음' }}</span>
        </div>
      </div>

      <div class="detail-actions">
        <button class="button button-primary" type="button" @click="handleLike">좋아요</button>
        <button class="button button-secondary" type="button" @click="handleBookmark">{{ post.bookmarked ? '북마크 해제' : '북마크' }}</button>
        <button class="button button-outline" type="button" @click="goToEdit">수정</button>
      </div>

      <label class="post-form-label">
        삭제 비밀번호
        <input v-model="password" type="password" placeholder="삭제용 비밀번호를 입력하세요" />
      </label>
      <button class="button button-danger" type="button" @click="handleDelete">삭제</button>
    </article>
  </section>
</template>
