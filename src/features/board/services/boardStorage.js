const STORAGE_KEY = 'localhub-board-posts'

const seedPosts = [
  { id: 1, title: 'LocalHub 게시판에 오신 것을 환영합니다', author: '운영자', content: '부산의 유용한 소식과 경험을 함께 나눠주세요.', createdAt: '2026-07-14' },
]

export function loadPosts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(saved) ? saved : seedPosts
  } catch {
    return seedPosts
  }
}

export function savePosts(posts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
}
