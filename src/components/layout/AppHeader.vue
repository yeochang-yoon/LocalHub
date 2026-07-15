<template>
  <header class="site-header">
    <div class="container header-inner">
      <RouterLink class="brand" to="/" aria-label="LocalHub 홈">
        <span class="brand-mark">L</span>
        <span>LocalHub</span>
      </RouterLink>
      <nav aria-label="주요 메뉴">
        <RouterLink to="/">홈</RouterLink>
        <RouterLink to="/board">게시판</RouterLink>
        <RouterLink to="/regions">권역정보</RouterLink>
        <RouterLink to="/calendar">캘린더</RouterLink>
      </nav>
    </div>
  </header>
</template>
