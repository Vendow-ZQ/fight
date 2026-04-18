import { useState, useRef, useEffect } from 'react'
import HistoryDrawer from '../components/HistoryDrawer'
import KolCarousel from '../components/KolCarousel'

function SpinnerValue({ value, index, sub, fontSize = 20, width = 32 }: { value: string; index: number; sub?: string; fontSize?: number; width?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const prevRef = useRef({ value, index })
  const [display, setDisplay] = useState<{ current: string; prev: string; dir: 'up' | 'down' }>({ current: value, prev: value, dir: 'up' })
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (value !== prevRef.current.value) {
      const dir = index > prevRef.current.index ? 'up' : 'down'
      setDisplay({ current: value, prev: prevRef.current.value, dir })
      setAnimating(true)
      prevRef.current = { value, index }
      const t = setTimeout(() => setAnimating(false), 200)
      return () => clearTimeout(t)
    }
  }, [value, index])

  const h = fontSize * 1.4
  return (
    <div style={{ width, textAlign: 'center' }}>
      <div ref={containerRef} style={{ height: h, overflow: 'hidden', position: 'relative' }}>
        {animating ? (
          <>
            <div style={{
              position: 'absolute', width: '100%', textAlign: 'center',
              fontSize, fontWeight: 700, color: '#fff', lineHeight: h + 'px',
              animation: `spin-out-${display.dir} 0.2s ease-in forwards`,
            }}>{display.prev}</div>
            <div style={{
              position: 'absolute', width: '100%', textAlign: 'center',
              fontSize, fontWeight: 700, color: '#fff', lineHeight: h + 'px',
              animation: `spin-in-${display.dir} 0.2s ease-out forwards`,
            }}>{display.current}</div>
          </>
        ) : (
          <div style={{
            fontSize, fontWeight: 700, color: '#fff', lineHeight: h + 'px', textAlign: 'center',
          }}>{display.current}</div>
        )}
      </div>
      {sub && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textAlign: 'center', display: 'block' }}>{sub}</span>}
    </div>
  )
}

const LENGTH_OPTIONS = [
  { label: '精简', sub: '~100字',  value: 'short'    },
  { label: '标准', sub: '~200字',  value: 'standard' },
  { label: '详尽', sub: '~400字',  value: 'long'     },
]
const ROUND_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

const TOPIC_BUBBLES = [
  '内卷有没有意义？',
  'AI会不会取代人类？',
  '30岁前该不该买房？',
  '该留学还是考研？',
  '该读博还是找实习？',
  '彩礼该不该给？',
  '全职妈妈算不算工作？',
  '年轻人该躺平还是奋斗？',
  '读书到底有没有用？',
  '社交媒体让人更孤独了吗？',
  '婚姻是爱情的坟墓吗？',
  '延迟退休合不合理？',
  '人要不要为了工作去大城市？',
  '外卖骑手困在系统里谁的错？',
  '没有天赋该不该坚持？',
]

export const BG_IMAGES = [
  '/backgrounds/1.png',
  '/backgrounds/2.png',
  '/backgrounds/3.png',
  '/backgrounds/4.png',
  '/backgrounds/5.png',
  '/backgrounds/6.png',
]

function TopicStrip({ topics, onSelect }: { topics: string[]; onSelect: (t: string) => void }) {
  const stripRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({ startX: 0, scrollLeft: 0, dragging: false, moved: false })
  const oneSetWidth = useRef(0)

  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const gap = 10
    const buttons = el.querySelectorAll('button')
    let w = 0
    for (let i = 0; i < topics.length; i++) {
      w += buttons[i].offsetWidth + gap
    }
    oneSetWidth.current = w
    el.scrollLeft = w
  }, [topics])

  const clampScroll = () => {
    const el = stripRef.current
    if (!el || oneSetWidth.current === 0) return
    const w = oneSetWidth.current
    if (el.scrollLeft < w * 0.25) el.scrollLeft += w
    else if (el.scrollLeft > w * 1.75) el.scrollLeft -= w
  }

  const onMouseDown = (e: React.MouseEvent) => {
    const el = stripRef.current!
    dragState.current = { startX: e.clientX, scrollLeft: el.scrollLeft, dragging: true, moved: false }

    const onMouseMove = (ev: MouseEvent) => {
      const s = dragState.current
      if (!s.dragging) return
      const dx = ev.clientX - s.startX
      if (Math.abs(dx) > 4) s.moved = true
      el.scrollLeft = s.scrollLeft - dx
      clampScroll()
    }
    const onMouseUp = () => {
      dragState.current.dragging = false
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const handleClick = (t: string) => {
    if (!dragState.current.moved) onSelect(t)
  }

  const handleWheel = (e: React.WheelEvent) => {
    const el = stripRef.current
    if (!el) return
    el.scrollLeft += e.deltaY || e.deltaX
    clampScroll()
  }

  const tripled = [...topics, ...topics, ...topics]

  return (
    <div style={{ width: '80%', maxWidth: 900, marginTop: 16, flexShrink: 0, position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 40, zIndex: 2,
        background: 'linear-gradient(to right, rgba(0,0,0,0.5), transparent)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, zIndex: 2,
        background: 'linear-gradient(to left, rgba(0,0,0,0.5), transparent)',
        pointerEvents: 'none',
      }} />
      <div
        ref={stripRef}
        style={{
          display: 'flex', gap: 10, overflowX: 'auto', padding: '4px 20px',
          cursor: 'grab', scrollbarWidth: 'none', userSelect: 'none',
        }}
        onMouseDown={onMouseDown}
        onWheel={handleWheel}
        onScroll={clampScroll}
      >
        {tripled.map((t, i) => (
          <button
            key={i}
            className="topic-bubble"
            onClick={() => handleClick(t)}
            style={{
              background: '#aaa', color: '#000', border: 'none',
              borderRadius: 16, padding: '8px 16px', fontSize: 14,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >{t}</button>
        ))}
      </div>
    </div>
  )
}

interface HomePageProps {
  onStart: (topic: string, kolIds: string[], rounds: number, length: string, bgIdx: number) => void
}

export default function HomePage({ onStart }: HomePageProps) {
  const [topic,        setTopic]       = useState('')
  const [selectedKols, setSelectedKols] = useState<string[]>([])
  const [rounds,       setRounds]      = useState(3)
  const [length,       setLength]      = useState('short')
  const [historyOpen,  setHistoryOpen] = useState(false)
  const [bgIdx,        setBgIdx]       = useState(0)
  const [distillOpen,  setDistillOpen] = useState(false)

  const toggleKol = (id: string) =>
    setSelectedKols(prev =>
      prev.includes(id) ? prev.filter(k => k !== id)
      : prev.length >= 4 ? prev : [...prev, id]
    )

  const canFight  = topic.trim().length > 0 && selectedKols.length >= 2
  const curLenIdx = LENGTH_OPTIONS.findIndex(l => l.value === length)
  const curRndIdx = ROUND_OPTIONS.indexOf(rounds)

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        color: '#fff',
        fontFamily: "'Rajdhani', 'Noto Sans SC', sans-serif",
        background: `url(${BG_IMAGES[bgIdx]}) center/cover no-repeat`,
        backgroundColor: '#000',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 0 }} />
      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} />

      {/* ===== Top nav bar ===== */}
      <div style={{
        position: 'absolute', top: 24, left: 24, zIndex: 50,
      }}>
        <button
          onClick={() => setHistoryOpen(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            display: 'flex', flexDirection: 'column', gap: 5,
          }}
        >
          <span style={{ display: 'block', width: 20, height: 2, background: '#fff' }} />
          <span style={{ display: 'block', width: 20, height: 2, background: '#fff' }} />
          <span style={{ display: 'block', width: 20, height: 2, background: '#fff' }} />
        </button>
      </div>
      <div style={{
        position: 'absolute', top: 24, right: 24, zIndex: 50,
      }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>
      </div>

      {/* ===== Upper section: title + bubbles + input + button (60% height) ===== */}
      <div style={{
        flexShrink: 0, height: '50%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative',
      }}>

        {/* Title */}
        <div style={{ textAlign: 'center', paddingTop: 24, flexShrink: 0 }}>
          <h1 className="clay-title" aria-label="赛博斗蛐蛐" style={{ margin: 0, fontFamily: "'Noto Sans SC', sans-serif" }}>
            {[
              { ch: '赛', size: 63, rot: -6,  y: -6,  scale: 1.12, delay: 0,    wobbleDur: 2.8 },
              { ch: '博', size: 48, rot: 5,   y: 6,   scale: 0.92, delay: 0.07, wobbleDur: 3.4 },
              { ch: '斗', size: 53, rot: -4,  y: -10, scale: 1.2,  delay: 0.14, wobbleDur: 2.5 },
              { ch: '蛐', size: 59, rot: 7,   y: 8,   scale: 0.88, delay: 0.21, wobbleDur: 3.5 },
              { ch: '蛐', size: 46, rot: -3,  y: 5,   scale: 0.9,  delay: 0.28, wobbleDur: 3.0 },
            ].map((c, i) => (
              <span
                key={i}
                className="clay-char"
                style={{
                  fontSize: c.size,
                  marginBottom: c.y,
                  '--clay-rot': `${c.rot}deg`,
                  '--clay-scale': c.scale,
                  '--clay-hover': `translateY(${c.y}px)`,
                  animation: `clay-bounce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${c.delay}s both, clay-wobble ${c.wobbleDur}s ease-in-out ${0.6 + c.delay}s infinite`,
                } as React.CSSProperties}
              >{c.ch}</span>
            ))}
          </h1>
          <p style={{ color: '#ccc', fontSize: 14, marginTop: 8 }}>
            不必再被他们说服，蒸馏你关注的博主，让他们来一场观点八角笼！
          </p>
        </div>

        {/* Topic bubbles — draggable scroll strip */}
        <TopicStrip topics={TOPIC_BUBBLES} onSelect={setTopic} />

        {/* Search input + config spinners row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 20,
          width: '60%', maxWidth: 760, marginTop: 12, flexShrink: 0,
        }}>
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canFight && onStart(topic, selectedKols, rounds, length, bgIdx)}
            placeholder="大家都在聊点什么？"
            style={{
              flex: 1, height: 56, background: '#fff', color: '#000',
              borderRadius: 28, padding: '0 24px', fontSize: 16,
              border: 'none', outline: 'none',
            }}
          />

          {/* Rounds spinner */}
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}
            onWheel={e => { e.preventDefault(); const next = curRndIdx + (e.deltaY > 0 ? 1 : -1); if (next >= 0 && next < ROUND_OPTIONS.length) setRounds(ROUND_OPTIONS[next]) }}
          >
            <button
              onClick={() => setRounds(ROUND_OPTIONS[Math.max(0, curRndIdx - 1)])}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer', padding: '0 4px' }}
            >∧</button>
            <SpinnerValue value={String(rounds)} index={curRndIdx} fontSize={20} width={32} />
            <button
              onClick={() => setRounds(ROUND_OPTIONS[Math.min(ROUND_OPTIONS.length - 1, curRndIdx + 1)])}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer', padding: '0 4px' }}
            >∨</button>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>对战回合</span>
          </div>

          {/* Length spinner */}
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}
            onWheel={e => { e.preventDefault(); const next = curLenIdx + (e.deltaY > 0 ? 1 : -1); if (next >= 0 && next < LENGTH_OPTIONS.length) setLength(LENGTH_OPTIONS[next].value) }}
          >
            <button
              onClick={() => setLength(LENGTH_OPTIONS[Math.max(0, curLenIdx - 1)].value)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer', padding: '0 4px' }}
            >∧</button>
            <SpinnerValue value={LENGTH_OPTIONS[curLenIdx].label} index={curLenIdx} sub={LENGTH_OPTIONS[curLenIdx].sub} fontSize={16} width={40} />
            <button
              onClick={() => setLength(LENGTH_OPTIONS[Math.min(LENGTH_OPTIONS.length - 1, curLenIdx + 1)].value)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer', padding: '0 4px' }}
            >∨</button>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>对话篇幅</span>
          </div>
        </div>

        {/* Let Them Fight! button */}
        <div style={{ marginTop: 12, flexShrink: 0 }}>
          <button
            className={canFight ? 'fight-btn fight-btn-active' : 'fight-btn'}
            onClick={() => canFight && onStart(topic, selectedKols, rounds, length, bgIdx)}
            style={{
              padding: '12px 40px', borderRadius: 24, fontSize: 18, fontWeight: 900,
              letterSpacing: '0.08em', cursor: 'pointer', border: canFight ? 'none' : '2px solid #fff',
              fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase' as const,
              background: canFight ? '#fff' : 'transparent',
              color: canFight ? '#000' : '#fff',
            }}
          >
            Let Them Fight!
          </button>
        </div>

      </div>

      {/* ===== Background-switch arrows ===== */}
      <button
        onClick={() => setBgIdx(i => (i - 1 + BG_IMAGES.length) % BG_IMAGES.length)}
        style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%',
          color: '#fff', fontSize: 18, cursor: 'pointer', zIndex: 10,
        }}
      >&lsaquo;</button>
      <button
        onClick={() => setBgIdx(i => (i + 1) % BG_IMAGES.length)}
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%',
          color: '#fff', fontSize: 18, cursor: 'pointer', zIndex: 10,
        }}
      >&rsaquo;</button>

      {/* ===== Lower section: KOL card fan (42% height) ===== */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <KolCarousel
          selectedIds={selectedKols}
          onToggle={toggleKol}
          distillOpen={distillOpen}
          onDistillClose={() => setDistillOpen(false)}
        />
      </div>

      {/* ===== Distill button — fixed bottom center ===== */}
      <div
        className="distill-btn"
        style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 40, width: 72, height: 72,
        }}
        onClick={() => setDistillOpen(true)}
      >
        <div
          className="distill-btn-inner"
          style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s, box-shadow 0.3s',
            position: 'relative', overflow: 'visible',
          }}
        >
          {[1,2,3,4,5,6].map(i => (
            <span
              key={i}
              className="steam-p"
              style={{
                position: 'absolute',
                left: `${30 + (i % 3) * 20}%`,
                bottom: '55%',
                width: 16 + (i % 3) * 6,
                height: 16 + (i % 3) * 6,
                borderRadius: '50%',
                background: 'rgba(80,80,80,0.55)',
                filter: 'blur(8px)',
                opacity: 0,
                pointerEvents: 'none',
                animationName: `steam-p${i}`,
                animationDuration: `${0.8 + i * 0.12}s`,
                animationTimingFunction: 'ease-out',
                animationIterationCount: 'infinite',
                animationPlayState: 'paused',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
          <span style={{
            fontSize: 20, fontWeight: 900, color: '#111',
            letterSpacing: '0.05em', userSelect: 'none',
            position: 'relative', zIndex: 1,
            paddingLeft: 3,
          }}>蒸!</span>
        </div>
      </div>
    </div>
  )
}
