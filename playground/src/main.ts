import { setup } from './editor'
import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')!

app.style.margin = '20px'
app.style.border = '1px solid #eee'

setup(app)
