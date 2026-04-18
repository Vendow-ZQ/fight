import { useState, useRef, useEffect } from 'react'
import { KOLS } from '../data/kols'
import type { KOL } from '../data/kols'
import KolCard from './KolCard'
import DistillModal from './DistillModal'
import type { DistillFormData } from './DistillModal'
import { distillKol, fetchKols, deleteKol } from '../api/battle'

interface KolCarouselProps {
  selectedIds: string[]
  onToggle: (id: string) => void
  distillOpen: boolean
  onDistillClose: () => void
}

export default function KolCarousel({ selectedIds, onToggle, distillOpen, onDistillClose }: KolCarouselProps) {
  const [kolList, setKolList] = useState<KOL[]>(KOLS)
  const [centerIndex, setCenterIndex] = useState(() => {
    const idx = KOLS.findIndex(k => k.id === 'da_bing')
    return idx >= 0 ? idx : 0
  })
  const dragStartX = useRef<number | null>(null)
  const dragged    = useRef(false)

  const prev = () => setCenterIndex(i => (i - 1 + kolList.length) % kolList.length)
  const next = () => setCenterIndex(i => (i + 1) % kolList.length)

  const builtInIds = new Set(KOLS.map(k => k.id))

  const handleDeleteKol = async (id: string) => {
    try {
      await deleteKol(id)
      setKolList(prev => prev.filter(k => k.id !== id))
      if (centerIndex >= kolList.length - 1) setCenterIndex(0)
    } catch { /* ignore */ }
  }

  const handleDistillSubmit = async (data: DistillFormData) => {
    const result = await distillKol({
      mode: data.mode,
      url: data.url,
      platform: data.platform,
      name: data.name,
      domains: data.domains,
      file: data.file,
      avatarFile: data.avatarFile,
    })
    setKolList(prev => [...prev, result])
    setCenterIndex(kolList.length)
  }

  const refreshKols = async () => {
    try {
      const kols = await fetchKols()
      if (kols.length > 0) setKolList(kols)
    } catch { /* keep local list */ }
  }

  useEffect(() => { refreshKols() }, [])

  useEffect(() => {
    const btnPrev = document.getElementById('carousel-prev')
    const btnNext = document.getElementById('carousel-next')
    btnPrev?.addEventListener('click', prev)
    btnNext?.addEventListener('click', next)
    return () => {
      btnPrev?.removeEventListener('click', prev)
      btnNext?.removeEventListener('click', next)
    }
  })

  const getOffset = (idx: number) => {
    let off = idx - centerIndex
    const half = Math.floor(kolList.length / 2)
    if (off >  half) off -= kolList.length
    if (off < -half) off += kolList.length
    return off
  }

  const onPointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX
    dragged.current = false
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return
    if (Math.abs(e.clientX - dragStartX.current) > 10) dragged.current = true
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return
    const delta = e.clientX - dragStartX.current
    if (dragged.current && Math.abs(delta) >= 50) delta < 0 ? next() : prev()
    dragStartX.current = null
    // reset dragged after a tick so click handlers fire first
    setTimeout(() => { dragged.current = false }, 0)
  }

  return (
    <div
      className="absolute inset-0"
      style={{ cursor: 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={e => { e.deltaY > 0 ? next() : prev() }}
    >
      {kolList.map((kol, idx) => (
        <KolCard
          key={kol.id}
          kol={kol}
          offset={getOffset(idx)}
          playerIndex={selectedIds.indexOf(kol.id)}
          onSelect={id => { if (!dragged.current) onToggle(id) }}
          onDelete={builtInIds.has(kol.id) ? undefined : handleDeleteKol}
        />
      ))}

      <DistillModal
        open={distillOpen}
        onClose={onDistillClose}
        onSubmit={handleDistillSubmit}
      />
    </div>
  )
}
