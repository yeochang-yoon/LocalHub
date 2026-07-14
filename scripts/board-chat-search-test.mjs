import assert from 'node:assert/strict'

const posts = [
  { id: 10, title: '광안리 야경 후기', author: '부산사람', content: '광안대교가 멋졌어요.', createdAt: '2026-07-14', password: 'secret' },
  { id: 20, title: '해운대 산책', author: '여행자', content: '아침 산책 기록입니다.', createdAt: '2026-07-15', password: 'secret2' },
]

globalThis.localStorage = {
  getItem: () => JSON.stringify(posts),
  setItem: () => {},
}

const { searchPostsForChat } = await import('../src/features/board/services/boardStorage.js')
const matches = searchPostsForChat(['광안리'], 4)

assert.equal(matches.length, 1)
assert.equal(matches[0].id, 10)
assert.equal(matches[0].title, '광안리 야경 후기')
assert.equal('password' in matches[0], false)
assert.equal(searchPostsForChat([], 4).length, 2)

console.log('Board chatbot search test passed')
