import tourismData from '../../../../data/부산_관광지.json'
import leisureData from '../../../../data/부산_레포츠.json'
import cultureData from '../../../../data/부산_문화시설.json'
import shoppingData from '../../../../data/부산_쇼핑.json'
import lodgingData from '../../../../data/부산_숙박.json'
import courseData from '../../../../data/부산_여행코스.json'
import festivalData from '../../../../data/부산_축제공연행사.json'

const categoryDefinitions = [
  { name: '관광지', data: tourismData, icon: '⌖', description: '부산을 대표하는 명소와 숨은 여행지' },
  { name: '문화시설', data: cultureData, icon: '▣', description: '전시, 공연, 박물관과 문화 공간' },
  { name: '축제·공연', data: festivalData, icon: '♪', description: '계절마다 펼쳐지는 행사와 축제' },
  { name: '여행코스', data: courseData, icon: '↝', description: '테마가 있는 부산 여행 동선' },
  { name: '레포츠', data: leisureData, icon: '◒', description: '바다와 도심에서 즐기는 활동' },
  { name: '숙박', data: lodgingData, icon: '⌂', description: '여행의 쉼표가 되어줄 숙소' },
  { name: '쇼핑', data: shoppingData, icon: '◇', description: '전통시장부터 감각적인 상점까지' },
]

export const regionCategories = categoryDefinitions.map((item) => ({
  ...item,
  count: item.data?.total ?? item.data?.items?.length ?? 0,
}))