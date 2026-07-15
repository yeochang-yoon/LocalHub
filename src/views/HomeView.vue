<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDashboardPlaces, getDistrictRecommendations } from '@/features/dashboard/services/api/dashboardApi'
import { getBusanFestivalCalendarItems } from '@/features/calendar/services/api/calendarApi'
import { loadPosts } from '@/features/board/services/boardStorage'
import { formatPostDate, getPostTimestamp } from '@/features/board/utils/boardDate'

const router = useRouter()
const keyword = ref('')
const festivals = ref([])
const recommendations = ref([])
const posts = ref([])
const placeImages = ref(new Map())

const purposes = [
  { id: 'sightseeing', title: '명소', description: '부산을 대표하는 풍경과 여행지', icon: '📸' },
  { id: 'culture', title: '문화', description: '전시와 공연, 이야기가 있는 공간', icon: '🎨' },
  { id: 'activity', title: '액티비티', description: '바다와 도심에서 즐기는 체험', icon: '🏄' },
  { id: 'rest', title: '휴식', description: '여행의 쉼표가 되어줄 숙소', icon: '🏖️' },
  { id: 'shopping', title: '쇼핑', description: '시장부터 감각적인 로컬 상점까지', icon: '🛍️' },
]

const featuredFestivals = computed(() => festivals.value.slice(0, 3))
const featuredRecommendations = computed(() => recommendations.value.slice(0, 3))
const featuredPosts = computed(() => posts.value.slice(0, 3))

function searchPlaces() {
  const value = keyword.value.trim()
  router.push({ name: 'dashboard', query: value ? { keyword: value } : {} })
}

function openChat() {
  document.querySelector('[data-chat-trigger]')?.click()
}

function loadHomeContent() {
  try {
    const places = getDashboardPlaces()
    placeImages.value = new Map(places.filter((place) => place.image).map((place) => [String(place.id), place.image]))
    festivals.value = getBusanFestivalCalendarItems()
    recommendations.value = getDistrictRecommendations({ purposes: ['sightseeing', 'culture'] })
  } catch {
    festivals.value = []
    recommendations.value = []
  }

  posts.value = loadPosts()
    .sort((left, right) => (getPostTimestamp(right.createdAt) || 0) - (getPostTimestamp(left.createdAt) || 0))
}

onMounted(loadHomeContent)
</script>

<template>
  <main class="home-page">
    <section class="hero home-hero">
      <div class="container hero-content">
        <p class="eyebrow">DISCOVER YOUR BUSAN</p>
        <h1><span class="hero-wave" aria-hidden="true">🌊</span> 오늘은 부산<br /><em>어디로 떠나볼까요?</em> <span class="hero-sun" aria-hidden="true">☀️</span></h1>
        <p class="hero-copy">낯익은 바다부터 숨은 골목까지, 취향에 맞는 부산을 발견해 보세요.</p>
        <form class="home-search" role="search" @submit.prevent="searchPlaces">
          <label class="sr-only" for="home-place-search">지역 또는 장소 검색</label>
          <input id="home-place-search" v-model="keyword" type="search" placeholder="예: 해운대, 박물관, 전통시장" />
          <button type="submit">찾아보기 <span aria-hidden="true">→</span></button>
        </form>
        <div class="hero-actions">
          <RouterLink class="button button-ghost" to="/regions">🗺️ 전체 여행지 보기</RouterLink>
          <button class="button home-chat-button" type="button" @click="openChat">✨ AI에게 추천받기</button>
        </div>
      </div>
      <div class="hero-stat" aria-hidden="true"><strong>BUSAN</strong><span>바다와 도시가 만나는 여행</span></div>
    </section>

    <section class="container home-section purpose-section" aria-labelledby="purpose-title">
      <header class="home-section-heading">
        <div><p class="eyebrow">TRAVEL BY MOOD</p><h2 id="purpose-title"><span aria-hidden="true">🎈</span> 어떤 하루를 보내고 싶나요?</h2></div>
        <RouterLink to="/dashboard">내 취향 더 자세히 찾기 →</RouterLink>
      </header>
      <div class="purpose-grid">
        <RouterLink
          v-for="purpose in purposes"
          :key="purpose.id"
          class="purpose-card"
          :to="{ name: 'dashboard', query: { purposes: purpose.id } }"
        >
          <span class="purpose-icon" aria-hidden="true">{{ purpose.icon }}</span>
          <div><h3>{{ purpose.title }}</h3><p>{{ purpose.description }}</p></div>
          <span aria-hidden="true">↗</span>
        </RouterLink>
      </div>
    </section>

    <section v-if="featuredFestivals.length" class="home-section festival-section" aria-labelledby="festival-title">
      <div class="container">
        <header class="home-section-heading light-heading">
          <div><p class="eyebrow">NOW IN BUSAN</p><h2 id="festival-title"><span aria-hidden="true">🎉</span> 부산에서 만나는 축제와 공연</h2></div>
          <RouterLink to="/calendar">캘린더 전체 보기 →</RouterLink>
        </header>
        <div class="festival-grid">
          <RouterLink
            v-for="(festival, index) in featuredFestivals"
            :key="festival.contentId"
            class="home-festival-card"
            :class="{ featured: index === 0 }"
            :to="{ name: 'region-detail', params: { contentId: festival.contentId } }"
            :style="placeImages.get(String(festival.contentId)) ? { backgroundImage: `linear-gradient(180deg, transparent 20%, rgba(5, 71, 145, .9)), url(${placeImages.get(String(festival.contentId))})` } : undefined"
          >
            <span>🎊 축제 · 공연</span>
            <div><h3>{{ festival.title }}</h3><p>{{ festival.address1 || '부산광역시' }}</p></div>
          </RouterLink>
        </div>
      </div>
    </section>

    <section v-if="featuredRecommendations.length" class="container home-section" aria-labelledby="recommend-title">
      <header class="home-section-heading">
        <div><p class="eyebrow">RECOMMENDED DISTRICTS</p><h2 id="recommend-title"><span aria-hidden="true">💙</span> 처음 만나는 부산이라면</h2></div>
        <div class="recommend-heading-actions">
          <div class="recommend-help">
            <button type="button" aria-label="관광·문화 추천 지수 산출 기준" aria-describedby="recommend-score-help">?</button>
            <div id="recommend-score-help" class="recommend-tooltip" role="tooltip">
              <strong>추천 지수 산출 기준</strong>
              <p>구·군별 관광지, 문화시설, 축제·공연, 여행코스 수를 유형별 최다 지역과 비교해 정규화한 뒤 평균을 냅니다.</p>
              <p>점수가 같으면 관련 유형의 다양성, 관광지 수, 전체 관련 시설 수 순으로 순위를 정합니다.</p>
            </div>
          </div>
          <RouterLink to="/dashboard">추천 지역 더 보기 →</RouterLink>
        </div>
      </header>
      <div class="district-grid">
        <article v-for="(item, index) in featuredRecommendations" :key="item.district" class="district-card">
          <span class="district-rank">0{{ index + 1 }}</span>
          <p>관광·문화 추천 지수 {{ item.matchRate }}점</p>
          <h3>{{ item.district }}</h3>
          <div class="district-links">
            <RouterLink v-for="place in item.representativePlaces" :key="place.id" :to="{ name: 'region-detail', params: { contentId: place.id } }">
              {{ place.title }} <span>→</span>
            </RouterLink>
          </div>
        </article>
      </div>
    </section>

    <section class="container route-cta" aria-labelledby="route-title">
      <div class="route-visual" aria-hidden="true"><span>1</span><i></i><span>2</span><i></i><span>3</span></div>
      <div><p class="eyebrow">TRIP CURATOR</p><h2 id="route-title">🧳 어디부터 갈지 고민이라면</h2><p>날짜와 시간, 여행 스타일을 선택하세요. 이동 거리를 고려해 나만의 부산 여행 일정을 구성해 드려요.</p></div>
      <RouterLink class="button button-primary" to="/trip-planner">🚀 여행 추천 시작하기</RouterLink>
    </section>

    <section v-if="featuredPosts.length" class="container home-section story-section" aria-labelledby="story-title">
      <header class="home-section-heading">
        <div><p class="eyebrow">LOCAL STORIES</p><h2 id="story-title"><span aria-hidden="true">💬</span> 여행자들이 남긴 부산 이야기</h2></div>
        <RouterLink to="/board">모든 이야기 보기 →</RouterLink>
      </header>
      <div class="story-grid">
        <RouterLink v-for="post in featuredPosts" :key="post.id" class="story-card" :to="{ name: 'board-detail', params: { id: post.id } }">
          <div><span class="board-badge">{{ post.postCategory }}</span><span>{{ formatPostDate(post.createdAt) }}</span></div>
          <h3>{{ post.title }}</h3>
          <p>{{ post.content }}</p>
          <footer><span>{{ post.author || '작성자 미상' }}</span><span>조회 {{ post.views || 0 }} · 좋아요 {{ post.likes || 0 }}</span></footer>
        </RouterLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.home-page { overflow: hidden; }
.home-hero { position: relative; min-height: 660px; background-position: center 58%; }
.home-hero::after { position: absolute; inset: 0; content: ''; pointer-events: none; background: linear-gradient(180deg, transparent 68%, rgba(84,202,224,.16)); }
.home-hero .hero-content { position: relative; z-index: 1; }
.home-search { display: flex; width: min(650px, 100%); margin-bottom: 18px; padding: 7px; border: 1px solid rgba(255,255,255,.5); border-radius: 16px; background: rgba(255,255,255,.96); box-shadow: 0 20px 50px rgba(2,37,58,.3); backdrop-filter: blur(12px); }
.home-search input { flex: 1; min-width: 0; padding: 12px 15px; border: 0; outline: 0; color: #183747; background: transparent; }
.home-search button { min-height: 48px; padding: 0 22px; color: white; border: 0; border-radius: 11px; background: linear-gradient(135deg, var(--ocean), var(--ocean-light)); cursor: pointer; font-weight: 700; }
.home-chat-button { color: white; border: 1px solid rgba(255,255,255,.55); background: rgba(255,255,255,.08); }
.hero-stat { position: absolute; right: max(20px, calc((100vw - 1120px) / 2)); bottom: 42px; z-index: 1; display: grid; color: white; text-align: right; }
.hero-stat strong { font-family: var(--display-font); font-size: 42px; font-weight: 400; letter-spacing: .08em; }
.hero-stat span { color: rgba(255,255,255,.72); font-size: 12px; }
.home-section { position: relative; padding-block: 90px; }
.purpose-section::before { position: absolute; top: 34px; right: -30px; z-index: 0; content: '🐳'; opacity: .08; font-family: sans-serif; font-size: 170px; transform: rotate(-12deg); }
.purpose-section > * { position: relative; z-index: 1; }
.home-section-heading { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 32px; }
.home-section-heading .eyebrow { margin-bottom: 10px; }
.home-section-heading h2, .route-cta h2 { margin: 0; color: var(--green); font-family: var(--display-font); font-size: clamp(30px, 4vw, 44px); font-weight: 400; letter-spacing: -.04em; }
.home-section-heading > a { flex: 0 0 auto; color: var(--orange); font-size: 13px; font-weight: 700; }
.recommend-heading-actions { display: flex; align-items: center; gap: 14px; }
.recommend-heading-actions > a { color: var(--orange); font-size: 13px; font-weight: 700; }
.recommend-help { position: relative; }
.recommend-help > button { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; color: var(--green); border: 1px solid #a8d2dc; border-radius: 50%; background: white; cursor: help; font-size: 14px; font-weight: 800; }
.recommend-help > button:hover, .recommend-help > button:focus-visible { color: white; border-color: var(--green); outline: 0; background: var(--green); }
.recommend-tooltip { position: absolute; top: calc(100% + 10px); right: 0; z-index: 8; width: min(350px, calc(100vw - 40px)); padding: 16px; visibility: hidden; opacity: 0; color: #5c7480; border: 1px solid #c6e1e7; border-radius: 14px; background: white; box-shadow: 0 16px 38px rgba(5,83,113,.16); transform: translateY(-5px); transition: opacity .16s, transform .16s, visibility .16s; }
.recommend-tooltip::before { position: absolute; right: 8px; bottom: 100%; width: 10px; height: 10px; content: ''; border-top: 1px solid #c6e1e7; border-left: 1px solid #c6e1e7; background: white; transform: translateY(5px) rotate(45deg); }
.recommend-tooltip strong { display: block; margin-bottom: 8px; color: var(--green); font-size: 14px; }
.recommend-tooltip p { margin: 0; font-size: 12px; line-height: 1.65; }
.recommend-tooltip p + p { margin-top: 7px; }
.recommend-help:hover .recommend-tooltip, .recommend-help:focus-within .recommend-tooltip { visibility: visible; opacity: 1; transform: translateY(0); }
.purpose-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.purpose-card { display: grid; min-height: 210px; padding: 22px; border: 2px solid var(--line); border-radius: 24px; background: rgba(255,255,255,.96); box-shadow: 0 8px 0 #dff4fc, 0 14px 28px rgba(7,136,245,.07); transition: transform .2s, box-shadow .2s, border-color .2s; }
.purpose-card:hover { transform: translateY(-7px) rotate(-1deg); border-color: #85ddf5; box-shadow: 0 10px 0 #cceffc, 0 20px 40px rgba(7,136,245,.15); }
.purpose-card > span:last-child { align-self: end; justify-self: end; color: var(--orange); }
.purpose-icon { display: grid; place-items: center; width: 54px; height: 54px; color: var(--ocean); border: 2px solid white; border-radius: 19px; background: linear-gradient(145deg, #baf0ff, #4fd2f4); box-shadow: 0 6px 0 #c9effa; font-family: sans-serif; font-size: 27px; transition: transform .2s; }
.purpose-card:hover .purpose-icon { transform: rotate(-8deg) scale(1.08); }
.purpose-card:nth-child(2) .purpose-icon { background: linear-gradient(145deg, #ffd9e1, #ff91a7); box-shadow: 0 6px 0 #ffe1e8; }
.purpose-card:nth-child(3) .purpose-icon { background: linear-gradient(145deg, #c9fff1, #62ddc4); }
.purpose-card:nth-child(4) .purpose-icon { background: linear-gradient(145deg, #fff8b3, #ffd45f); }
.purpose-card:nth-child(5) .purpose-icon { background: linear-gradient(145deg, #e6dcff, #ae94f7); }
.purpose-card h3 { margin: 20px 0 7px; color: var(--green); }
.purpose-card p { margin: 0; color: #748079; font-size: 13px; line-height: 1.6; }
.festival-section { position: relative; padding-block: 100px; overflow: hidden; color: white; background: linear-gradient(135deg, #075db5 0%, #0788f5 55%, #41cef1 100%); }
.festival-section::before { position: absolute; top: -120px; right: -80px; width: 420px; height: 260px; content: ''; border-radius: 50%; background: rgba(255,241,130,.15); }
.festival-section::after { position: absolute; right: 5%; bottom: 18px; content: '🎆'; opacity: .13; font-family: sans-serif; font-size: 150px; transform: rotate(8deg); }
.festival-section > .container { position: relative; z-index: 1; }
.light-heading h2, .light-heading > a { color: white; }
.festival-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 16px; }
.home-festival-card { display: flex; min-height: 320px; padding: 24px; flex-direction: column; justify-content: space-between; border: 1px solid rgba(255,255,255,.22); border-radius: 20px; background-color: #087fa7; background-position: center; background-size: cover; box-shadow: 0 18px 45px rgba(1,31,49,.2); transition: transform .2s; }
.home-festival-card:hover { transform: translateY(-4px); }
.home-festival-card > span { width: fit-content; padding: 6px 9px; border-radius: 999px; background: rgba(255,255,255,.16); font-size: 11px; font-weight: 700; }
.home-festival-card h3 { margin: 0 0 8px; font-size: 21px; }
.home-festival-card p { margin: 0; color: rgba(255,255,255,.72); font-size: 13px; }
.district-grid, .story-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.district-card { position: relative; padding: 28px; overflow: hidden; border: 2px solid var(--line); border-radius: 24px; background: linear-gradient(145deg, white, #f2fbff); box-shadow: 0 8px 0 #e0f4fb, 0 14px 28px rgba(7,136,245,.07); }
.district-card:nth-child(2) { border-color: #ffd2dc; box-shadow: 0 8px 0 #ffe8ed, 0 14px 28px rgba(255,102,128,.07); }
.district-card:nth-child(3) { border-color: #ffe797; box-shadow: 0 8px 0 #fff3c7, 0 14px 28px rgba(255,194,40,.08); }
.district-rank { position: absolute; top: 15px; right: 20px; color: #d8f0f5; font-family: var(--display-font); font-size: 54px; }
.district-card > p { position: relative; margin: 0; color: var(--orange); font-size: 12px; font-weight: 700; }
.district-card h3 { position: relative; margin: 7px 0 22px; color: var(--green); font-size: 25px; }
.district-links { position: relative; display: grid; gap: 10px; }
.district-links a { display: flex; justify-content: space-between; gap: 12px; padding-top: 10px; color: #5e6a64; border-top: 1px solid #edf0ed; font-size: 13px; }
.district-links a span { color: var(--orange); }
.route-cta { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 38px; margin-block: 10px 50px; padding-block: 46px; padding-inline: 52px; overflow: hidden; color: white; border: 3px solid #7be2f7; border-radius: 28px; background: linear-gradient(120deg, #075db5, #0788f5 58%, #45d1f1); box-shadow: 0 9px 0 #b9effb, 0 22px 48px rgba(7,100,190,.2); }
.route-cta h2 { color: white; }
.route-cta p:last-child { max-width: 620px; margin: 12px 0 0; color: #d5f0f5; font-size: 14px; line-height: 1.7; }
.route-visual { display: flex; align-items: center; }
.route-visual span { display: grid; place-items: center; width: 38px; height: 38px; flex: 0 0 auto; color: var(--deep-sea); border-radius: 50%; background: #8ce7f4; font-weight: 800; }
.route-visual i { width: 26px; height: 2px; background: rgba(255,255,255,.35); }
.story-section { padding-top: 50px; }
.story-section::before { position: absolute; top: 20px; left: -38px; z-index: 0; content: '💌'; opacity: .08; font-family: sans-serif; font-size: 135px; transform: rotate(-10deg); }
.story-section > * { position: relative; z-index: 1; }
.story-card { display: flex; min-height: 250px; padding: 24px; flex-direction: column; border: 2px solid var(--line); border-radius: 24px; background: white; box-shadow: 0 8px 0 #e0f4fb, 0 13px 26px rgba(7,136,245,.07); transition: transform .2s, box-shadow .2s; }
.story-card:hover { transform: translateY(-6px) rotate(.4deg); box-shadow: 0 10px 0 #ceeffb, 0 18px 38px rgba(7,136,245,.14); }
.story-card > div, .story-card footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #87908b; font-size: 11px; }
.story-card h3 { margin: 22px 0 10px; color: var(--green); font-size: 19px; }
.story-card > p { display: -webkit-box; margin: 0 0 24px; overflow: hidden; color: #607985; font-size: 13px; line-height: 1.7; line-clamp: 3; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.story-card footer { margin-top: auto; padding-top: 14px; border-top: 1px solid #edf0ed; }
@media (max-width: 980px) { .purpose-grid { grid-template-columns: repeat(3, 1fr); } .festival-grid { grid-template-columns: 1fr 1fr; } .home-festival-card.featured { grid-column: 1 / -1; } .route-cta { grid-template-columns: 1fr; } .route-visual { display: none; } }
@media (max-width: 700px) { .home-hero { min-height: 620px; } .hero-stat { display: none; } .home-search { align-items: stretch; flex-direction: column; background: rgba(255,255,255,.96); } .home-search button { width: 100%; } .home-section { padding-block: 68px; } .home-section-heading { align-items: flex-start; flex-direction: column; } .purpose-grid, .festival-grid, .district-grid, .story-grid { grid-template-columns: 1fr; } .purpose-card { min-height: 170px; } .home-festival-card.featured { grid-column: auto; } .home-festival-card { min-height: 260px; } .route-cta { width: calc(100% - 28px); margin-bottom: 20px; padding: 32px 24px; } }
</style>
