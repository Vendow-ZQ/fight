import { useState } from 'react'
import type { KOL } from '../data/kols'

interface KolCardProps {
  kol: KOL
  offset: number
  playerIndex: number   // -1 = not selected, 0 = 1P, 1 = 2P, 2 = 3P, 3 = 4P
  onSelect: (id: string) => void
  onDelete?: (id: string) => void
}

const PLAYER_COLORS = ['#ff2d78', '#00d4ff', '#00ffa3', '#ffe14d']
const PLAYER_LABELS = ['1P', '2P', '3P', '4P']

const ROT    = [-20, -10,  0,  10,  20]
const X_OFF  = [-320, -160,  0,  160,  320]
const Y_SINK = [180,  100,  60,  100,  180]
const SCALE  = [0.75, 0.87, 1.0, 0.87, 0.75]
const Z_IDX  = [1,    2,    10,   2,    1]

export default function KolCard({ kol, offset, playerIndex, onSelect, onDelete }: KolCardProps) {
  const [hovered, setHovered] = useState(false)

  if (Math.abs(offset) > 2) return null

  const slot    = offset + 2
  const selected = playerIndex >= 0
  const pColor  = selected ? PLAYER_COLORS[playerIndex] : null
  const pLabel  = selected ? PLAYER_LABELS[playerIndex] : null
  const lift    = hovered ? -24 : 0

  return (
    <div
      className="absolute cursor-pointer select-none"
      style={{
        width: 280,
        height: 420,
        bottom: 0,
        left: '50%',
        transformOrigin: 'bottom center',
        transform: `translateX(calc(-50% + ${X_OFF[slot]}px)) translateY(${Y_SINK[slot] + lift}px) scale(${SCALE[slot]}) rotate(${ROT[slot]}deg)`,
        zIndex: hovered ? 20 : Z_IDX[slot],
        transition: 'transform 0.35s cubic-bezier(0.34, 1.2, 0.64, 1)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(kol.id)}
    >
      <div
        className="w-full h-full flex flex-col items-center pt-8 pb-6 px-5 gap-4 overflow-hidden relative"
        style={{
          background: '#E8E8E8',
          borderRadius: 36,
          boxShadow: pColor
            ? `0 0 0 2px ${pColor}, 0 0 12px ${pColor}88, 0 0 32px ${pColor}44, 0 12px 32px rgba(0,0,0,0.45)`
            : hovered
            ? '0 32px 64px rgba(0,0,0,0.6)'
            : '0 12px 32px rgba(0,0,0,0.45)',
        }}
      >
        {/* Player badge */}
        {pColor && pLabel && (
          <div
            className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white z-10"
            style={{ background: pColor, boxShadow: `0 0 10px ${pColor}aa, 0 0 20px ${pColor}44`, fontFamily: "'Orbitron', sans-serif", fontSize: 11 }}
          >
            {pLabel}
          </div>
        )}

        {/* Delete button for distilled KOLs */}
        {onDelete && (
          <div
            className="absolute top-3 left-3 w-7 h-7 rounded-full flex items-center justify-center z-10
                       bg-black/10 hover:bg-red-500 hover:text-white text-black/40 transition-colors"
            style={{ fontSize: 14, cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); onDelete(kol.id) }}
          >
            ×
          </div>
        )}

        {/* Avatar */}
        <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center
                        font-bold text-3xl text-black shadow-md flex-shrink-0">
          {kol.name[0]}
        </div>

        {/* Name */}
        <div className="text-center flex-shrink-0">
          <div className="font-bold text-xl text-black">{kol.name}</div>
          <div className="text-sm text-black/50 mt-0.5">{kol.title}</div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 justify-center flex-shrink-0">
          {kol.tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-black/10 text-black/60">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
