<script setup>
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { DEFAULT_POST_CATEGORY } from '../data/boardOptions.js'
import { formatPostDate } from '../utils/boardDate.js'
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
const deletePassword = ref('')
const deleteError = ref('')
let viewedPostId = null

function refreshPost() {
  post.value = getPostById(route.params.id)
}

function loadPost(postId) {
  deletePassword.value = ''
  deleteError.value = ''

  const normalizedId = String(postId ?? '')
  if (viewedPostId === normalizedId) {
    refreshPost()
    return
  }

  viewedPostId = normalizedId
  post.value = incrementViews(postId)
}

watch(
  () => route.params.id,
  (postId) => {
    loadPost(postId)
  },
  { immediate: true }
)

function goToEdit() {
  if (!post.value) return
  router.push({ name: 'board-edit', params: { id: post.value.id } })
}

function handleDelete() {
  if (!post.value) return

  deleteError.value = ''
  if (!deletePassword.value.trim()) {
    deleteError.value = '삭제 비밀번호를 입력해주세요.'
    return
  }
  if (!validatePassword(post.value.id, deletePassword.value)) {
    deleteError.value = '비밀번호가 올바르지 않습니다.'
    return
  }
  if (!window.confirm('정말 삭제하시겠습니까?')) return

  deletePost(post.value.id)
  deletePassword.value = ''
  router.push({ name: 'board-list' })
}

function handleLike() {
  if (!post.value) return
  toggleLike(post.value.id)
  refreshPost()
}

function handleBookmark() {
  if (!post.value) return
  toggleBookmark(post.value.id)
  refreshPost()
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

  <section class="container page-content board-page">
    <div v-if="!post" class="empty-state board-card board-detail-empty">
      해당 게시글을 찾을 수 없습니다.
    </div>

    <article v-else class="board-detail-card board-card">
      <header class="board-detail-header">
        <span class="board-badge">{{ post.postCategory || DEFAULT_POST_CATEGORY }}</span>
        <h2>{{ post.title }}</h2>

        <dl class="board-detail-meta board-meta">
          <div>
            <dt>작성자</dt>
            <dd>{{ post.author || '작성자 미상' }}</dd>
          </div>
          <div>
            <dt>작성일</dt>
            <dd>
              <time :datetime="post.createdAt || undefined">{{ formatPostDate(post.createdAt) }}</time>
            </dd>
          </div>
          <div v-if="post.updatedAt">
            <dt>수정일</dt>
            <dd>
              <time :datetime="post.updatedAt">{{ formatPostDate(post.updatedAt, '수정일 미상') }}</time>
            </dd>
          </div>
          <div>
            <dt>조회수</dt>
            <dd>{{ post.views || 0 }}</dd>
          </div>
          <div>
            <dt>좋아요</dt>
            <dd>{{ post.likes || 0 }}</dd>
          </div>
          <div>
            <dt>북마크</dt>
            <dd>{{ post.bookmarkCount || 0 }}</dd>
          </div>
        </dl>
      </header>

      <section class="board-detail-content" aria-label="게시글 본문">
        <p>{{ post.content }}</p>
      </section>

      <section v-if="post.place" class="board-detail-place board-subcard" aria-labelledby="board-place-title">
        <h3 id="board-place-title">등록된 장소</h3>
        <dl>
          <div>
            <dt>장소 카테고리</dt>
            <dd>{{ post.place.category }}</dd>
          </div>
          <div>
            <dt>장소명</dt>
            <dd>{{ post.place.name || '이름 없는 장소' }}</dd>
          </div>
          <div>
            <dt>주소</dt>
            <dd>{{ post.place.address || '주소 정보 없음' }}</dd>
          </div>
        </dl>
      </section>

      <div class="board-detail-actions">
        <button
          class="button board-button board-button--reaction board-detail-action"
          type="button"
          :aria-label="`좋아요 ${post.likes || 0}개, 누르면 좋아요 추가`"
          @click="handleLike"
        >
          좋아요 {{ post.likes || 0 }}
        </button>
        <button
          class="button board-button board-button--reaction board-detail-action"
          :class="{ active: post.bookmarked }"
          type="button"
          :aria-pressed="Boolean(post.bookmarked)"
          @click="handleBookmark"
        >
          {{ post.bookmarked ? '북마크 취소' : '북마크' }} {{ post.bookmarkCount || 0 }}
        </button>
        <button
          class="button board-button board-button--outline board-detail-action"
          type="button"
          @click="goToEdit"
        >
          수정
        </button>
      </div>

      <section class="board-delete-section" aria-labelledby="board-delete-title">
        <div>
          <h3 id="board-delete-title">게시글 삭제</h3>
          <p>작성할 때 등록한 비밀번호를 확인한 후 삭제할 수 있습니다.</p>
        </div>

        <form class="board-delete-form" @submit.prevent="handleDelete">
          <label class="board-field" for="board-delete-password">삭제 비밀번호</label>
          <div class="board-delete-controls">
            <input
              id="board-delete-password"
              v-model="deletePassword"
              class="board-control"
              type="password"
              autocomplete="current-password"
              placeholder="삭제용 비밀번호를 입력하세요"
              :aria-invalid="Boolean(deleteError)"
              :aria-describedby="deleteError ? 'board-delete-error' : undefined"
              @input="deleteError = ''"
            />
            <button class="button board-button board-button--danger board-delete-button" type="submit">삭제</button>
          </div>
          <p v-if="deleteError" id="board-delete-error" class="board-error" role="alert">
            {{ deleteError }}
          </p>
        </form>
      </section>
    </article>
  </section>
</template>

<style scoped>
.board-detail-empty {
  min-height: 160px;
}

.board-detail-card {
  overflow: hidden;
}

.board-detail-header {
  padding: 30px;
  border-bottom: 1px solid #eef0ec;
}

.board-detail-header h2 {
  margin: 14px 0 24px;
  color: var(--green);
  font-size: 34px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.board-detail-meta {
  gap: 10px 22px;
}

.board-detail-meta div {
  display: flex;
  gap: 7px;
}

.board-detail-meta dt,
.board-detail-meta dd {
  margin: 0;
}

.board-detail-meta dt {
  color: #929a96;
}

.board-detail-meta dd {
  color: #5d6862;
  font-weight: 600;
}

.board-detail-content {
  min-height: 220px;
  padding: 34px 30px;
}

.board-detail-content p {
  margin: 0;
  color: #39443f;
  line-height: 1.9;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.board-detail-place {
  margin: 0 30px 30px;
  padding: 20px;
}

.board-detail-place h3 {
  margin: 0 0 14px;
  color: var(--green);
  font-size: 16px;
}

.board-detail-place dl {
  display: grid;
  gap: 10px;
  margin: 0;
}

.board-detail-place dl div {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 14px;
}

.board-detail-place dt,
.board-detail-place dd {
  margin: 0;
}

.board-detail-place dt {
  color: #7b8580;
  font-size: 13px;
}

.board-detail-place dd {
  color: #39443f;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.board-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 22px 30px;
  border-top: 1px solid #eef0ec;
}

.board-detail-action {
  min-width: 140px;
}

.board-delete-section {
  display: grid;
  grid-template-columns: minmax(200px, .8fr) minmax(320px, 1.2fr);
  gap: 24px;
  padding: 24px 30px 30px;
  border-top: 1px solid #eef0ec;
  background: #fcfaf8;
}

.board-delete-section h3 {
  margin: 0 0 6px;
  color: #8f3f30;
  font-size: 16px;
}

.board-delete-section > div > p {
  margin: 0;
  color: #7b8580;
  font-size: 13px;
  line-height: 1.6;
}

.board-delete-form {
  display: grid;
  gap: 8px;
}

.board-delete-controls {
  display: flex;
  gap: 8px;
}

.board-delete-controls input {
  flex: 1;
}

.board-delete-button {
  flex: 0 0 auto;
}
</style>
