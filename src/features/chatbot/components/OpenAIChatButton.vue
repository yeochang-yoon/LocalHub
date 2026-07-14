<script setup>
import { nextTick, ref } from 'vue'
import { askOpenAI } from '../services/openai'

const isOpen = ref(false)
const input = ref('')
const loading = ref(false)
const messages = ref([{ role: 'assistant', content: '안녕하세요! 부산에 대해 무엇이 궁금하신가요?' }])
const messageArea = ref(null)

async function sendMessage() {
  const content = input.value.trim()
  if (!content || loading.value) return
  messages.value.push({ role: 'user', content })
  input.value = ''
  loading.value = true
  await nextTick()
  messageArea.value?.scrollTo({ top: messageArea.value.scrollHeight, behavior: 'smooth' })
  try {
    const history = messages.value.filter((message) => message.role !== 'assistant' || messages.value.indexOf(message) > 0)
    messages.value.push({ role: 'assistant', content: await askOpenAI(history) })
  } catch (error) {
    messages.value.push({ role: 'assistant', content: error.message })
  } finally {
    loading.value = false
    await nextTick()
    messageArea.value?.scrollTo({ top: messageArea.value.scrollHeight, behavior: 'smooth' })
  }
}
</script>

<template>
  <aside v-if="isOpen" class="chat-panel" aria-label="AI 부산 도우미">
    <header><div><strong>AI 부산 도우미</strong><span>궁금한 것을 물어보세요</span></div><button type="button" aria-label="채팅 닫기" @click="isOpen = false">×</button></header>
    <div ref="messageArea" class="chat-messages" aria-live="polite">
      <p v-for="(message, index) in messages" :key="index" :class="['chat-message', message.role]">{{ message.content }}</p>
      <p v-if="loading" class="chat-message assistant">답변을 생각하고 있어요…</p>
    </div>
    <form class="chat-form" @submit.prevent="sendMessage">
      <input v-model="input" aria-label="메시지" placeholder="메시지를 입력하세요" />
      <button type="submit" :disabled="loading || !input.trim()" aria-label="전송">↑</button>
    </form>
  </aside>
  <button data-chat-trigger class="chat-trigger" type="button" :aria-expanded="isOpen" aria-label="AI 챗봇 열기" @click="isOpen = !isOpen">✦<span>AI에게 물어보기</span></button>
</template>
