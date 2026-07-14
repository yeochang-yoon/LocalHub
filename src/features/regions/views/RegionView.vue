<script setup>
import { ref, computed } from 'vue'
import { regionCategories } from '../data/regionCategories'

const query = ref('')
const filteredCategories = computed(() => regionCategories.filter((item) => item.name.includes(query.value.trim())))
</script>

<template>
  <section class="page-hero region-hero">
    <div class="container">
      <p class="eyebrow">EXPLORE BUSAN</p>
      <h1>권역 정보</h1>
      <p>공공데이터를 바탕으로 부산의 다양한 장소를 찾아보세요.</p>
      <label class="search-box">
        <span class="sr-only">분류 검색</span>
        <input v-model="query" type="search" placeholder="어떤 정보를 찾고 계신가요?" />
        <span aria-hidden="true">⌕</span>
      </label>
    </div>
  </section>
  <section class="container page-content">
    <div class="region-grid">
      <article v-for="item in filteredCategories" :key="item.name" class="region-card">
        <span class="service-icon">{{ item.icon }}</span>
        <div><h2>{{ item.name }}</h2><p>{{ item.description }}</p></div>
        <strong>{{ item.count.toLocaleString() }}곳</strong>
      </article>
    </div>
    <p v-if="!filteredCategories.length" class="empty-state">일치하는 분류가 없습니다.</p>
    <p class="source-note">데이터 출처: 한국관광공사 TourAPI 4.0 · 공공누리 제3유형</p>
  </section>
</template>
