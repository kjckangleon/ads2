import ReactDOM from 'react-dom/client'
import { App } from './App'
import { initInput } from './game/input'
import { sim } from './game/state'
import { loadSave, saveNow } from './game/save'
import { watchForUpdates } from './game/version'
import './styles.css'

initInput()
loadSave(sim)
// save when the tab is hidden or closed, so time away is measured from then
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow(sim)
})
window.addEventListener('pagehide', () => saveNow(sim))
watchForUpdates()

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
