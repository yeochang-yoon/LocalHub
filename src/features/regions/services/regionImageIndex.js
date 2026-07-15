import touristData from '../../../../data/부산_관광지.json'
import cultureData from '../../../../data/부산_문화시설.json'
import festivalData from '../../../../data/부산_축제공연행사.json'
import courseData from '../../../../data/부산_여행코스.json'
import leisureData from '../../../../data/부산_레포츠.json'
import stayData from '../../../../data/부산_숙박.json'
import shoppingData from '../../../../data/부산_쇼핑.json'

const imageIndex = new Map()

for (const source of [touristData, cultureData, festivalData, courseData, leisureData, stayData, shoppingData]) {
  for (const item of source.items || []) {
    const originalImage = String(item.firstimage || '').trim()
    const thumbnailImage = String(item.firstimage2 || '').trim()
    const displayImage = originalImage || thumbnailImage
    if (displayImage) imageIndex.set(String(item.contentid), [displayImage])
  }
}

export function getRegionImagesByContentId(contentId) {
  return [...(imageIndex.get(String(contentId)) || [])]
}
