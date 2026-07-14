import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractOpenAIText } from '../src/features/chatbot/services/openaiResponse.js'

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  const entries = {}
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    entries[key] = value
  }

  return entries
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envFromFile = parseEnvFile(path.join(projectRoot, '.env'))
const apiKey = process.env.VITE_OPENAI_API_KEY || envFromFile.VITE_OPENAI_API_KEY
const model = process.env.VITE_OPENAI_MODEL || envFromFile.VITE_OPENAI_MODEL || 'gpt-5-mini'

if (!apiKey) {
  throw new Error('VITE_OPENAI_API_KEY가 .env 또는 현재 환경 변수에 없습니다.')
}

const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model,
    input: [
      {
        role: 'user',
        content: '부산 관광지 추천을 1문장으로 테스트 응답해줘.',
      },
    ],
  }),
})

const responseText = await response.text()

if (!response.ok) {
  console.error('OpenAI request failed')
  console.error(`status: ${response.status}`)
  console.error(responseText)
  process.exitCode = 1
} else {
  let parsed = null
  try {
    parsed = JSON.parse(responseText)
  } catch {
    console.log('OpenAI request succeeded')
    console.log(responseText)
    process.exitCode = 0
    process.exit()
  }

  const outputText = extractOpenAIText(parsed)
  console.log('OpenAI request succeeded')
  console.log(outputText || '(no text output)')
}
