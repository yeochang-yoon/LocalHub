import assert from 'node:assert/strict'

let writeCount = 0
let storedPosts = JSON.stringify([
  {
    id: 201,
    title: null,
    author: 42,
    content: '기존 데이터 호환 게시글',
    password: 1234,
    postCategory: '허용되지 않은 카테고리',
    place: {},
    likes: -7,
    bookmarked: 'true',
    bookmarkCount: 88,
    views: '3.8',
    createdAt: '2024-02-29',
    updatedAt: '',
  },
])

globalThis.localStorage = {
  getItem: () => storedPosts,
  setItem: (_key, value) => {
    writeCount += 1
    storedPosts = value
  },
}

const {
  createPost,
  getPostById,
  loadPosts,
  searchPostsForChat,
  updatePost,
} = await import('../services/boardStorage.js')
const { formatPostDate, getPostTimestamp } = await import('../utils/boardDate.js')

const [legacyPost] = loadPosts()
assert.equal(writeCount, 0, '게시글을 읽을 때 localStorage를 덮어쓰면 안 됩니다.')
assert.equal(legacyPost.title, '')
assert.equal(legacyPost.author, '42')
assert.equal(legacyPost.password, '1234')
assert.equal(legacyPost.postCategory, '일반')
assert.equal(legacyPost.place, null)
assert.equal(legacyPost.likes, 0)
assert.equal(legacyPost.views, 3)
assert.equal(legacyPost.bookmarked, true)
assert.equal(legacyPost.bookmarkCount, 1)
assert.equal(legacyPost.createdAt, '2024-02-29')
assert.equal(legacyPost.updatedAt, null)

updatePost({
  id: 201,
  title: '수정된 기존 게시글',
  author: '수정 작성자',
  content: '수정 내용',
  postCategory: '후기',
  place: null,
})

const updatedPost = getPostById(201)
assert.equal(updatedPost.password, '1234')
assert.equal(updatedPost.createdAt, '2024-02-29')
assert.equal(updatedPost.postCategory, '후기')
assert.equal(updatedPost.place, null)
assert.equal(updatedPost.likes, 0)
assert.equal(updatedPost.views, 3)
assert.equal(updatedPost.bookmarkCount, 1)
assert.ok(Number.isFinite(Date.parse(updatedPost.updatedAt)))

const createdPost = createPost({
  title: '신규 호환 테스트',
  author: '테스터',
  content: '신규 게시글 내용',
  password: 'new-secret',
  postCategory: '잘못된 값',
  place: null,
})
assert.equal(createdPost.postCategory, '일반')
assert.equal(createdPost.place, null)
assert.equal(createdPost.likes, 0)
assert.equal(createdPost.views, 0)
assert.equal(createdPost.bookmarked, false)
assert.equal(createdPost.bookmarkCount, 0)
assert.equal(createdPost.updatedAt, null)
assert.ok(Number.isFinite(Date.parse(createdPost.createdAt)))

assert.notEqual(getPostTimestamp('2024-02-29'), null)
assert.equal(getPostTimestamp('2024-02-30'), null)
assert.equal(getPostTimestamp('유효하지 않은 날짜'), null)
assert.notEqual(formatPostDate('2024-02-29'), '작성일 미상')
assert.notEqual(formatPostDate('2026-07-14T09:30:00.000Z'), '작성일 미상')
assert.equal(formatPostDate('유효하지 않은 날짜'), '작성일 미상')
assert.equal(formatPostDate(null, '수정일 미상'), '수정일 미상')

const chatResults = searchPostsForChat(['수정된'], 4)
assert.equal(chatResults.length, 1)
assert.deepEqual(Object.keys(chatResults[0]), [
  'id',
  'title',
  'author',
  'content',
  'createdAt',
  'views',
  'likes',
])
assert.equal('password' in chatResults[0], false)

console.log('Board compatibility and date test passed')
