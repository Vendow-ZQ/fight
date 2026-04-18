import { TOPICS } from '../data/kols'

interface TopicBubblesProps {
  onSelect: (topic: string) => void
}

const POSITIONS = [
  { left: '5%', top: '10%' },
  { right: '8%', top: '5%' },
  { left: '12%', top: '55%' },
  { right: '12%', top: '50%' },
  { left: '30%', top: '5%' },
  { right: '30%', top: '60%' },
  { left: '2%', top: '75%' },
]

export default function TopicBubbles({ onSelect }: TopicBubblesProps) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
      {TOPICS.map((topic, i) => (
        <button
          key={topic}
          onClick={() => onSelect(topic === '… ?' ? '' : topic)}
          className="absolute pointer-events-auto px-4 py-2 rounded-full text-sm text-white/80 hover:text-white border border-white/20 hover:border-white/50 bg-white/5 hover:bg-white/10 transition-all duration-200 whitespace-nowrap"
          style={{
            ...POSITIONS[i % POSITIONS.length],
            backdropFilter: 'blur(4px)',
          }}
        >
          {topic}
        </button>
      ))}
    </div>
  )
}
