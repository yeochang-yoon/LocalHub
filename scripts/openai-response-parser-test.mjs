import assert from 'node:assert/strict'
import { extractOpenAIText } from '../src/features/chatbot/services/openaiResponse.js'

const responseWithReasoning = {
  output: [
    { type: 'reasoning', content: [] },
    {
      type: 'message',
      content: [{ type: 'output_text', text: '채팅방에 표시할 답변입니다.' }],
    },
  ],
}

assert.equal(extractOpenAIText(responseWithReasoning), '채팅방에 표시할 답변입니다.')
assert.equal(extractOpenAIText({ output_text: '간단한 응답' }), '간단한 응답')
assert.equal(extractOpenAIText({ output: [] }), '')

console.log('OpenAI response parser test passed')
