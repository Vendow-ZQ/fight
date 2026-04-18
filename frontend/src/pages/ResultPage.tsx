import { useState, useEffect, useRef, useCallback } from 'react'
import { KOLS } from '../data/kols'
import { streamSummarize } from '../api/battle'
import type { SummaryEvent } from '../api/battle'

const CLAY_COLORS = [
  '#C4A882',
  '#A89B8C',
  '#B8A08E',
  '#9E8E7E',
  '#D4B896',
  '#BFA98E',
  '#C9B29A',
  '#A69484',
  '#D1BDA6',
  '#B5A392',
]

function getClayColor(index: number): string {
  return CLAY_COLORS[index % CLAY_COLORS.length]
}

function ReactionButton({ emoji }: { emoji: string }) {
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleClick = () => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const count = 6 + Math.floor(Math.random() * 4)
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div')
      const tx = (Math.random() - 0.5) * 120
      const ty = -30 - Math.random() * 80
      const tr = (Math.random() - 0.5) * 60
      el.textContent = emoji
      el.style.cssText = `
        position:fixed; left:${rect.left + rect.width / 2 - 10}px; top:${rect.top - 4}px;
        font-size:20px; pointer-events:none; z-index:99999;
        --tx:${tx}px; --ty:${ty}px; --tr:${tr}deg;
        animation: emoji-fly 0.7s ease-out forwards;
      `
      document.body.appendChild(el)
      setTimeout(() => el.remove(), 750)
    }
  }

  return (
    <button ref={btnRef} onClick={handleClick} className="battle-reaction-btn" style={{
      display: 'flex', alignItems: 'center', gap: 4, fontSize: 16,
      background: '#fff', borderRadius: 999, padding: '4px 14px',
      border: '1px solid #e0e0e0', cursor: 'pointer',
    }}>{emoji}</button>
  )
}

function StreamingText({ text }: { text: string }) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const renderedLen = useRef(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const prev = renderedLen.current
    if (text.length <= prev) return

    const newChars = text.slice(prev)
    const span = document.createElement('span')
    span.textContent = newChars
    span.style.animation = 'token-fade 0.15s ease-out'

    const cursor = el.querySelector('.stream-cursor')
    if (cursor) el.insertBefore(span, cursor)
    else el.appendChild(span)

    renderedLen.current = text.length
  }, [text])

  useEffect(() => {
    renderedLen.current = 0
    const el = containerRef.current
    if (el) el.innerHTML = '<span class="stream-cursor" style="animation:blink-cursor 1s step-end infinite">▍</span>'
  }, [])

  return <span ref={containerRef} />
}

interface Message {
  kolId: string
  content: string
  round: number
}

interface ResultPageProps {
  topic: string
  kolIds: string[]
  messages: Message[]
  battleId: string
  onBackToBattle: () => void
  onNewBattle: () => void
}

export default function ResultPage({ kolIds, battleId, onBackToBattle, onNewBattle }: ResultPageProps) {
  const [note, setNote] = useState('')
  const [summaries, setSummaries] = useState<Record<string, string>>({})
  const [streamingTexts, setStreamingTexts] = useState<Record<string, string>>({})
  const [streamingKolId, setStreamingKolId] = useState<string | null>(null)
  const [finishedKols, setFinishedKols] = useState<Set<string>>(new Set())
  const [error] = useState<string | null>(null)
  const closeRef = useRef<(() => void) | null>(null)

  const selectedKols = kolIds.map((id, i) => {
    const kol = KOLS.find(k => k.id === id)
    return kol
      ? { ...kol, clayColor: getClayColor(i) }
      : { id, name: id, title: '', tags: [], color: '#888', bgColor: '#111', clayColor: getClayColor(i) }
  })

  const handleEvent = useCallback((event: SummaryEvent) => {
    switch (event.type) {
      case 'summary_start':
        setStreamingKolId(event.agentId)
        setStreamingTexts(prev => ({ ...prev, [event.agentId]: '' }))
        break
      case 'summary_token':
        setStreamingTexts(prev => ({
          ...prev,
          [event.agentId]: (prev[event.agentId] || '') + event.token,
        }))
        break
      case 'summary_done':
        setSummaries(prev => ({ ...prev, [event.agentId]: event.fullText }))
        setFinishedKols(prev => new Set(prev).add(event.agentId))
        setStreamingKolId(prev => prev === event.agentId ? null : prev)
        break
      case 'summarize_end':
        setStreamingKolId(null)
        break
    }
  }, [])

  useEffect(() => {
    const { close } = streamSummarize(battleId, handleEvent)
    closeRef.current = close
    return () => { close() }
  }, [battleId, handleEvent])

  const cols = selectedKols.length <= 2 ? selectedKols.length : 2

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#f5f0eb', padding: '28px 5% 20px',
      overflow: 'hidden', boxSizing: 'border-box',
    }}>

      <style>{`
@keyframes emoji-fly {
  0%   { opacity: 1; transform: translate(0, 0) scale(1) rotate(0deg); }
  100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(1.3) rotate(var(--tr)); }
}
@keyframes blink-cursor {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes token-fade {
  from { opacity: 0; filter: blur(2px); }
  to   { opacity: 1; filter: blur(0); }
}
@keyframes clay-bounce-in {
  0%   { opacity: 0; transform: scale(0.7) translateY(12px); }
  60%  { opacity: 1; transform: scale(1.04) translateY(-2px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes clay-pulse {
  0%, 100% { box-shadow: 0 6px 20px rgba(180, 160, 130, 0.15), inset 0 -2px 6px rgba(0,0,0,0.04); }
  50%      { box-shadow: 0 8px 28px rgba(180, 160, 130, 0.25), inset 0 -2px 6px rgba(0,0,0,0.06); }
}
@keyframes clay-dot-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-8px); opacity: 1; }
}
      `}</style>

      {/* KOL cards grid */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '44px 24px',
        marginBottom: 16,
        alignContent: 'start',
      }}>
        {selectedKols.map((kol, kolIndex) => {
          const isStreaming = streamingKolId === kol.id
          const isFinished = finishedKols.has(kol.id)
          const hasStarted = isStreaming || isFinished
          const displayText = isFinished ? summaries[kol.id] : (streamingTexts[kol.id] || '')

          return (
            <div
              key={kol.id}
              className="result-card-wrapper"
              style={{
                position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0,
                animation: hasStarted ? `clay-bounce-in 0.5s ease-out ${kolIndex * 0.15}s both` : 'none',
              }}
            >

              {/* Avatar — centered at top */}
              <div style={{
                position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
                width: 56, height: 56, borderRadius: '50%',
                background: kol.clayColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#fff',
                textAlign: 'center', lineHeight: 1.2, overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(160, 140, 110, 0.3), inset 0 -3px 6px rgba(0,0,0,0.08), inset 0 2px 4px rgba(255,255,255,0.2)',
                border: '2.5px solid rgba(255,255,255,0.4)',
              }}>
                {kol.name}
              </div>

              {/* Card body */}
              <div
                className="result-clay-card"
                style={{
                  background: 'linear-gradient(145deg, #efe8df, #e6ddd3)',
                  borderRadius: 20,
                  padding: '40px 20px 20px',
                  flex: 1, minHeight: 0,
                  overflow: 'hidden', position: 'relative',
                  boxShadow: '0 6px 20px rgba(180, 160, 130, 0.15), inset 0 -2px 6px rgba(0,0,0,0.04), inset 0 1px 2px rgba(255,255,255,0.5)',
                  border: '1px solid rgba(200, 185, 165, 0.3)',
                  transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.3s ease',
                }}
              >
                <div style={{
                  height: '100%', overflowY: 'auto',
                  fontSize: 14, lineHeight: 1.8, color: '#6b5e50',
                }}>
                  {!hasStarted ? (
                    <div style={{ textAlign: 'center', paddingTop: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: kol.clayColor,
                            animation: `clay-dot-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
                          }} />
                        ))}
                      </div>
                      <div style={{ color: '#b5a392', marginTop: 10, fontSize: 13 }}>等待总结生成...</div>
                    </div>
                  ) : error ? (
                    <div style={{ color: '#c4756a', textAlign: 'center', paddingTop: 20 }}>
                      {error}
                    </div>
                  ) : isStreaming ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      <StreamingText text={displayText} />
                    </div>
                  ) : (
                    (summaries[kol.id] || '暂无观点').split('\n').map((line, i) => (
                      <div key={i} style={{ marginBottom: 4 }}>{line}</div>
                    ))
                  )}
                </div>
              </div>

              {/* Vote buttons */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: 6,
                marginTop: -18, marginRight: 12, position: 'relative', zIndex: 3,
              }}>
                <ReactionButton emoji="💩" />
                <ReactionButton emoji="❤️" />
              </div>
            </div>
          )
        })}
      </div>

      {/* User notes textarea */}
      <div style={{
        background: 'linear-gradient(145deg, #efe8df, #e6ddd3)',
        borderRadius: 20,
        padding: '16px 20px', marginBottom: 16, flexShrink: 0,
        boxShadow: '0 4px 16px rgba(180, 160, 130, 0.12), inset 0 -2px 6px rgba(0,0,0,0.03), inset 0 1px 2px rgba(255,255,255,0.4)',
        border: '1px solid rgba(200, 185, 165, 0.3)',
      }}>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="记录你的思考与想法..."
          style={{
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            resize: 'none', fontSize: 14, color: '#6b5e50', lineHeight: 1.8,
          }}
          rows={3}
        />
      </div>

      {/* Bottom action buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 40, flexShrink: 0, paddingBottom: 4 }}>
        <button
          className="result-clay-btn"
          onClick={onBackToBattle}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 28px', borderRadius: 999,
            background: 'linear-gradient(145deg, #efe8df, #e0d7cc)',
            border: '1px solid rgba(200, 185, 165, 0.4)',
            fontSize: 14, fontWeight: 700,
            color: '#6b5e50', cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(180, 160, 130, 0.15), inset 0 1px 2px rgba(255,255,255,0.4)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
        >← 返回对局</button>
        <button
          className="result-clay-btn"
          onClick={onNewBattle}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 28px', borderRadius: 999,
            background: 'linear-gradient(145deg, #efe8df, #e0d7cc)',
            border: '1px solid rgba(200, 185, 165, 0.4)',
            fontSize: 14, fontWeight: 700,
            color: '#6b5e50', cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(180, 160, 130, 0.15), inset 0 1px 2px rgba(255,255,255,0.4)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
        >🎧 再来一局</button>
      </div>
    </div>
  )
}
