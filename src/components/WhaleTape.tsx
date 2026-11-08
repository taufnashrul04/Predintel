import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Panel } from './SharedUI'
import { VENUE_MAP } from '../lib/config/venues'
import { formatMoney, formatTimeAgo } from '../lib/formatters'

export interface WhaleTrade {
  id: string
  venue: 'polymarket' | 'deepbook'
  chain: string
  wallet: string | null
  trader: string | null
  side: 'buy' | 'sell'
  outcome: string
  shares: number
  price: number | null
  notional: number
  market: string
  url: string | null
  txUrl: string
  at: string
}

export interface WhaleTapeData {
  fetchedAt: string
  minUsd: number
  count24h: number
  count24hCapped: boolean
  volume24h: number
  trades: WhaleTrade[]
  sui: WhaleTrade[]
}

const REFRESH_MS = 15_000
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export function useWhaleTape() {
  const [tape, setTape] = useState<WhaleTapeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch('/api/whales')
        .then(async r => {
          const body = await r.json()
          if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
          if (!cancelled) {
            setTape(body)
            setError(null)
          }
        })
        .catch(err => !cancelled && setError(err.message))
    load()
    const t = window.setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [])
  return { tape, error }
}

function Row({ t, fresh }: { t: WhaleTrade; fresh: boolean }) {
  const navigate = useNavigate()
  const venue = VENUE_MAP.get(t.venue)
  const open = () => {
    if (!t.url) return
    if (t.url.startsWith('/')) navigate(t.url)
    else window.open(t.url, '_blank', 'noopener,noreferrer')
  }
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={e => e.key === 'Enter' && open()}
      className={`${fresh ? 'pi-rise' : ''} p-xs bg-secondary hover:bg-secondary-hover transition-colors rounded-lg border border-secondary text-xs flex items-center justify-between gap-sm cursor-pointer`}
    >
      <div className="flex items-start gap-xs min-w-0">
        <span className="mt-xxs w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: venue?.color ?? '#888' }} title={venue?.name} />
        <div className="min-w-0">
          <div className="text-primary truncate max-w-[200px]" title={t.market}>{t.market}</div>
          <div className="flex items-center gap-xs text-[10px] font-mono">
            <span className={`font-bold ${t.side === 'buy' ? 'text-utility-success-700' : 'text-utility-error-700'}`}>
              {t.side.toUpperCase()} {t.outcome}
            </span>
            <span className="text-quaternary truncate">{t.trader ?? (t.wallet ? short(t.wallet) : '')}</span>
          </div>
        </div>
      </div>
      <div className="text-right font-mono shrink-0">
        <div className="font-bold text-primary">{formatMoney(t.notional)}</div>
        <div className="text-quaternary text-[11px] flex items-center justify-end gap-xxs">
          {t.price != null && <span>@ {(t.price * 100).toFixed(1)}¢ ·</span>}
          <span>{formatTimeAgo(t.at)}</span>
          <a
            href={t.txUrl}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            aria-label={`Transaction on ${t.chain}`}
            className="text-quaternary hover:text-brand-primary"
          >
            <ExternalLink className="size-3 shrink-0" />
          </a>
        </div>
      </div>
    </div>
  )
}

// Live large trades: Polymarket takers above the threshold, and the biggest recent DeepBook Predict fills on Sui.
export default function WhaleTape({ tape, error }: { tape: WhaleTapeData | null; error: string | null }) {
  const seen = useRef<Set<string>>(new Set())
  const firstLoad = seen.current.size === 0
  const fresh = new Set((tape?.trades ?? []).filter(t => !seen.current.has(t.id)).map(t => t.id))
  useEffect(() => {
    tape?.trades.forEach(t => seen.current.add(t.id))
  }, [tape])

  return (
    <Panel
      title="Whale Tape"
      badge={`≥ ${formatMoney(tape?.minUsd ?? 10000)} · LIVE`}
      badgeVariant="brand"
      actions={<span className="pi-live w-2 h-2 rounded-full bg-success-primary" aria-label="Live" />}
    >
      {error && !tape && <p className="text-xs text-utility-error-700">Couldn't load whale trades: {error}</p>}
      {!tape && !error && <div className="h-64 rounded-lg pi-shimmer" />}
      {tape && (
        <div className="space-y-sm">
          <div className="space-y-xs overflow-y-auto max-h-80 pr-xxs">
            {tape.trades.slice(0, 25).map(t => (
              <Row key={t.id} t={t} fresh={!firstLoad && fresh.has(t.id)} />
            ))}
            {tape.trades.length === 0 && <p className="text-xs text-tertiary">No trades above the threshold right now.</p>}
          </div>
          {tape.sui.length > 0 && (
            <div className="space-y-xs">
              <div className="text-[11px] uppercase font-semibold font-mono text-quaternary">Largest on Sui · DeepBook Predict</div>
              {tape.sui.slice(0, 3).map(t => (
                <Row key={t.id} t={t} fresh={false} />
              ))}
            </div>
          )}
          <p className="text-[10px] text-quaternary font-mono">
            Polymarket takers ≥ {formatMoney(tape.minUsd)} (many WaterX markets mirror them) · updated {formatTimeAgo(tape.fetchedAt)}
          </p>
        </div>
      )}
    </Panel>
  )
}
