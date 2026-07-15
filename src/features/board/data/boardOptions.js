export const POST_CATEGORIES = Object.freeze(['일반', '질문', '후기', '정보'])

export const DEFAULT_POST_CATEGORY = '일반'

export const BOARD_SEARCH_TARGETS = Object.freeze([
  { value: 'title', label: '제목' },
  { value: 'author', label: '작성자' },
])

export const BOARD_SORT_OPTIONS = Object.freeze([
  { value: 'latest', label: '최신순' },
  { value: 'oldest', label: '오래된순' },
  { value: 'likes', label: '좋아요순' },
  { value: 'views', label: '조회수순' },
])

export const BOARD_CATEGORY_FILTERS = Object.freeze(['전체', ...POST_CATEGORIES])

export const PLACE_CATEGORIES = Object.freeze([
  {
    value: '관광지',
    label: '관광지',
  },
  {
    value: '레포츠',
    label: '레포츠',
  },
  {
    value: '문화시설',
    label: '문화시설',
  },
  {
    value: '쇼핑',
    label: '쇼핑',
  },
  {
    value: '숙박',
    label: '숙박',
  },
  {
    value: '여행코스',
    label: '여행코스',
  },
  {
    value: '축제공연행사',
    label: '축제공연행사',

  },
])

export const DEFAULT_PLACE_CATEGORY = PLACE_CATEGORIES[0].value
