import React, { useEffect, useState } from 'react'
import { Activity, ExternalLink } from 'lucide-react'
import { Panel } from '../SharedUI'
import { formatMoney, formatTimeAgo } from '../../lib/formatters'
import { cents } from './types'

export interface LiveOutcome {
  id: string
  label: string
  ask: number
  bid: number
  mid: number
  volumeUsd?: number
}

export interface LiveMarketDetail {
  id: string
  slug: string
  venueId: 'waterx' | 'deepbook'
  title: string
  category: string
  settlesAt: string | null
  volumeUsd?: number | null
  url: string
  underlying?: string
  referencePrice?: number
  outcomes: LiveOutcome[]
  fetchedAt: string
}

function useCountdown(iso: string | null) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  if (!iso) return null
  const left = Math.max(0, Date.parse(iso) - now)
  const m = Math.floor(left / 60000)
  const s = Math.floor((left % 60000) / 1000)
  return { left, label: left > 3600_000 ? null : `${m}:${String(s).padStart(2, '0')}` }
}

export default function LiveOddsPanel({
  detail,
  error,
  selectedOutcomeId,
  onSelectOutcome,
  btcPrice,
  onNextWindow
}: {
  detail: LiveMarketDetail | null
  error: string | null
  selectedOutcomeId: string | undefined
  onSelectOutcome: (id: string) => void
  btcPrice: number | null
  onNextWindow: () => void
}) {
  const countdown = useCountdown(detail?.settlesAt ?? null)
  const isDeepbook = detail?.venueId === 'deepbook'
  const closed = countdown != null && countdown.left === 0

  return (
    <Panel
      title={detail?.title ?? 'Live market'}
      badge={isDeepbook ? 'DEEPBOOK PREDICT · LIVE' : 'WATERX · LIVE'}
      badgeVariant="success"
      actions={
        detail && (
          <span className="flex items-center gap-xs text-[11px] font-mono text-quaternary">
            <Activity className="size-3.5 text-utility-success-700" />
            {formatTimeAgo(detail.fetchedAt)}
          </span>
        )
      }
    >
      {error && (
        <div className="space-y-sm text-xs">
          <p className="text-utility-warning-700">{error}</p>
          {isDeepbook || /DeepBook/.test(error) ? (
            <button onClick={onNextWindow} className="rounded-lg bg-brand-solid px-md py-xs font-bold text-primary-on-brand">
              Go to the next open window
            </button>
          ) : null}
        </div>
      )}
      {!detail && !error && <div className="h-48 rounded bg-secondary animate-pulse" />}
      {detail && !error && closed && (
        <div className="space-y-sm text-xs">
          <p className="text-utility-warning-700">This window has closed and is waiting for settlement.</p>
          <button onClick={onNextWindow} className="rounded-lg bg-brand-solid px-md py-xs font-bold text-primary-on-brand">
            Go to the next open window
          </button>
        </div>
      )}
      {detail && !error && !closed && (
        <div className="space-y-sm text-xs font-mono">
          <div className="flex flex-wrap gap-x-md gap-y-xxs text-quaternary">
            {isDeepbook ? (
              <>
                <span>
                  Strike <span className="text-primary font-bold">${detail.referencePrice?.toLocaleString('en-US')}</span>
                </span>
                <span>
                  BTC now <span className="text-primary font-bold">{btcPrice ? `$${btcPrice.toLocaleString('en-US')}` : '—'}</span>
                </span>
                <span>
                  Closes in{' '}
                  <span className={`font-bold ${closed ? 'text-utility-error-700' : 'text-primary'}`}>
                    {closed ? 'closed' : countdown?.label}
                  </span>
                </span>
              </>
            ) : (
              <>
                {detail.volumeUsd != null && (
                  <span>
                    Volume <span className="text-primary font-bold">{formatMoney(detail.volumeUsd)}</span>
                  </span>
                )}
                {detail.settlesAt && <span>Settles {new Date(detail.settlesAt).toISOString().slice(0, 10)}</span>}
                <span>{detail.outcomes.length} open options</span>
              </>
            )}
          </div>

          <div className="border border-secondary rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-md px-sm py-xs bg-secondary text-quaternary uppercase text-[11px] font-semibold">
              <span>Outcome</span>
              <span className="text-right w-14">Buy</span>
              <span className="text-right w-14">Sell</span>
              <span className="text-right w-16">Volume</span>
            </div>
            <div className="divide-y divide-secondary max-h-72 overflow-y-auto">
              {detail.outcomes.map(o => {
                const selected = o.id === selectedOutcomeId
                return (
                  <button
                    key={o.id}
                    onClick={() => onSelectOutcome(o.id)}
                    aria-pressed={selected}
                    className={`w-full grid grid-cols-[1fr_auto_auto_auto] gap-x-md items-center px-sm py-xs text-left transition-colors ${
                      selected ? 'bg-utility-brand-50 text-utility-brand-700' : 'hover:bg-secondary-hover text-primary'
                    }`}
                  >
                    <span className="flex items-center gap-sm min-w-0">
                      <span className="truncate font-sans font-medium">{o.label}</span>
                      <span className="h-1.5 flex-1 max-w-24 rounded-full bg-secondary overflow-hidden hidden sm:block">
                        <span className="block h-full bg-brand-solid" style={{ width: `${Math.round(o.mid * 100)}%` }} />
                      </span>
                    </span>
                    <span className="text-right w-14 font-bold text-utility-success-700">{cents(o.ask)}</span>
                    <span className="text-right w-14 text-utility-error-700">{cents(o.bid)}</span>
                    <span className="text-right w-16 text-quaternary">{o.volumeUsd ? formatMoney(o.volumeUsd) : '—'}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <p className="text-[10px] text-quaternary font-sans flex flex-wrap items-center gap-xs">
            {isDeepbook
              ? 'On-chain prices from DeepBook Predict (Sui mainnet), refreshed every 10s.'
              : "Prices from WaterX's public predict API, refreshed every 30s."}
            <a href={detail.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-xxs text-brand-primary hover:underline">
              Source <ExternalLink className="size-3" />
            </a>
          </p>
        </div>
      )}
    </Panel>
  )
}
