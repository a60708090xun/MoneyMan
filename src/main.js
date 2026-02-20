import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { migrateData } from './services/db.js'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// Run data migration before mounting app
await migrateData()

app.mount('#app')
