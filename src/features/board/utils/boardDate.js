const LEGACY_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function parseLegacyDate(value) {
  const match = value.match(LEGACY_DATE_PATTERN)
  if (!match) return null

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date.getTime()
}

export function getPostTimestamp(value) {
  const text = String(value ?? '').trim()
  if (!text) return null

  if (LEGACY_DATE_PATTERN.test(text)) return parseLegacyDate(text)

  const timestamp = Date.parse(text)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function formatPostDate(value, fallback = '작성일 미상') {
  const text = String(value ?? '').trim()
  const timestamp = getPostTimestamp(text)
  if (timestamp === null) return fallback

  const date = new Date(timestamp)
  return LEGACY_DATE_PATTERN.test(text)
    ? dateFormatter.format(date)
    : dateTimeFormatter.format(date)
}
