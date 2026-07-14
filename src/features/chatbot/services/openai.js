export async function askOpenAI(messages) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) throw new Error('VITE_OPENAI_API_KEY가 설정되지 않았습니다.')

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4.1-mini',
      instructions: '당신은 친절하고 간결한 부산 지역 안내 도우미입니다. 한국어로 답하세요.',
      input: messages.map(({ role, content }) => ({ role, content })),
    }),
  })
  if (!response.ok) throw new Error('AI 응답을 불러오지 못했습니다.')
  const data = await response.json()
  return data.output_text || '응답 내용이 없습니다.'
}
