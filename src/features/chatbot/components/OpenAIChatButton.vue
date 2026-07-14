<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { askOpenAI } from '../services/openai'

const MESSAGE_STORAGE_KEY = 'localhub-chat-messages'
const PANEL_STORAGE_KEY = 'localhub-chat-panel-open'
const MAX_MESSAGES = 24

const quickPrompts = [
  { label: '관광지 추천', prompt: '해운대 근처 관광지 3곳 추천해줘' },
  { label: '축제 일정', prompt: '지금 열리는 부산 축제 알려줘' },
  { label: '커뮤니티 검색', prompt: '게시글에서 광안리 후기 찾아줘' },
  { label: '숙박 코스', prompt: '숙박과 여행코스를 같이 추천해줘' },
  { label: '모범음식점', prompt: '모범음식점 위치 알려줘' },
]

const welcomeMessage = {
  id: createMessageId(),
  role: 'assistant',
  content: '안녕하세요. 부산 관광지, 축제, 숙박, 쇼핑, 커뮤니티 게시글을 바로 찾아드릴게요.',
}

const isOpen = ref(false)
const input = ref('')
const loading = ref(false)
const messages = ref([welcomeMessage])
const messageArea = ref(null)

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createMessage(role, content) {
  return { id: createMessageId(), role, content }
}

function loadState() {
  try {
    const savedMessages = JSON.parse(localStorage.getItem(MESSAGE_STORAGE_KEY))
    if (Array.isArray(savedMessages) && savedMessages.length) {
      messages.value = savedMessages
    }
    isOpen.value = localStorage.getItem(PANEL_STORAGE_KEY) === 'true'
  } catch {
    messages.value = [welcomeMessage]
  }
}

function persistState() {
  localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(messages.value.slice(-MAX_MESSAGES)))
  localStorage.setItem(PANEL_STORAGE_KEY, String(isOpen.value))
}

async function scrollToBottom() {
  await nextTick()
  const area = messageArea.value
  if (!area) return
  area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' })
}

async function sendMessage(text = input.value) {
  const content = text.trim()
  if (!content || loading.value) return

  const shouldClearInput = text === input.value
  if (shouldClearInput) input.value = ''
  isOpen.value = true
  messages.value = [...messages.value, createMessage('user', content)].slice(-MAX_MESSAGES)
  loading.value = true
  await scrollToBottom()

  try {
    const reply = await askOpenAI(messages.value.map(({ role, content }) => ({ role, content })))
    messages.value = [...messages.value, createMessage('assistant', reply)].slice(-MAX_MESSAGES)
  } catch (error) {
    messages.value = [...messages.value, createMessage('assistant', error?.message || '답변을 가져오지 못했습니다.')].slice(-MAX_MESSAGES)
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

function useQuickPrompt(prompt) {
  input.value = prompt
  sendMessage(prompt)
}

function closePanel() {
  isOpen.value = false
}

onMounted(loadState)
watch([messages, isOpen], persistState, { deep: true })
</script>

<template>
  <transition name="chat-fade">
    <button v-if="isOpen" class="chat-backdrop" type="button" aria-label="채팅 닫기" @click="closePanel"></button>
  </transition>

  <aside v-if="isOpen" class="chat-panel" aria-label="AI 부산 도우미">
    <header class="chat-header">
      <div>
        <strong>AI 부산 도우미</strong>
        <span>JSON 지역정보 · 커뮤니티 게시글 검색</span>
      </div>
      <button type="button" aria-label="채팅 닫기" @click="closePanel">×</button>
    </header>

    <div class="chat-suggestions" aria-label="빠른 질문">
      <button v-for="item in quickPrompts" :key="item.label" type="button" @click="useQuickPrompt(item.prompt)">
        {{ item.label }}
      </button>
    </div>

    <div ref="messageArea" class="chat-messages" aria-live="polite">
      <article v-for="message in messages" :key="message.id" :class="['chat-message', message.role]">
        <span class="chat-role">{{ message.role === 'assistant' ? 'AI' : '나' }}</span>
        <p>{{ message.content }}</p>
      </article>
      <p v-if="loading" class="chat-message assistant chat-loading">답변을 찾고 있어요…</p>
    </div>

    <form class="chat-form" @submit.prevent="sendMessage()">
      <input v-model="input" aria-label="메시지" placeholder="예: 해운대 관광지 추천해줘" />
      <button type="submit" :disabled="loading || !input.trim()" aria-label="전송">↑</button>
    </form>
    <small class="chat-source">출처: 한국관광공사 TourAPI 4.0 · 공공누리 제3유형</small>
  </aside>

  <button data-chat-trigger class="chat-trigger" type="button" :aria-expanded="isOpen" aria-label="AI 챗봇 열기" @click="isOpen = !isOpen">
    ✦<span>AI에게 물어보기</span>
  </button>
</template>
