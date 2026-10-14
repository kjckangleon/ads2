import ReactDOM from 'react-dom/client'
import { App } from './App'
import { initInput } from './game/input'
import { sim } from './game/state'
import { loadSave } from './game/save'
import './styles.css'

initInput()
loadSave(sim)

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
