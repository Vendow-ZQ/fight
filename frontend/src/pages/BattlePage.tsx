import { useState, useRef, useEffect, useCallback } from 'react'
import { KOLS } from '../data/kols'
import { startBattle, streamBattle, injectOpinion, streamContinue } from '../api/battle'
import type { BattleEvent } from '../api/battle'
import { BG_IMAGES } from './HomePage'

interface Message {
  kolId: string
  content: string
  round: number
}

interface BattlePageProps {
  topic: string
  kolIds: string[]
  rounds: number
  length: string
  bgIdx: number
  onBack: () => void
  onFinish: (messages: Message[], topic: string, kolIds: string[], battleId: string) => void
}

type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const CORNER_CYCLE: CornerPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

function getCorner(index: number): CornerPosition {
  return CORNER_CYCLE[index % 4]
}

function getBubbleStyle(corner: CornerPosition): React.CSSProperties {
  switch (corner) {
    case 'top-left': return { background: '#e4e4e4', color: '#222' }
    case 'top-right': return { background: '#ffffff', color: '#222' }
    case 'bottom-left': return { background: '#555555', color: '#fff' }
    case 'bottom-right': return { background: '#555555', color: '#fff' }
  }
}

function isLeftSide(corner: CornerPosition): boolean {
  return corner === 'top-left' || corner === 'bottom-left'
}

const BATTLE_KEYFRAMES = `
@keyframes blink-cursor {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes token-fade {
  from { opacity: 0; filter: blur(2px); }
  to   { opacity: 1; filter: blur(0); }
}
@keyframes emoji-fly {
  0%   { opacity: 1; transform: translate(0, 0) scale(1) rotate(0deg); }
  100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(1.3) rotate(var(--tr)); }
}
`

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

const LENGTH_TO_MAX_TOKENS: Record<string, number> = {
  short: 300,
  standard: 600,
  long: 1200,
}

export default function BattlePage({ topic, kolIds, rounds, length, bgIdx, onBack, onFinish }: BattlePageProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [currentRound, setCurrentRound] = useState(1)
  const [isRunning, setIsRunning] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [battleId, setBattleId] = useState<string | null>(null)
  const [streamingAgentId, setStreamingAgentId] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<(() => void) | null>(null)

  const selectedKols = kolIds.map(id => KOLS.find(k => k.id === id) ?? { id, name: id, title: '', tags: [], color: '#888', bgColor: '#111' })

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, streamingText])

  const handleEvent = useCallback((event: BattleEvent) => {
    switch (event.type) {
      case 'round_start':
        setCurrentRound(event.round)
        break

      case 'agent_start':
        setStreamingAgentId(event.agentId)
        setStreamingText('')
        setMessages(prev => [...prev, {
          kolId: event.agentId,
          content: '',
          round: event.round,
        }])
        break

      case 'token':
        setStreamingText(prev => prev + event.token)
        break

      case 'agent_done':
        setStreamingAgentId(null)
        setStreamingText('')
        setMessages(prev => {
          const updated = [...prev]
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].kolId === event.agentId) {
              updated[i] = { ...updated[i], content: event.fullText }
              break
            }
          }
          return updated
        })
        break

      case 'round_end':
        break

      case 'battle_end':
        setIsRunning(false)
        setStreamingAgentId(null)
        break
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        setIsRunning(true)
        setError(null)
        const { battleId: id } = await startBattle({
          topic, kolIds, rounds,
          maxTokens: LENGTH_TO_MAX_TOKENS[length] ?? 1200,
          length,
        })
        if (cancelled) return
        setBattleId(id)
        const { close } = streamBattle(id, handleEvent, (msg) => {
          setError(msg)
          setIsRunning(false)
        })
        closeRef.current = close
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '启动对局失败')
          setIsRunning(false)
        }
      }
    }

    init()

    return () => {
      cancelled = true
      closeRef.current?.()
    }
  }, [])

  const handleSubmitOpinion = useCallback(async () => {
    if (!battleId || !userInput.trim()) return
    const text = userInput.trim()
    setMessages(prev => [...prev, {
      kolId: '__user__',
      content: text,
      round: currentRound,
    }])
    setUserInput('')
    setIsRunning(true)
    try {
      await injectOpinion(battleId, text)
      closeRef.current?.()
      const { close } = streamContinue(battleId, handleEvent)
      closeRef.current = close
    } catch (e) {
      setError(e instanceof Error ? e.message : '发送观点失败')
      setIsRunning(false)
    }
  }, [battleId, userInput, currentRound, handleEvent])

  const handleNoOpinion = useCallback(() => {
    if (!battleId) return
    setIsRunning(true)
    closeRef.current?.()
    const { close } = streamContinue(battleId, handleEvent)
    closeRef.current = close
  }, [battleId, handleEvent])

  const handleEndBattle = () => {
    closeRef.current?.()
    onFinish(messages, topic, kolIds, battleId!)
  }

  let kolMsgIndex = 0

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: `url(${BG_IMAGES[bgIdx]}) center/cover no-repeat`, backgroundColor: '#f2f2f2', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 0 }} />
      <style>{BATTLE_KEYFRAMES}</style>

      {/* ===== Header ===== */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        padding: '16px 24px', background: '#fff', position: 'relative', zIndex: 1,
      }}>
        <button onClick={onBack} style={{
          width: 44, height: 44, borderRadius: '50%', border: '1px solid #e0e0e0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', cursor: 'pointer', fontSize: 18, color: '#666', flexShrink: 0,
        }}>←</button>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: '#000' }}>
            ROUND {currentRound} · {topic}
          </div>
          <div style={{ color: '#999', fontSize: 12, marginTop: 2 }}>
            {selectedKols.map(k => k.name).join(' vs ')}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', border: '1px solid #ccc',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#999', fontSize: 16, cursor: 'pointer',
          }}>+</div>
          {selectedKols.map(kol => (
            <div key={kol.id} style={{
              width: 36, height: 36, borderRadius: '50%', background: kol.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
            }}>{kol.name[0]}</div>
          ))}
        </div>
      </div>

      {/* ===== Chat scrollable area ===== */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '24px 20px' }}>
          {error && (
            <div style={{
              background: '#fee2e2', color: '#dc2626', borderRadius: 12,
              padding: '12px 20px', marginBottom: 24, fontSize: 14, textAlign: 'center',
            }}>{error}</div>
          )}

          {messages.map((msg, idx) => {
            if (msg.kolId === '__user__') {
              return (
                <div key={idx} style={{ marginBottom: 32 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <div style={{ position: 'relative', maxWidth: '60%', marginRight: 12 }}>
                      <div style={{
                        position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)',
                        width: 0, height: 0,
                        borderTop: '8px solid transparent',
                        borderBottom: '8px solid transparent',
                        borderLeft: '8px solid #3b82f6',
                      }} />
                      <div className="battle-bubble" style={{
                        background: '#3b82f6', color: '#fff', borderRadius: 20,
                        padding: '16px 22px', fontSize: 14, lineHeight: 1.8, wordBreak: 'break-word' as const,
                      }}>{msg.content}</div>
                    </div>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%', background: '#3b82f6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, color: '#fff', flexShrink: 0,
                    }}>🎤</div>
                  </div>
                </div>
              )
            }

            const kol = KOLS.find(k => k.id === msg.kolId) ?? { id: msg.kolId, name: msg.kolId, title: '', tags: [], color: '#888', bgColor: '#111' }
            const corner = getCorner(kolMsgIndex)
            kolMsgIndex++
            const left = isLeftSide(corner)
            const bubbleStyle = getBubbleStyle(corner)
            const isStreaming = streamingAgentId === msg.kolId && idx === messages.length - 1

            const displayContent = isStreaming
              ? <StreamingText text={streamingText} />
              : msg.content

            return (
              <div key={idx} style={{ marginBottom: 32 }}>
                {left ? (
                  <LeftBubble kol={kol} bubbleStyle={bubbleStyle} content={displayContent} />
                ) : (
                  <RightBubble kol={kol} bubbleStyle={bubbleStyle} content={displayContent} />
                )}
              </div>
            )
          })}

          {isRunning && !streamingAgentId && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#aaa', animation: 'bounce 1s infinite', animationDelay: '0ms' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#aaa', animation: 'bounce 1s infinite', animationDelay: '150ms' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#aaa', animation: 'bounce 1s infinite', animationDelay: '300ms' }} />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ===== Bottom input bar ===== */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px', background: '#3a3a3a', height: 80, gap: 12, position: 'relative', zIndex: 1,
      }}>
        <input
          value={userInput}
          onChange={e => setUserInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && userInput.trim()) handleSubmitOpinion() }}
          placeholder="输入你的观点丢进擂台..."
          disabled={!battleId || isRunning}
          style={{
            flex: 1, height: 48, background: '#fff', borderRadius: 16,
            padding: '0 20px', fontSize: 14, color: '#000', border: 'none', outline: 'none',
            maxWidth: 640, opacity: (!battleId || isRunning) ? 0.5 : 1,
          }}
        />
        <button onClick={handleSubmitOpinion} disabled={!battleId || isRunning || !userInput.trim()} className="battle-bar-btn" style={{
          width: 48, height: 48, borderRadius: 16, background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer', fontSize: 18, color: '#555', flexShrink: 0,
          opacity: (!battleId || isRunning || !userInput.trim()) ? 0.5 : 1,
        }}>↗</button>
        <button onClick={handleNoOpinion} disabled={!battleId || isRunning} className="battle-bar-btn" style={{
          height: 48, padding: '0 20px', borderRadius: 16, background: '#fff',
          fontSize: 14, color: '#000', fontWeight: 700,
          border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
          opacity: (!battleId || isRunning) ? 0.5 : 1,
        }}>我没意见</button>
        <button onClick={handleEndBattle} className="battle-bar-btn" style={{
          height: 48, padding: '0 20px', borderRadius: 16, background: '#fff',
          fontSize: 14, color: '#000', fontWeight: 700,
          border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
        }}>结束对局</button>
      </div>
    </div>
  )
}


/* ===== Left-side bubble component ===== */
function LeftBubble({ kol, bubbleStyle, content }: {
  kol: { name: string; color: string }
  bubbleStyle: React.CSSProperties
  content: React.ReactNode
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', background: '#ccc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
          textAlign: 'center', lineHeight: 1.2, overflow: 'hidden',
        }}>{kol.name}</div>

        <div style={{ position: 'relative', maxWidth: '60%', marginLeft: 12 }}>
          <div style={{
            position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderRight: `8px solid ${bubbleStyle.background}`,
          }} />
          <div className="battle-bubble" style={{
            ...bubbleStyle,
            borderRadius: 20, padding: '16px 22px',
            fontSize: 14, lineHeight: 1.8, wordBreak: 'break-word' as const,
          }}>{content}</div>
        </div>
      </div>

      <div style={{ marginLeft: 48, marginTop: 8, display: 'flex', gap: 6 }}>
        <ReactionButton emoji="💩" />
        <ReactionButton emoji="❤️" />
      </div>
    </div>
  )
}


/* ===== Right-side bubble component ===== */
function RightBubble({ kol, bubbleStyle, content }: {
  kol: { name: string; color: string }
  bubbleStyle: React.CSSProperties
  content: React.ReactNode
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <div style={{ position: 'relative', maxWidth: '60%', marginRight: 12 }}>
          <div style={{
            position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderLeft: `8px solid ${bubbleStyle.background}`,
          }} />
          <div className="battle-bubble" style={{
            ...bubbleStyle,
            borderRadius: 20, padding: '16px 22px',
            fontSize: 14, lineHeight: 1.8, wordBreak: 'break-word' as const,
          }}>{content}</div>
        </div>

        <div style={{
          width: 48, height: 48, borderRadius: '50%', background: '#ccc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
          textAlign: 'center', lineHeight: 1.2, overflow: 'hidden',
        }}>{kol.name}</div>
      </div>

      <div style={{ marginRight: 48, marginTop: 8, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <ReactionButton emoji="❤️" />
        <ReactionButton emoji="💩" />
      </div>
    </div>
  )
}
