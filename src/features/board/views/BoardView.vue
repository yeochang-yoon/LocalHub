<script setup>
import { ref } from 'vue'
import { loadPosts, savePosts } from '../services/boardStorage'

const posts = ref(loadPosts())
const isWriting = ref(false)
const form = ref({ title: '', author: '', content: '' })

function submitPost() {
  if (!form.value.title.trim() || !form.value.author.trim() || !form.value.content.trim()) return
  posts.value = [{ id: Date.now(), ...form.value, createdAt: new Date().toLocaleDateString('sv-SE') }, ...posts.value]
  savePosts(posts.value)
  form.value = { title: '', author: '', content: '' }
  isWriting.value = false
}

function deletePost(id) {
  if (!window.confirm('이 글을 삭제할까요?')) return
  posts.value = posts.value.filter((post) => post.id !== id)
  savePosts(posts.value)
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
      <p>전체 <strong>{{ posts.length }}</strong>개</p>
      <button class="button button-primary" type="button" @click="isWriting = !isWriting">{{ isWriting ? '작성 취소' : '새 글 쓰기' }}</button>
    </div>
    <form v-if="isWriting" class="post-form" @submit.prevent="submitPost">
      <label>제목<input v-model="form.title" required maxlength="80" placeholder="제목을 입력하세요" /></label>
      <label>작성자<input v-model="form.author" required maxlength="20" placeholder="이름을 입력하세요" /></label>
      <label>내용<textarea v-model="form.content" required rows="5" placeholder="이야기를 들려주세요"></textarea></label>
      <button class="button button-primary" type="submit">등록하기</button>
    </form>
    <div class="post-list">
      <article v-for="post in posts" :key="post.id" class="post-card">
        <div>
          <h2>{{ post.title }}</h2>
          <p>{{ post.content }}</p>
          <span>{{ post.author }} · {{ post.createdAt }}</span>
        </div>
        <button class="text-button danger" type="button" @click="deletePost(post.id)">삭제</button>
      </article>
      <p v-if="!posts.length" class="empty-state">첫 번째 이야기를 작성해 주세요.</p>
    </div>
  </section>
</template>
