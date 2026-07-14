<script setup>
import {
  BOARD_CATEGORY_FILTERS,
  BOARD_SEARCH_TARGETS,
  BOARD_SORT_OPTIONS,
} from '../data/boardOptions.js'

defineProps({
  searchTarget: {
    type: String,
    required: true,
  },
  query: {
    type: String,
    required: true,
  },
  sortOrder: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
})

defineEmits([
  'update:searchTarget',
  'update:query',
  'update:sortOrder',
  'update:category',
])
</script>

<template>
  <div class="board-filter-bar board-card" aria-label="게시글 검색 및 필터">
    <label class="board-field">
      검색 대상
      <select class="board-control" :value="searchTarget" @change="$emit('update:searchTarget', $event.target.value)">
        <option v-for="target in BOARD_SEARCH_TARGETS" :key="target.value" :value="target.value">
          {{ target.label }}
        </option>
      </select>
    </label>

    <label class="board-field">
      검색어
      <input
        class="board-control"
        :value="query"
        type="search"
        :placeholder="searchTarget === 'author' ? '작성자를 입력하세요' : '제목을 입력하세요'"
        @input="$emit('update:query', $event.target.value)"
      />
    </label>

    <label class="board-field">
      정렬
      <select class="board-control" :value="sortOrder" @change="$emit('update:sortOrder', $event.target.value)">
        <option v-for="option in BOARD_SORT_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>

    <label class="board-field">
      카테고리
      <select class="board-control" :value="category" @change="$emit('update:category', $event.target.value)">
        <option v-for="option in BOARD_CATEGORY_FILTERS" :key="option" :value="option">
          {{ option }}
        </option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.board-filter-bar {
  display: grid;
  grid-template-columns: 140px minmax(220px, 1fr) 150px 150px;
  gap: 12px;
  margin-bottom: 22px;
  padding: 20px;
}

@media (max-width: 760px) {
  .board-filter-bar {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 520px) {
  .board-filter-bar {
    grid-template-columns: 1fr;
    padding: 16px;
  }
}
</style>
