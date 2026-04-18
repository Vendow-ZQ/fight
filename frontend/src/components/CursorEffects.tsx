import { useEffect, useRef, useCallback } from 'react'

const TRAIL_COUNT = 25
const PARTICLE_LIFETIME = 600

interface Particle {
  el: HTMLDivElement
  x: number
  y: number
  born: number
  size: number
}

export default function CursorEffects() {
  const crosshairRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -100, y: -100 })
  const hoveredRef = useRef(false)
  const rafRef = useRef<number>(0)

  const createParticle = useCallback((container: HTMLDivElement): Particle => {
    const el = document.createElement('div')
    el.style.cssText = `
      position: fixed;
      pointer-events: none;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,0.9), rgba(180,220,255,0.4));
      box-shadow: 0 0 6px 2px rgba(180,220,255,0.5);
      will-change: transform, opacity;
      z-index: 99998;
      opacity: 0;
    `
    container.appendChild(el)
    return { el, x: 0, y: 0, born: 0, size: 0 }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const crosshair = crosshairRef.current
    if (!container || !crosshair) return

    for (let i = 0; i < TRAIL_COUNT; i++) {
      particlesRef.current.push(createParticle(container))
    }

    let nextParticle = 0
    let lastSpawn = 0

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY

      crosshair.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`

      const now = performance.now()
      if (now - lastSpawn > 20) {
        const p = particlesRef.current[nextParticle]
        const size = 4 + Math.random() * 4
        p.x = e.clientX
        p.y = e.clientY
        p.born = now
        p.size = size
        p.el.style.width = size + 'px'
        p.el.style.height = size + 'px'
        p.el.style.opacity = '1'
        p.el.style.transform = `translate(${e.clientX - size / 2}px, ${e.clientY - size / 2}px)`
        nextParticle = (nextParticle + 1) % TRAIL_COUNT
        lastSpawn = now
      }
    }

    const checkHover = (target: HTMLElement) => {
      const interactive = target.closest('button, a, input, textarea, select, [role="button"], [tabindex]')
      const isHovered = !!interactive
      if (hoveredRef.current !== isHovered) {
        hoveredRef.current = isHovered
        crosshair.classList.toggle('cursor-hover', isHovered)
      }
    }

    const onMouseOver = (e: MouseEvent) => checkHover(e.target as HTMLElement)
    const onMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null
      if (!related) { hoveredRef.current = false; crosshair.classList.remove('cursor-hover'); return }
      checkHover(related)
    }

    const animate = () => {
      const now = performance.now()
      for (const p of particlesRef.current) {
        if (p.born === 0) continue
        const age = now - p.born
        if (age > PARTICLE_LIFETIME) {
          p.el.style.opacity = '0'
          p.born = 0
          continue
        }
        const progress = age / PARTICLE_LIFETIME
        const scale = 1 - progress * 0.8
        const opacity = 1 - progress
        p.el.style.opacity = String(opacity)
        p.el.style.transform = `translate(${p.x - p.size / 2}px, ${p.y - p.size / 2 - age * 0.02}px) scale(${scale})`
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseover', onMouseOver)
    window.addEventListener('mouseout', onMouseOut)
    rafRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseover', onMouseOver)
      window.removeEventListener('mouseout', onMouseOut)
      cancelAnimationFrame(rafRef.current)
      for (const p of particlesRef.current) {
        p.el.remove()
      }
      particlesRef.current = []
    }
  }, [createParticle])

  return (
    <>
      <div ref={containerRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 99998 }} />
      <div
        ref={crosshairRef}
        className="cursor-crosshair"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 99999,
          willChange: 'transform',
        }}
      >
        <div style={{
          position: 'absolute',
          width: 22,
          height: 1.5,
          top: -0.75,
          left: -11,
          background: '#fff',
          boxShadow: '0 0 4px rgba(180,220,255,0.6)',
        }} className="crosshair-h" />
        <div style={{
          position: 'absolute',
          width: 1.5,
          height: 22,
          top: -11,
          left: -0.75,
          background: '#fff',
          boxShadow: '0 0 4px rgba(180,220,255,0.6)',
        }} className="crosshair-v" />
        <div style={{
          position: 'absolute',
          width: 4,
          height: 4,
          top: -2,
          left: -2,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 0 6px 2px rgba(180,220,255,0.8)',
        }} className="crosshair-dot" />
        {/* Hover ring */}
        <div style={{
          position: 'absolute',
          width: 40,
          height: 40,
          top: -20,
          left: -20,
          borderRadius: '50%',
          border: '1.5px solid rgba(255,255,255,0)',
          boxShadow: '0 0 0px rgba(180,220,255,0)',
        }} className="crosshair-ring" />
      </div>
    </>
  )
}
