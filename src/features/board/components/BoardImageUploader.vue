<script setup>
import { ref } from 'vue'

const props = defineProps({
  image: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['change'])

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 1600
const JPEG_QUALITY = 0.82
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const fileInput = ref(null)
const isProcessing = ref(false)
const errorMessage = ref('')

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'))
    image.src = dataUrl
  })
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'))
    reader.readAsDataURL(file)
  })
}

async function compressImage(file) {
  const source = await readFile(file)
  const sourceImage = await loadImage(source)
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight))
  const width = Math.max(1, Math.round(sourceImage.naturalWidth * scale))
  const height = Math.max(1, Math.round(sourceImage.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('이미지를 처리할 수 없는 브라우저입니다.')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(sourceImage, 0, 0, width, height)

  return {
    dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY),
    name: file.name,
    type: 'image/jpeg',
    width,
    height,
  }
}

async function handleFileChange(event) {
  const [file] = event.target.files || []
  if (!file) return

  errorMessage.value = ''
  if (!ACCEPTED_TYPES.has(file.type)) {
    errorMessage.value = 'JPG, PNG, WEBP 형식의 이미지만 등록할 수 있습니다.'
    event.target.value = ''
    return
  }
  if (file.size > MAX_FILE_SIZE) {
    errorMessage.value = '10MB 이하의 이미지를 선택해주세요.'
    event.target.value = ''
    return
  }

  isProcessing.value = true
  try {
    emit('change', await compressImage(file))
  } catch (error) {
    errorMessage.value = error?.message || '이미지 처리 중 오류가 발생했습니다.'
  } finally {
    isProcessing.value = false
    event.target.value = ''
  }
}

function openFilePicker() {
  if (!isProcessing.value) fileInput.value?.click()
}

function removeImage() {
  errorMessage.value = ''
  emit('change', null)
}
</script>

<template>
  <section class="board-image-uploader board-subcard" aria-labelledby="board-image-title">
    <div class="board-image-heading">
      <div>
        <strong id="board-image-title">사진 등록</strong>
        <p>JPG, PNG, WEBP · 최대 10MB · 게시글당 1장</p>
      </div>
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        @change="handleFileChange"
      />
      <button
        class="button board-button board-button--outline"
        type="button"
        :disabled="isProcessing"
        @click="openFilePicker"
      >
        {{ isProcessing ? '사진 처리 중…' : image ? '사진 변경' : '사진 선택' }}
      </button>
    </div>

    <div v-if="image" class="board-image-preview">
      <img :src="image.dataUrl" :alt="`${image.name || '등록한 사진'} 미리보기`" />
      <div>
        <span>{{ image.name || '등록한 사진' }}</span>
        <button class="board-image-remove" type="button" @click="removeImage">사진 삭제</button>
      </div>
    </div>

    <p v-if="errorMessage" class="board-error" role="alert">{{ errorMessage }}</p>
  </section>
</template>

<style scoped>
.board-image-uploader {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.board-image-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.board-image-heading strong {
  color: var(--green);
}

.board-image-heading p {
  margin: 5px 0 0;
  color: #6d7772;
  font-size: 13px;
}

.board-image-preview {
  display: grid;
  grid-template-columns: minmax(0, 240px) 1fr;
  gap: 14px;
  align-items: center;
}

.board-image-preview img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 10px;
  background: #eef2ed;
}

.board-image-preview > div {
  display: grid;
  justify-items: start;
  gap: 10px;
  min-width: 0;
}

.board-image-preview span {
  max-width: 100%;
  overflow: hidden;
  color: #5d6862;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.board-image-remove {
  padding: 0;
  color: #a34435;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-weight: 700;
}

@media (max-width: 640px) {
  .board-image-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .board-image-preview {
    grid-template-columns: 1fr;
  }
}
</style>
