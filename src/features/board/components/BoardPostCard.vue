<script setup>
import { DEFAULT_POST_CATEGORY } from '../data/boardOptions.js'
import { formatPostDate } from '../utils/boardDate.js'

defineProps({
  post: {
    type: Object,
    required: true,
  },
})

defineEmits(['like', 'bookmark'])
</script>

<template>
  <article class="board-post-card board-card">
    <div class="board-post-heading">
      <span class="board-post-category board-badge">{{ post.postCategory || DEFAULT_POST_CATEGORY }}</span>
      <RouterLink
        class="board-post-title"
        :to="{ name: 'board-detail', params: { id: post.id } }"
      >
        {{ post.title }}
      </RouterLink>
    </div>

    <p class="board-post-excerpt">{{ post.content }}</p>

    <div v-if="post.place" class="board-post-place board-subcard">
      <span>{{ post.place.category }}</span>
      <strong>{{ post.place.name || '이름 없는 장소' }}</strong>
    </div>

    <div class="board-post-meta board-meta">
      <span>{{ post.author || '작성자 미상' }}</span>
      <time :datetime="post.createdAt || undefined">{{ formatPostDate(post.createdAt) }}</time>
      <span>조회 {{ post.views || 0 }}</span>
    </div>

    <div class="board-post-actions">
      <button
        type="button"
        class="button board-button board-button--reaction board-button--compact"
        @click="$emit('like', post.id)"
      >
        좋아요 {{ post.likes || 0 }}
      </button>
      <button
        type="button"
        class="button board-button board-button--reaction board-button--compact"
        :class="{ active: post.bookmarked }"
        :aria-pressed="Boolean(post.bookmarked)"
        @click="$emit('bookmark', post.id)"
      >
        {{ post.bookmarked ? '북마크 취소' : '북마크' }} {{ post.bookmarkCount || 0 }}
      </button>
      <slot name="actions"></slot>
    </div>
  </article>
</template>

<style scoped>
.board-post-card {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 24px;
}

.board-post-heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.board-post-category {
  flex: 0 0 auto;
}

.board-post-title {
  min-width: 0;
  color: var(--green);
  font-size: 19px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.board-post-title:hover,
.board-post-title:focus-visible {
  color: var(--orange);
  text-decoration: underline;
  outline: 0;
}

.board-post-excerpt {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: #5d6862;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.board-post-place {
  display: flex;
  gap: 8px;
  min-width: 0;
  padding: 10px 12px;
  overflow-wrap: anywhere;
}

.board-post-place span {
  flex: 0 0 auto;
  color: var(--orange);
  font-size: 12px;
  font-weight: 700;
}

.board-post-place strong {
  min-width: 0;
  color: var(--green);
  font-size: 13px;
}

.board-post-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid #eef0ec;
}

@media (max-width: 760px) {
  .board-post-card {
    padding: 18px;
  }

  .board-post-heading,
  .board-post-place {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
