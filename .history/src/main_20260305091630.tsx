import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

// Registrar Service Worker para PWA (Modo Offline)
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('Nueva versión disponible. Refresca para actualizar.');
  },
  onOfflineReady() {
    console.log('App lista para funcionar offline.');
  },
})

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
