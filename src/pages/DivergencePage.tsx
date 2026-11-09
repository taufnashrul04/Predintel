import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Panel } from '../components/SharedUI'
import { FlashValue } from '../components/motion'
import { VENUE_MAP } from '../lib/config/venues'
import { formatMoney, formatTimeAgo } from '../lib/formatters'

interface VenueSide {
  venueId: 'waterx' | 'polymarket'
  name: string
  price: number
  ask?: number
  bid?: number
  url: string
  tradeId?: string | null
  outcomeId?: string | null
}

interface LiveRow {
  id: string
  question: string
  category: string
  volumeUsd: number
  closesAt: string
  consensus: number
  gapPp: number
  edgePp: number
  low: VenueSide
  high: VenueSide
}

interface LiveDivergence {
  fetchedAt: string
  matched: number
  rows: LiveRow[]
}

const cents = (p: number) => `${(p * 100).toFixed(1)}¢`

function VenueLink({ side, tone }: { side: VenueSide; tone: 'buy' | 'sell' }) {
  const color = VENUE_MAP.get(side.venueId)?.color ?? '#888'
  return (
    <a
      href={side.url}
      target="_blank"
      rel="noreferrer"
      onClick={e => e.stopPropagation()}
      className={`group inline-flex flex-col rounded-lg border border-secondary bg-secondary px-sm py-xxs hover:border-brand transition-colors ${
        tone === 'buy' ? 'text-utility-success-700' : 'text-utility-error-700'
      }`}
      title={`Open this market on ${side.name}`}
    >
      <span className="inline-flex items-center gap-xs font-bold">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        {side.name} @ <FlashValue value={side.price}>{cents(side.price)}</FlashValue>
        <ExternalLink className="size-3 shrink-0 text-quaternary group-hover:text-brand-primary" />
      </span>
      {side.ask != null && side.bid != null && (
        <span className="text-[10px] text-quaternary">
          bid {cents(side.bid)} · ask {cents(side.ask)}
        </span>
      )}
    </a>
  )
}

export default function DivergencePage() {
  const [source, setSource] = useState<'live' | 'demo'>('live')
  const [divergences, setDivergences] = useState<any[]>([])
  const [threshold, setThreshold] = useState<number>(1)
  const [live, setLive] = useState<LiveDivergence | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (source !== 'demo') return
    fetch(`/api/divergence?threshold=${threshold}`)
      .then(r => r.json())
      .then(d => setDivergences(Array.isArray(d) ? d : []))
      .catch(console.error)
  }, [threshold, source])

  useEffect(() => {
    if (source !== 'live') return
    let cancelled = false
    const load = () =>
      fetch('/api/divergence/live?min=0.5')
        .then(async r => {
          const body = await r.json()
          if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
          if (!cancelled) {
            setLive(body)
            setLiveError(null)
          }
        })
        .catch(err => !cancelled && setLiveError(err.message))
    load()
    const t = window.setInterval(load, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [source])

  const liveRows = (live?.rows ?? []).filter(r => r.gapPp >= threshold)

  return (
    <div className="space-y-md">
      <div className="bg-primary border border-secondary rounded-xl p-xl shadow-xs flex flex-wrap items-center justify-between gap-md">
        <div>
          <h2 className="text-heading-xs font-bold text-primary">Cross-Venue Divergence &amp; Arbitrage Scanner</h2>
          <p className="text-xs text-secondary mt-xxs">
            {source === 'live'
              ? 'The same market priced on WaterX and Polymarket. Each venue links straight to that market.'
              : 'Demo model across seven venues.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-sm">
          <div className="flex gap-xxs bg-secondary p-xxs rounded-lg border border-secondary" role="tablist" aria-label="Divergence source">
            {(['live', 'demo'] as const).map(src => (
              <button
                key={src}
                role="tab"
                aria-selected={source === src}
                onClick={() => {
                  setSource(src)
                  setThreshold(src === 'live' ? 1 : 5)
                }}
                className={`px-sm py-xxs rounded text-xs font-bold ${source === src ? 'bg-brand-solid text-primary-on-brand' : 'text-quaternary hover:text-primary'}`}
              >
                {src === 'live' ? 'Live · WaterX × Polymarket' : 'Demo'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-sm bg-secondary p-sm rounded-lg border border-secondary text-xs font-mono">
            <span className="text-quaternary">Gap ≥</span>
            <span className="text-utility-warning-700 font-bold text-sm">{threshold.toFixed(1)}pp</span>
            <input
              type="range"
              min={source === 'live' ? 0.5 : 1}
              max="20"
              step="0.5"
              value={threshold}
              onChange={e => setThreshold(parseFloat(e.target.value))}
              aria-label="Minimum price gap"
              className="w-32 accent-amber-400"
            />
          </div>
        </div>
      </div>

      {source === 'live' ? (
        <Panel
          title="Live divergence"
          badge={live ? `${liveRows.length} OF ${live.matched} MATCHED` : 'LOADING'}
          badgeVariant="success"
          actions={live && <span className="text-[11px] font-mono text-quaternary">updated {formatTimeAgo(live.fetchedAt)}</span>}
          noPadding
        >
          {liveError && !live && <p className="p-xl text-center text-xs text-utility-error-700">Couldn't load live divergence: {liveError}</p>}
          {!live && !liveError && <div className="m-md h-48 rounded-lg pi-shimmer" />}
          {live && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                    <th className="py-xs px-sm">Market (YES)</th>
                    <th className="py-xs px-sm">Consensus</th>
                    <th className="py-xs px-sm">Cheaper venue</th>
                    <th className="py-xs px-sm">Pricier venue</th>
                    <th className="py-xs px-sm">Gap</th>
                    <th className="py-xs px-sm">Executable edge</th>
                    <th className="py-xs px-sm text-right">Trade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary">
                  {liveRows.map(r => {
                    const wx = r.low.venueId === 'waterx' ? r.low : r.high
                    return (
                      <tr key={r.id} className="hover:bg-secondary-hover transition-colors">
                        <td className="py-sm px-sm font-sans font-medium text-primary">
                          <div className="min-w-[240px] max-w-sm">{r.question}</div>
                          <span className="text-[10px] text-tertiary uppercase font-mono">
                            {r.category} · {formatMoney(r.volumeUsd)} vol · closes {r.closesAt.slice(0, 10)}
                          </span>
                        </td>
                        <td className="py-sm px-sm">{cents(r.consensus)}</td>
                        <td className="py-sm px-sm"><VenueLink side={r.low} tone="buy" /></td>
                        <td className="py-sm px-sm"><VenueLink side={r.high} tone="sell" /></td>
                        <td className="py-sm px-sm font-bold text-utility-warning-700">+{r.gapPp.toFixed(1)}pp</td>
                        <td className={`py-sm px-sm font-bold ${r.edgePp > 0 ? 'text-utility-success-700' : 'text-quaternary'}`}>
                          {r.edgePp > 0 ? `+${r.edgePp.toFixed(1)}pp` : 'inside WaterX spread'}
                        </td>
                        <td className="py-sm px-sm text-right">
                          {wx.tradeId ? (
                            <button
                              onClick={() => navigate(`/trade?market=${encodeURIComponent(wx.tradeId!)}${wx.outcomeId ? `&outcome=${wx.outcomeId}` : ''}`)}
                              className="px-sm py-xxs bg-secondary hover:bg-brand-solid hover:text-primary-on-brand rounded text-xs transition-colors font-bold whitespace-nowrap"
                            >
                              Paper trade →
                            </button>
                          ) : (
                            <span className="text-[10px] text-quaternary">open on venue</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {liveRows.length === 0 && (
                <p className="p-xl text-center text-xs text-tertiary">No matched market differs by {threshold.toFixed(1)}pp or more right now.</p>
              )}
              <p className="px-sm py-xs border-t border-secondary text-[10px] text-quaternary">
                WaterX mid vs Polymarket YES price for markets with the same question. Executable edge counts only when Polymarket sits
                outside WaterX's bid/ask.
              </p>
            </div>
          )}
        </Panel>
      ) : (
        <Panel title="Divergence matches" badge={`${divergences.length} · DEMO`} noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                  <th className="py-xs px-sm">Market Event</th>
                  <th className="py-xs px-sm">Outcome</th>
                  <th className="py-xs px-sm">Consensus</th>
                  <th className="py-xs px-sm">Lowest Venue (Buy)</th>
                  <th className="py-xs px-sm">Highest Venue (Sell)</th>
                  <th className="py-xs px-sm">Spread Gap</th>
                  <th className="py-xs px-sm">Gross Edge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {divergences.map((d: any, idx: number) => (
                  <tr
                    key={idx}
                    onClick={() => navigate(`/markets/${d.event.slug || d.event.id}`)}
                    className="hover:bg-secondary-hover cursor-pointer transition-colors"
                  >
                    <td className="py-sm px-sm font-sans font-medium text-primary">
                      <div className="truncate max-w-sm">{d.event.title}</div>
                      <span className="text-[10px] text-tertiary uppercase">{d.event.category}</span>
                    </td>
                    <td className="py-sm px-sm font-bold text-brand-primary">{d.outcome?.label || 'YES'}</td>
                    <td className="py-sm px-sm">{(d.consensus * 100).toFixed(1)}¢</td>
                    <td className="py-sm px-sm text-utility-success-700 font-bold">
                      {VENUE_MAP.get(d.minQuote.venueId)?.name} @ {(d.minQuote.lastPrice * 100).toFixed(1)}¢
                    </td>
                    <td className="py-sm px-sm text-utility-error-700 font-bold">
                      {VENUE_MAP.get(d.maxQuote.venueId)?.name} @ {(d.maxQuote.lastPrice * 100).toFixed(1)}¢
                    </td>
                    <td className="py-sm px-sm font-bold text-utility-warning-700">+{d.spreadPp.toFixed(1)}pp</td>
                    <td className="py-sm px-sm font-bold text-utility-success-700">+{d.arbitrageEdge.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-sm py-xs border-t border-secondary text-[10px] text-quaternary">
              Demo data: these quotes are simulated, so there are no venue links here. Switch to Live for real markets.
            </p>
          </div>
        </Panel>
      )}
    </div>
  )
}
