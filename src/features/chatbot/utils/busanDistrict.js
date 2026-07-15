export const BUSAN_DISTRICTS = [
  '강서구', '금정구', '기장군', '남구', '동구', '동래구', '부산진구', '북구',
  '사상구', '사하구', '서구', '수영구', '연제구', '영도구', '중구', '해운대구',
]

export function extractBusanDistrict(address) {
  const normalizedAddress = String(address || '').replace('해운대구광역시', '해운대구')
  return BUSAN_DISTRICTS.find((district) => normalizedAddress.includes(district)) || null
}
