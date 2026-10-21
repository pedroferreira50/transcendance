import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import GameScreen from './components/GameScreen.tsx'

// TEMPORARY (Etapa 2): http://localhost:5173/?game opens the match screen with the fake state
// (?game=local: the keys of the two players of the local mode)
const game = new URLSearchParams(window.location.search).get('game')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {game !== null ? <GameScreen mode={game === 'local' ? 'local' : 'online'} /> : <App />}
  </StrictMode>,
)
