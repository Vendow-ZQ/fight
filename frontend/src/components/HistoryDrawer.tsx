interface HistoryItem {
  id: string
  topic: string
  kols: string[]
  date: string
}

const MOCK_HISTORY: HistoryItem[] = [
  {
    id: '1',
    topic: '内卷有没有意义？',
    kols: ['章雪风', '大兵'],
    date: '2026/04/18',
  },
  {
    id: '2',
    topic: 'AI会不会取代人类？',
    kols: ['锋哥', '胡陈峰'],
    date: '2026/04/17',
  },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function HistoryDrawer({ open, onClose }: Props) {
  return (
    <>
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px)', zIndex: 40,
          }}
          onClick={onClose}
        />
      )}

      <div style={{
        position: 'fixed', top: 0, left: 0, height: '100%', width: 340,
        background: 'rgba(10,10,14,0.95)', borderRight: '1px solid rgba(255,255,255,0.08)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        fontFamily: "'Rajdhani', 'Noto Sans SC', sans-serif",
      }}>
        {/* Header */}
        <div style={{
          padding: '28px 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <h2 style={{
            fontSize: 18, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '0.06em',
            fontFamily: "'Orbitron', 'Noto Sans SC', sans-serif",
          }}>HISTORY</h2>
          <button onClick={onClose} className="history-close-btn" style={{
            background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer',
            width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.4)', fontSize: 16,
          }}>×</button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MOCK_HISTORY.map(item => (
            <div key={item.id} className="history-card" style={{
              borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.03)', padding: '20px', cursor: 'pointer',
            }}>
              {/* VS Banner */}
              <div style={{
                height: 56, borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(180,220,255,0.06) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16,
              }}>
                {item.kols.map((name, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {i > 0 && <span style={{
                      fontSize: 10, color: 'rgba(180,220,255,0.5)', fontWeight: 700,
                      fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.1em',
                    }}>VS</span>}
                    <span style={{
                      width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
                    }}>{name[0]}</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{name}</span>
                  </span>
                ))}
              </div>

              {/* Topic */}
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.5, marginBottom: 8 }}>
                {item.topic}
              </div>

              {/* Date */}
              <div style={{
                fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500,
              }}>
                {item.date}
              </div>
            </div>
          ))}

          {MOCK_HISTORY.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '48px 0', color: 'rgba(255,255,255,0.15)', fontSize: 13,
            }}>暂无对战记录</div>
          )}
        </div>
      </div>
    </>
  )
}
