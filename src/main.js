import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/main.css'
import { initializeChatbotDatabase } from './features/chatbot/services/chatbotDatabase'

await initializeChatbotDatabase()

createApp(App).use(router).mount('#app')
