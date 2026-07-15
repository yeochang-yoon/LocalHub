<template>
  <header class="site-header">
    <div class="container header-inner">
      <RouterLink class="brand" to="/" aria-label="LocalHub 홈">
        <span class="brand-mark" aria-hidden="true">🌊</span>
        <span>LocalHub</span>
      </RouterLink>
      <nav aria-label="주요 메뉴">
        <RouterLink to="/"><span class="nav-emoji" aria-hidden="true">🏠</span>홈</RouterLink>
        <RouterLink to="/board"><span class="nav-emoji" aria-hidden="true">💬</span>게시판</RouterLink>
        <RouterLink to="/regions"><span class="nav-emoji" aria-hidden="true">🗺️</span>권역정보</RouterLink>
        <RouterLink to="/dashboard"><span class="nav-emoji" aria-hidden="true">📊</span>대시보드</RouterLink>
        <RouterLink to="/calendar"><span class="nav-emoji" aria-hidden="true">🎉</span>캘린더</RouterLink>
        <RouterLink to="/trip-planner"><span class="nav-emoji" aria-hidden="true">🧳</span>여행추천</RouterLink>
      </nav>
    </div>
  </header>
</template>
