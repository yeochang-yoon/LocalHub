<script setup>
import { ref, computed, watchEffect } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  createPost,
  getPostById,
  updatePost,
  validatePassword,
} from '../services/boardStorage'

const router = useRouter()
const route = useRoute()
const isEditMode = computed(() => Boolean(route.params.id))
const form = ref({ title: '', author: '', content: '', password: '' })
const currentPost = ref(null)

function loadForm() {
  if (!isEditMode.value) {
    currentPost.value = null
    form.value = { title: '', author: '', content: '', password: '' }
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
      ...currentPost.value,
      title: form.value.title,
      author: form.value.author,
      content: form.value.content,
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
</script>

<template>
  <section class="page-hero">
    <div class="container">
      <p class="eyebrow">COMMUNITY</p>
      <h1>{{ isEditMode ? '게시글 수정' : '새 글 작성' }}</h1>
      <p>{{ isEditMode ? '기존 게시글 내용을 수정할 수 있습니다.' : '부산 이웃들에게 전하고 싶은 이야기를 공유하세요.' }}</p>
    </div>
  </section>

  <section class="container page-content">
    <form class="post-form" @submit.prevent="submitForm">
      <label>
        제목
        <input v-model="form.title" required maxlength="80" placeholder="제목을 입력하세요" />
      </label>
      <label>
        작성자
        <input v-model="form.author" required maxlength="20" placeholder="이름을 입력하세요" />
      </label>
      <label>
        내용
        <textarea v-model="form.content" required rows="6" placeholder="이야기를 들려주세요"></textarea>
      </label>
      <label>
        비밀번호
        <input v-model="form.password" type="password" required maxlength="20" placeholder="수정/삭제 시 사용할 비밀번호" />
      </label>
      <div class="form-actions">
        <button class="button button-primary" type="submit">{{ isEditMode ? '수정 완료' : '등록하기' }}</button>
        <button class="button button-secondary" type="button" @click="cancel">취소</button>
      </div>
    </form>
  </section>
</template>
