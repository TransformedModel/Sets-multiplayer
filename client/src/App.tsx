import './App.css'
import { HomeGlyphsBackdrop } from './components/HomeGlyphsBackdrop'
import { HomeView } from './views/HomeView'

function App() {
  return (
    <>
      <div className="app-glyphs-fixed-layer" aria-hidden>
        <HomeGlyphsBackdrop />
      </div>
      <div className="app-main">
        <HomeView />
      </div>
    </>
  )
}

export default App
