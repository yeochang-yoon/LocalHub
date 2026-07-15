import { DEFAULT_POST_CATEGORY, POST_CATEGORIES } from '../data/boardOptions.js'

const STORAGE_KEY = 'localhub-board-posts'

const seedPosts = [
  {
    id: 1,
    title: 'LocalHub 게시판에 오신 것을 환영합니다',
    author: '운영자',
    content: '부산의 유용한 소식과 경험을 함께 나눠주세요.',
    createdAt: '2026-07-14',
    password: 'admin',
    postCategory: DEFAULT_POST_CATEGORY,
    place: null,
    likes: 0,
    bookmarked: false,
    bookmarkCount: 0,
    views: 0,
    updatedAt: null,
  },
]

function normalizeString(value) {
  return String(value ?? '')
}

function normalizeCount(value, fallback = 0) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(0, Math.trunc(number))
}

function normalizeBookmarked(value) {
  return value === true || value === 'true' || value === 1
}

function normalizePlace(place) {
  if (!place || typeof place !== 'object' || Array.isArray(place)) return null

  const normalizedPlace = {
    contentId: normalizeString(place.contentId),
    category: normalizeString(place.category),
    name: normalizeString(place.name),
    address: normalizeString(place.address),
  }

  return Object.values(normalizedPlace).some((value) => value.trim())
    ? normalizedPlace
    : null
}

export function normalizePost(post) {
  const source = post && typeof post === 'object' && !Array.isArray(post) ? post : {}
  const bookmarked = normalizeBookmarked(source.bookmarked)
  const category = normalizeString(source.postCategory)

  return {
    ...source,
    title: normalizeString(source.title),
    author: normalizeString(source.author),
    content: normalizeString(source.content),
    password: normalizeString(source.password),
    postCategory: POST_CATEGORIES.includes(category) ? category : DEFAULT_POST_CATEGORY,
    place: normalizePlace(source.place),
    likes: normalizeCount(source.likes),
    bookmarked,
    bookmarkCount: bookmarked ? 1 : 0,
    views: normalizeCount(source.views),
    createdAt: normalizeString(source.createdAt),
    updatedAt: source.updatedAt == null || source.updatedAt === ''
      ? null
      : normalizeString(source.updatedAt),
  }
}

function getStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    const posts = Array.isArray(saved) ? saved : seedPosts
    return posts.map(normalizePost)
  } catch {
    return seedPosts.map(normalizePost)
  }
}

function persistPosts(posts) {
  const normalizedPosts = Array.isArray(posts) ? posts.map(normalizePost) : []
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedPosts))
}

export function loadPosts() {
  return getStorage()
}

export function getPostsByContentId(contentId) {
  const normalizedContentId = normalizeString(contentId).trim()
  if (!normalizedContentId) return []

  return getStorage().filter(
    (post) => normalizeString(post.place?.contentId).trim() === normalizedContentId,
  )
}

export function getPostById(id) {
  const posts = getStorage()
  return posts.find((post) => String(post.id) === String(id)) || null
}

export function createPost({ title, author, content, password, postCategory, place }) {
  const posts = getStorage()
  const newPost = normalizePost({
    id: Date.now(),
    title,
    author,
    content,
    password,
    postCategory,
    place,
    likes: 0,
    bookmarked: false,
    bookmarkCount: 0,
    views: 0,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  })
  const nextPosts = [newPost, ...posts]
  persistPosts(nextPosts)
  return newPost
}

export function updatePost(updatedPost) {
  const posts = getStorage()
  const updatedAt = new Date().toISOString()
  const nextPosts = posts.map((post) => {
    if (String(post.id) !== String(updatedPost.id)) return post

    return {
      ...post,
      ...updatedPost,
      id: post.id,
      password: post.password,
      likes: post.likes,
      bookmarked: post.bookmarked,
      bookmarkCount: post.bookmarkCount,
      views: post.views,
      createdAt: post.createdAt,
      updatedAt,
    }
  })
  persistPosts(nextPosts)
}

export function deletePost(id) {
  const posts = getStorage()
  const nextPosts = posts.filter((post) => String(post.id) !== String(id))
  persistPosts(nextPosts)
}

export function validatePassword(id, password) {
  const post = getPostById(id)
  return Boolean(post && post.password === password)
}

export function toggleLike(id) {
  const posts = getStorage()
  const nextPosts = posts.map((post) => {
    if (String(post.id) !== String(id)) return post
    return { ...post, likes: (post.likes || 0) + 1 }
  })
  persistPosts(nextPosts)
}

export function toggleBookmark(id) {
  const posts = getStorage()
  const nextPosts = posts.map((post) => {
    if (String(post.id) !== String(id)) return post
    const bookmarked = !post.bookmarked
    return {
      ...post,
      bookmarked,
      bookmarkCount: bookmarked ? 1 : 0,
    }
  })
  persistPosts(nextPosts)
}

export function searchPostsForChat(tokens = [], limit = 4) {
  const searchTokens = tokens
    .map((token) => String(token).trim().toLowerCase())
    .filter(Boolean)

  return getStorage()
    .map((post) => {
      const title = String(post.title || '').toLowerCase()
      const content = String(post.content || '').toLowerCase()
      const author = String(post.author || '').toLowerCase()
      const score = searchTokens.reduce((total, token) => {
        if (title.includes(token)) return total + 5
        if (content.includes(token)) return total + 3
        if (author.includes(token)) return total + 2
        return total
      }, 0)
      return { post, score }
    })
    .filter(({ score }) => !searchTokens.length || score > 0)
    .sort((left, right) => right.score - left.score || Number(right.post.id) - Number(left.post.id))
    .slice(0, limit)
    .map(({ post }) => ({
      id: post.id,
      title: post.title,
      author: post.author,
      content: post.content,
      createdAt: post.createdAt,
      views: post.views || 0,
      likes: post.likes || 0,
    }))
}

export function incrementViews(id) {
  const posts = getStorage()
  let updatedPost = null
  const nextPosts = posts.map((post) => {
    if (String(post.id) !== String(id)) return post
    updatedPost = { ...post, views: (post.views || 0) + 1 }
    return updatedPost
  })
  persistPosts(nextPosts)
  return updatedPost
}
