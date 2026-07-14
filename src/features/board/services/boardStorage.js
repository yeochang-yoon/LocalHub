const STORAGE_KEY = 'localhub-board-posts'

const seedPosts = [
  {
    id: 1,
    title: 'LocalHub 게시판에 오신 것을 환영합니다',
    author: '운영자',
    content: '부산의 유용한 소식과 경험을 함께 나눠주세요.',
    createdAt: '2026-07-14',
    password: 'admin',
    likes: 0,
    bookmarked: false,
    views: 0,
  },
]

function getStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(saved) ? saved : seedPosts
  } catch {
    return seedPosts
  }
}

function persistPosts(posts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
}

export function loadPosts() {
  return getStorage()
}

export function savePosts(posts) {
  persistPosts(posts)
}

export function getPostById(id) {
  const posts = getStorage()
  return posts.find((post) => String(post.id) === String(id)) || null
}

export function createPost({ title, author, content, password }) {
  const posts = getStorage()
  const newPost = {
    id: Date.now(),
    title,
    author,
    content,
    password,
    likes: 0,
    bookmarked: false,
    views: 0,
    createdAt: new Date().toLocaleDateString('sv-SE'),
  }
  const nextPosts = [newPost, ...posts]
  persistPosts(nextPosts)
  return newPost
}

export function updatePost(updatedPost) {
  const posts = getStorage()
  const nextPosts = posts.map((post) => (String(post.id) === String(updatedPost.id) ? { ...post, ...updatedPost } : post))
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
    return { ...post, bookmarked: !post.bookmarked }
  })
  persistPosts(nextPosts)
}

export function searchPosts(query) {
  const term = String(query).trim().toLowerCase()
  if (!term) return getStorage()
  return getStorage().filter((post) => {
    return [post.title, post.author, post.content].some((field) => field.toLowerCase().includes(term))
  })
}

export function incrementViews(id) {
  const posts = getStorage()
  const nextPosts = posts.map((post) => {
    if (String(post.id) !== String(id)) return post
    return { ...post, views: (post.views || 0) + 1 }
  })
  persistPosts(nextPosts)
}
