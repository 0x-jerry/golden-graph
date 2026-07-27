import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

const app = document.querySelector<HTMLDivElement>('#app')!

createApp(App).mount(app)
