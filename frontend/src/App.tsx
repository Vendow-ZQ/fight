import { useState } from 'react'
import HomePage from './pages/HomePage'
import BattlePage from './pages/BattlePage'
import ResultPage from './pages/ResultPage'
import CursorEffects from './components/CursorEffects'

interface BattleConfig {
  topic: string
  kolIds: string[]
  rounds: number
  length: string
  bgIdx: number
}

interface ResultConfig {
  topic: string
  kolIds: string[]
  messages: { kolId: string; content: string; round: number }[]
  battleId: string
}

type Page = 'home' | 'battle' | 'result'

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [battle, setBattle] = useState<BattleConfig | null>(null)
  const [result, setResult] = useState<ResultConfig | null>(null)

  if (page === 'home' || !battle) {
    return (
      <>
        <CursorEffects />
        <HomePage
          onStart={(topic, kolIds, rounds, length, bgIdx) => {
            setBattle({ topic, kolIds, rounds, length, bgIdx })
            setResult(null)
            setPage('battle')
          }}
        />
      </>
    )
  }

  return (
    <>
      <CursorEffects />
      {/* BattlePage stays mounted — hidden when on result page */}
      <div style={{ display: page === 'battle' ? 'contents' : 'none' }}>
        <BattlePage
          {...battle}
          onBack={() => { setPage('home'); setBattle(null); setResult(null) }}
          onFinish={(messages, topic, kolIds, battleId) => {
            setResult({ messages, topic, kolIds, battleId })
            setPage('result')
          }}
        />
      </div>

      {page === 'result' && result && (
        <ResultPage
          {...result}
          onBackToBattle={() => setPage('battle')}
          onNewBattle={() => { setBattle(null); setResult(null); setPage('home') }}
        />
      )}
    </>
  )
}
