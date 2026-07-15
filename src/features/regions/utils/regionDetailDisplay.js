const readableDateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatRegionDetailDate(value, fallback = '-') {
  const text = String(value ?? '').trim()
  if (!text) return fallback

  const compactDateTimeMatch = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  if (compactDateTimeMatch) {
    const [, yearText, monthText, dayText, hourText, minuteText, secondText] = compactDateTimeMatch
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    const hour = Number(hourText)
    const minute = Number(minuteText)
    const second = Number(secondText)
    const date = new Date(year, month - 1, day, hour, minute, second)

    const isValid =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date.getHours() === hour &&
      date.getMinutes() === minute &&
      date.getSeconds() === second

    return isValid ? readableDateTimeFormatter.format(date) : fallback
  }

  const timestamp = Date.parse(text)
  if (!Number.isFinite(timestamp)) return fallback
  return readableDateTimeFormatter.format(new Date(timestamp))
}

export function buildRegionDetailItems(selectedItem, selectedCategory) {
  if (!selectedItem) return []

  return [
    { label: '유형', value: selectedCategory || '-' },
    { label: '주소', value: [selectedItem.addr1, selectedItem.addr2].filter(Boolean).join(' ') || '-' },
    { label: '우편번호', value: selectedItem.zipcode || '-' },
    { label: '전화번호', value: selectedItem.tel || '-' },
    { label: '좌표', value: [selectedItem.mapy, selectedItem.mapx].filter(Boolean).join(', ') || '-' },
    { label: '생성일', value: formatRegionDetailDate(selectedItem.createdtime) },
    { label: '수정일', value: formatRegionDetailDate(selectedItem.modifiedtime) },
  ]
}
