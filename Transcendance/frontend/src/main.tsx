import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import GameScreen from './components/GameScreen.tsx'
import OpenSea from './components/OpenSea.tsx'

// TEMPORARY (Etapa 2): http://localhost:5173/?game opens the match screen with the fake state
// (?game=local: the keys of the two players of the local mode)
const game = new URLSearchParams(window.location.search).get('game')
// TEMPORARY (Etapa 4.2): http://localhost:5173/?sea opens the new Open Sea screens
// (?sea=menu or ?sea=instructions starts on that screen)
const sea = new URLSearchParams(window.location.search).get('sea')

function firstScreen() {
  if (game !== null)
    return <GameScreen mode={game === 'local' ? 'local' : 'online'} />
  if (sea !== null)
    return <OpenSea start={sea === 'menu' || sea === 'instructions' ? sea : 'intro'} />
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {firstScreen()}
  </StrictMode>,
)
