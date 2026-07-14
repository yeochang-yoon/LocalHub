<script setup>
const services = [
  {
    title: '동네 이야기',
    description: '부산의 소식과 경험을 이웃들과 자유롭게 나눠보세요.',
    link: '/board',
    label: '게시판 가기',
    icon: '✎',
  },
  {
    title: '권역 정보',
    description: '관광지부터 문화시설까지 부산의 매력을 권역별로 찾아보세요.',
    link: '/regions',
    label: '지역 둘러보기',
    icon: '⌖',
  },
]

function openChat() {
  document.querySelector('[data-chat-trigger]')?.click()
}
</script>

<template>
  <section class="hero">
    <div class="container hero-content">
      <p class="eyebrow">BUSAN LOCAL GUIDE</p>
      <h1>우리 동네를 발견하고,<br /><em>이야기로 연결해요.</em></h1>
      <p class="hero-copy">부산 곳곳의 유용한 정보와 이웃의 생생한 이야기를 한곳에서 만나보세요.</p>
      <div class="hero-actions">
        <RouterLink class="button button-primary" to="/regions">부산 둘러보기</RouterLink>
        <RouterLink class="button button-ghost" to="/board">이야기 나누기</RouterLink>
      </div>
    </div>
  </section>

  <section class="container service-section" aria-labelledby="service-title">
    <div class="section-heading">
      <div>
        <p class="eyebrow">LOCALHUB SERVICES</p>
        <h2 id="service-title">무엇을 찾고 계신가요?</h2>
      </div>
      <p>화면 오른쪽 아래의 AI 버튼을 누르면<br />부산 여행 도우미와 대화할 수 있어요.</p>
    </div>
    <div class="service-grid">
      <RouterLink v-for="service in services" :key="service.title" class="service-card" :to="service.link">
        <span class="service-icon" aria-hidden="true">{{ service.icon }}</span>
        <h3>{{ service.title }}</h3>
        <p>{{ service.description }}</p>
        <span class="card-link">{{ service.label }} <span aria-hidden="true">→</span></span>
      </RouterLink>
      <button class="service-card chat-guide-card" type="button" @click="openChat">
        <span class="service-icon" aria-hidden="true">✦</span>
        <h3>AI 부산 도우미</h3>
        <p>궁금한 여행지와 코스를 AI에게 편하게 물어보세요.</p>
        <span class="card-link">대화 시작하기 <span aria-hidden="true">→</span></span>
      </button>
    </div>
  </section>
</template>
