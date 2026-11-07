import React, { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Splits "$1,234.5k" into prefix / number / suffix so only the number animates.
const NUMBER_RE = /^([^0-9-]*)(-?[\d,]*\.?\d+)(.*)$/

function parse(value: string | number) {
  const text = String(value)
  const m = text.match(NUMBER_RE)
  if (!m) return null
  const raw = m[2].replace(/,/g, '')
  const decimals = raw.includes('.') ? raw.split('.')[1].length : 0
  return { prefix: m[1], number: Number(raw), decimals, suffix: m[3], grouped: m[2].includes(',') }
}

function format(n: number, decimals: number, grouped: boolean) {
  return grouped || Math.abs(n) >= 1000
    ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : n.toFixed(decimals)
}

// Counts from the previous value to the new one; non-numeric values render as-is.
export function AnimatedNumber({ value, duration = 700 }: { value: string | number; duration?: number }) {
  const parsed = parse(value)
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? parsed?.number ?? 0 : 0))
  const fromRef = useRef(0)
  const frame = useRef<number>()

  useEffect(() => {
    if (!parsed) return
    const from = fromRef.current
    const to = parsed.number
    if (prefersReducedMotion() || from === to) {
      setShown(to)
      fromRef.current = to
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(from + (to - from) * eased)
      if (t < 1) frame.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      fromRef.current = to
    }
  }, [parsed?.number, duration])

  if (!parsed) return <>{value}</>
  return (
    <span className="tabular-nums">
      {parsed.prefix}
      {format(shown, parsed.decimals, parsed.grouped)}
      {parsed.suffix}
    </span>
  )
}

// Flashes green or red when `value` rises or falls; `children` is what renders.
export function FlashValue({ value, children, className = '' }: { value: number | null | undefined; children: React.ReactNode; className?: string }) {
  const prev = useRef(value)
  const [flash, setFlash] = useState<'' | 'pi-flash-up' | 'pi-flash-down'>('')
  const [key, setKey] = useState(0)

  useEffect(() => {
    const before = prev.current
    prev.current = value
    if (before == null || value == null || before === value) return
    setFlash(value > before ? 'pi-flash-up' : 'pi-flash-down')
    setKey(k => k + 1)
  }, [value])

  return (
    <span key={key} className={`${flash} px-xxs -mx-xxs ${className}`}>
      {children}
    </span>
  )
}

// One delegated listener drives the cursor spotlight on every .pi-spotlight element.
export function useSpotlight() {
  useEffect(() => {
    if (prefersReducedMotion()) return
    let raf = 0
    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('.pi-spotlight') as HTMLElement | null
      if (!el) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])
}
