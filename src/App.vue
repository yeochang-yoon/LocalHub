<script setup>
import AppHeader from '@/components/layout/AppHeader.vue'
import OpenAIChatButton from '@/features/chatbot/components/OpenAIChatButton.vue'
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <main>
      <RouterView />
    </main>
    <OpenAIChatButton />
  </div>
</template>
