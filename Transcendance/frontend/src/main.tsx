import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import GameScreen from './components/GameScreen.tsx'

// TEMPORARY (Etapa 2): http://localhost:5173/?game opens the match screen with the fake state
const preview = new URLSearchParams(window.location.search).has('game')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {preview ? <GameScreen /> : <App />}
  </StrictMode>,
)
