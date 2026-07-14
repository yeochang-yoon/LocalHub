<script setup>
import { ref, computed, watchEffect } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  createPost,
  getPostById,
  updatePost,
  validatePassword,
} from '../services/boardStorage'
import { DEFAULT_POST_CATEGORY, POST_CATEGORIES } from '../data/boardOptions.js'
import PlacePickerPanel from '../components/PlacePickerPanel.vue'

const router = useRouter()
const route = useRoute()
const isEditMode = computed(() => Boolean(route.params.id))

function createEmptyForm() {
  return {
    title: '',
    author: '',
    content: '',
    password: '',
    postCategory: DEFAULT_POST_CATEGORY,
    place: null,
  }
}

const form = ref(createEmptyForm())
const currentPost = ref(null)
const isPlacePickerOpen = ref(false)
const isPlaceRecommended = computed(() => ['후기', '정보'].includes(form.value.postCategory))

function loadForm() {
  if (!isEditMode.value) {
    currentPost.value = null
    form.value = createEmptyForm()
    return
  }

  const post = getPostById(route.params.id)
  if (post) {
    currentPost.value = post
    form.value = {
      title: post.title,
      author: post.author,
      content: post.content,
      password: '',
      postCategory: post.postCategory,
      place: post.place,
    }
  } else {
    currentPost.value = null
  }
}

watchEffect(() => {
  loadForm()
})

function submitForm() {
  if (!form.value.title.trim() || !form.value.author.trim() || !form.value.content.trim()) {
    alert('모든 항목을 입력해주세요.')
    return
  }

  if (isEditMode.value) {
    if (!form.value.password.trim()) {
      alert('비밀번호를 입력해주세요.')
      return
    }
    if (!currentPost.value) {
      alert('게시글을 찾을 수 없습니다.')
      return
    }
    if (!validatePassword(currentPost.value.id, form.value.password)) {
      alert('비밀번호가 올바르지 않습니다.')
      return
    }

    updatePost({
      id: currentPost.value.id,
      title: form.value.title,
      author: form.value.author,
      content: form.value.content,
      postCategory: form.value.postCategory,
      place: form.value.place,
    })
    router.push({ name: 'board-detail', params: { id: currentPost.value.id } })
    return
  }

  if (!form.value.password.trim()) {
    alert('비밀번호를 입력해주세요.')
    return
  }

  createPost({
    title: form.value.title,
    author: form.value.author,
    content: form.value.content,
    password: form.value.password,
    postCategory: form.value.postCategory,
    place: form.value.place,
  })
  router.push({ name: 'board-list' })
}

function cancel() {
  if (isEditMode.value && currentPost.value) {
    router.push({ name: 'board-detail', params: { id: currentPost.value.id } })
    return
  }
  router.push({ name: 'board-list' })
}

function selectPlace(place) {
  form.value.place = place
}

function clearPlace() {
  form.value.place = null
}
</script>

<template>
  <section class="page-hero">
    <div class="container">
      <p class="eyebrow">COMMUNITY</p>
      <h1>{{ isEditMode ? '게시글 수정' : '새 글 작성' }}</h1>
      <p>{{ isEditMode ? '기존 게시글 내용을 수정할 수 있습니다.' : '부산 이웃들에게 전하고 싶은 이야기를 공유하세요.' }}</p>
    </div>
  </section>

  <section class="container page-content board-page">
    <form class="board-form board-card" @submit.prevent="submitForm">
      <label class="board-field">
        제목
        <input v-model="form.title" class="board-control" required maxlength="80" placeholder="제목을 입력하세요" />
      </label>
      <label class="board-field">
        작성자
        <input v-model="form.author" class="board-control" required maxlength="20" placeholder="이름을 입력하세요" />
      </label>
      <label class="board-field">
        게시글 카테고리
        <select v-model="form.postCategory" class="board-control">
          <option v-for="category in POST_CATEGORIES" :key="category" :value="category">
            {{ category }}
          </option>
        </select>
      </label>
      <div class="place-registration board-subcard" :class="{ recommended: isPlaceRecommended }">
        <div class="place-registration-heading">
          <div>
            <strong>장소 등록</strong>
            <p v-if="isPlaceRecommended">후기와 정보 글은 관련 장소를 등록하면 내용을 더 쉽게 찾을 수 있어요.</p>
            <p v-else>게시글과 관련된 장소가 있다면 선택해서 등록할 수 있어요.</p>
          </div>
          <button
            class="button board-button board-button--outline place-register-button"
            type="button"
            @click="isPlacePickerOpen = true"
          >
            {{ form.place ? '장소 변경' : '장소 등록' }}
          </button>
        </div>

        <div v-if="form.place" class="selected-place board-subcard">
          <div>
            <span>{{ form.place.category }}</span>
            <strong>{{ form.place.name || '이름 없는 장소' }}</strong>
            <p>{{ form.place.address || '주소 정보 없음' }}</p>
          </div>
          <button
            class="button board-button board-button--outline board-button--compact"
            type="button"
            @click="clearPlace"
          >
            선택 해제
          </button>
        </div>
      </div>
      <label class="board-field">
        내용
        <textarea v-model="form.content" class="board-control" required rows="6" placeholder="이야기를 들려주세요"></textarea>
      </label>
      <label class="board-field">
        비밀번호
        <input
          v-model="form.password"
          class="board-control"
          type="password"
          required
          maxlength="20"
          placeholder="수정/삭제 시 사용할 비밀번호"
        />
      </label>
      <div class="board-form-actions">
        <button class="button board-button board-button--primary" type="submit">{{ isEditMode ? '수정 완료' : '등록하기' }}</button>
        <button class="button board-button board-button--outline" type="button" @click="cancel">취소</button>
      </div>
    </form>

    <PlacePickerPanel
      v-if="isPlacePickerOpen"
      :selected-place="form.place"
      @select="selectPlace"
      @clear="clearPlace"
      @close="isPlacePickerOpen = false"
    />
  </section>
</template>

<style scoped>
.board-form {
  display: grid;
  gap: 20px;
  padding: 28px;
}

.place-registration {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.place-registration.recommended {
  border-color: var(--orange);
  background: #fffaf6;
  box-shadow: 0 0 0 3px rgba(232, 111, 66, .08);
}

.place-registration-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.place-registration-heading strong {
  color: var(--green);
}

.place-registration-heading p {
  margin: 5px 0 0;
  color: #6d7772;
  font-size: 13px;
  font-weight: 400;
}

.place-register-button {
  flex: 0 0 auto;
}

.selected-place {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 14px;
  background: var(--mint);
}

.selected-place div {
  display: grid;
  gap: 4px;
}

.selected-place span {
  color: var(--orange);
  font-size: 12px;
  font-weight: 700;
}

.selected-place strong {
  color: var(--green);
}

.selected-place p {
  margin: 0;
  color: #5d6862;
  font-size: 13px;
}

.board-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}

@media (max-width: 640px) {
  .place-registration-heading,
  .selected-place {
    align-items: stretch;
    flex-direction: column;
  }

  .place-register-button {
    width: 100%;
  }

  .selected-place button {
    align-self: flex-start;
  }
}
</style>
