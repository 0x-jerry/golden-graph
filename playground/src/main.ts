import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

const app = document.querySelector<HTMLDivElement>('#app')!

app.style.margin = '20px'
app.style.border = '1px solid #eee'

createApp(App).mount(app)
