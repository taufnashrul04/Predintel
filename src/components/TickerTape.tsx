import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlashValue } from './motion'

interface TickerItem {
  key: string
  label: string
  value: string
  numeric: number | null
  tone?: 'up' | 'down' | 'brand'
  href?: string
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

async function getJson(url: string) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

// Live strip under the header: spot prices, live odds and the latest on-chain fills.
export default function TickerTape() {
  const navigate = useNavigate()
  const [items, setItems] = useState<TickerItem[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [prices, live, flow] = await Promise.allSettled([
        getJson('/api/live/prices'),
        getJson('/api/trade/live-markets'),
        getJson('/api/predict-flow')
      ])
      const next: TickerItem[] = []
      if (prices.status === 'fulfilled') {
        for (const [sym, p] of Object.entries<any>(prices.value.prices ?? {})) {
          next.push({
            key: `px-${sym}`,
            label: `${sym}/USDC`,
            value: `$${p.price.toLocaleString('en-US', { maximumFractionDigits: p.price < 1 ? 4 : 0 })}`,
            numeric: p.price
          })
        }
      }
      if (live.status === 'fulfilled') {
        for (const m of live.value.deepbook ?? []) {
          const up = m.outcomes?.[0]
          next.push({ key: m.id, label: m.title, value: `UP ${(up.ask * 100).toFixed(1)}¢`, numeric: up.ask, tone: 'brand', href: `/trade?market=${encodeURIComponent(m.id)}` })
        }
        for (const e of (live.value.waterx ?? []).slice(0, 10)) {
          const lead = e.preview?.[0]
          if (!lead) continue
          next.push({ key: e.id, label: e.title, value: `${lead.label} ${(lead.price * 100).toFixed(1)}¢`, numeric: lead.price, href: `/trade?market=${encodeURIComponent(e.id)}` })
        }
      }
      if (flow.status === 'fulfilled') {
        for (const f of (flow.value.fills ?? []).slice(0, 5)) {
          if (!f.side) continue
          const who = f.owner ? short(f.owner) : 'trader'
          next.push({
            key: f.digest,
            label: `${who} on DeepBook Predict`,
            value: `${f.side === 'sell' ? 'SOLD' : `BUY ${f.side.toUpperCase()}`} $${f.cost.toFixed(2)}`,
            numeric: null,
            tone: f.side === 'down' || f.side === 'sell' ? 'down' : 'up',
            href: f.owner ? `/wallets/${f.owner}` : undefined
          })
        }
      }
      if (!cancelled && next.length) setItems(next)
    }
    load()
    const timer = window.setInterval(load, 30_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  if (items.length === 0) {
    return <div className="h-8 border-b border-secondary bg-primary pi-shimmer" aria-hidden="true" />
  }

  const toneClass = (t?: TickerItem['tone']) =>
    t === 'up' ? 'text-utility-success-700' : t === 'down' ? 'text-utility-error-700' : t === 'brand' ? 'text-brand-primary' : 'text-primary'

  const row = (copy: number) =>
    items.map(item => (
      <button
        key={`${copy}-${item.key}`}
        onClick={() => item.href && navigate(item.href)}
        tabIndex={copy === 0 ? 0 : -1}
        aria-hidden={copy === 1}
        className="flex items-center gap-xs px-lg h-8 text-xs whitespace-nowrap border-r border-secondary hover:bg-secondary-hover transition-colors"
      >
        <span className="text-quaternary max-w-[220px] truncate">{item.label}</span>
        <FlashValue value={item.numeric} className={`font-mono font-semibold ${toneClass(item.tone)}`}>
          {item.value}
        </FlashValue>
      </button>
    ))

  return (
    <div className="pi-ticker relative overflow-hidden border-b border-secondary bg-primary" aria-label="Live market ticker">
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center gap-xs pl-md pr-sm bg-primary text-[10px] font-mono font-bold uppercase tracking-wider text-utility-success-700">
        <span className="pi-live w-1.5 h-1.5 rounded-full bg-success-primary" />
        Live
      </div>
      <div className="pi-ticker-track pl-[64px]" style={{ ['--pi-ticker-duration' as string]: `${Math.max(40, items.length * 5)}s` }}>
        {row(0)}
        {row(1)}
      </div>
    </div>
  )
}
