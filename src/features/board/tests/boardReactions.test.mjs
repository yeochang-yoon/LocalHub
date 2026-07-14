import assert from 'node:assert/strict'

let storedPosts = JSON.stringify([
  {
    id: 101,
    title: '반응 테스트 게시글',
    author: '작성자',
    content: '좋아요와 북마크 동작을 확인합니다.',
    password: 'secret',
    likes: -3,
    bookmarked: true,
    bookmarkCount: 99,
    views: 'invalid',
    createdAt: '2026-07-14',
  },
  {
    id: 102,
    title: '두 번째 게시글',
    author: '다른 작성자',
    content: '북마크 해제 상태를 확인합니다.',
    password: 'secret2',
    likes: '2',
    bookmarked: false,
    bookmarkCount: -5,
    views: 3,
    createdAt: '2026-07-15',
  },
])

globalThis.localStorage = {
  getItem: () => storedPosts,
  setItem: (_key, value) => {
    storedPosts = value
  },
}

const {
  getPostById,
  loadPosts,
  searchPostsForChat,
  toggleBookmark,
  toggleLike,
} = await import('../services/boardStorage.js')

const normalizedPosts = loadPosts()
assert.equal(normalizedPosts[0].likes, 0)
assert.equal(normalizedPosts[0].views, 0)
assert.equal(normalizedPosts[0].bookmarked, true)
assert.equal(normalizedPosts[0].bookmarkCount, 1)
assert.equal(normalizedPosts[1].likes, 2)
assert.equal(normalizedPosts[1].bookmarked, false)
assert.equal(normalizedPosts[1].bookmarkCount, 0)

toggleLike(101)
assert.equal(getPostById(101).likes, 1)
toggleLike(101)
assert.equal(getPostById(101).likes, 2)

toggleBookmark(101)
assert.equal(getPostById(101).bookmarked, false)
assert.equal(getPostById(101).bookmarkCount, 0)
toggleBookmark(101)
assert.equal(getPostById(101).bookmarked, true)
assert.equal(getPostById(101).bookmarkCount, 1)

toggleBookmark(102)
assert.equal(getPostById(102).bookmarked, true)
assert.equal(getPostById(102).bookmarkCount, 1)
toggleBookmark(102)
assert.equal(getPostById(102).bookmarked, false)
assert.equal(getPostById(102).bookmarkCount, 0)

const chatResults = searchPostsForChat(['반응'], 4)
assert.equal(chatResults.length, 1)
assert.equal(chatResults[0].id, 101)
assert.equal(chatResults[0].likes, 2)
assert.equal('password' in chatResults[0], false)

console.log('Board reaction test passed')
