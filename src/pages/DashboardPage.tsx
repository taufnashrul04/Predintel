import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { Panel, StatCard } from '../components/SharedUI'
import { FlashValue } from '../components/motion'
import { VENUE_MAP } from '../lib/config/venues'
import { formatMoney } from '../lib/formatters'
import { usePredictFlow } from '../lib/predictFlow'
import CrowdedTradesPanel from '../components/CrowdedTradesPanel'
import WhaleTape, { useWhaleTape } from '../components/WhaleTape'

interface DivergenceSide {
  venueId: string
  name: string
  price: number
  url: string
}

interface DivergenceRow {
  id: string
  question: string
  gapPp: number
  low: DivergenceSide
  high: DivergenceSide
}

interface LiveEvent {
  id: string
  title: string
  volumeUsd: number
  preview: { id: string; label: string; price: number }[]
}

interface LiveMarkets {
  waterx: LiveEvent[]
  waterxMatches: unknown[]
  waterxUpdown: unknown[]
  deepbook: unknown[]
}

const cents = (p: number) => `${(p * 100).toFixed(1)}¢`

// Polls a JSON endpoint; keeps the last good value when a refresh fails.
function usePolled<T>(url: string, everyMs: number) {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch(url)
        .then(r => (r.ok ? r.json() : Promise.reject()))
        .then(d => !cancelled && setData(d))
        .catch(() => {})
    load()
    const t = window.setInterval(load, everyMs)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [url, everyMs])
  return data
}

function VenueChip({ side }: { side: DivergenceSide }) {
  return (
    <a
      href={side.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-xxs rounded border border-secondary bg-secondary px-xs py-xxs hover:border-brand text-primary"
      title={`Open on ${side.name}`}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: VENUE_MAP.get(side.venueId)?.color ?? '#888' }} />
      {side.name} <FlashValue value={side.price}>{cents(side.price)}</FlashValue>
      <ExternalLink className="size-3 shrink-0 text-quaternary" />
    </a>
  )
}

function SeeAll({ to }: { to: string }) {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate(to)} className="inline-flex items-center gap-xxs text-xs font-mono text-brand-primary hover:underline">
      All <ArrowRight className="size-3 shrink-0" />
    </button>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { tape, error: whaleError } = useWhaleTape()
  const { flow } = usePredictFlow()
  const live = usePolled<LiveMarkets>('/api/trade/live-markets', 60_000)
  const divergence = usePolled<{ rows: DivergenceRow[] }>('/api/divergence/live?min=1', 60_000)

  const liveCount = live ? live.waterx.length + live.waterxMatches.length + live.waterxUpdown.length + live.deepbook.length : null
  const topMarkets = [...(live?.waterx ?? [])].sort((a, b) => b.volumeUsd - a.volumeUsd).slice(0, 6)
  const topGap = divergence?.rows[0]

  return (
    <div className="space-y-md">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm">
        <StatCard label="Live markets" value={liveCount ?? '…'} subtext="WaterX + DeepBook Predict" />
        <StatCard
          label="Divergences ≥ 1pp"
          value={divergence ? divergence.rows.length : '…'}
          subtext={topGap ? `Top gap +${topGap.gapPp.toFixed(1)}pp` : 'WaterX vs Polymarket'}
        />
        <StatCard
          label="Whale trades 24h"
          value={tape ? `${tape.count24h}${tape.count24hCapped ? '+' : ''}` : '…'}
          subtext={tape ? `${formatMoney(tape.volume24h)} at ≥ ${formatMoney(tape.minUsd)}` : 'Polymarket takers'}
        />
        <StatCard
          label="On-chain traders"
          value={flow ? flow.totals.traders : '…'}
          subtext={flow ? `${flow.totals.fills} DeepBook Predict fills` : 'DeepBook Predict'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        <Panel title="Live divergence" className="lg:col-span-2" actions={<SeeAll to="/divergence" />} noPadding>
          {!divergence ? (
            <div className="m-md h-40 rounded-lg pi-shimmer" />
          ) : divergence.rows.length === 0 ? (
            <p className="p-xl text-center text-xs text-tertiary">No matched market differs by 1pp or more right now.</p>
          ) : (
            <div className="divide-y divide-secondary">
              {divergence.rows.slice(0, 5).map(r => (
                <div key={r.id} className="px-md py-sm flex flex-col md:flex-row md:items-center justify-between gap-xs text-xs">
                  <div className="text-primary font-medium min-w-0 md:max-w-[50%]">{r.question}</div>
                  <div className="flex flex-wrap items-center gap-xs font-mono">
                    <VenueChip side={r.low} />
                    <ArrowRight className="size-3 shrink-0 text-quaternary" />
                    <VenueChip side={r.high} />
                    <span className="font-bold text-utility-warning-700">+{r.gapPp.toFixed(1)}pp</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Top markets" actions={<SeeAll to="/markets" />} noPadding>
          {!live ? (
            <div className="m-md h-40 rounded-lg pi-shimmer" />
          ) : (
            <div className="divide-y divide-secondary">
              {topMarkets.map(m => {
                const lead = m.preview[0]
                return (
                  <button
                    key={m.id}
                    onClick={() => navigate(`/trade?market=${encodeURIComponent(m.id)}`)}
                    className="w-full px-md py-sm flex items-center justify-between gap-sm text-left text-xs hover:bg-secondary-hover transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block text-primary font-medium truncate">{m.title}</span>
                      <span className="block text-quaternary font-mono">{formatMoney(m.volumeUsd)} vol</span>
                    </span>
                    {lead && (
                      <span className="shrink-0 text-right font-mono">
                        <span className="block text-tertiary truncate max-w-[110px]">{lead.label}</span>
                        <FlashValue value={lead.price} className="text-primary font-bold">{cents(lead.price)}</FlashValue>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        <WhaleTape tape={tape} error={whaleError} />
        <div className="lg:col-span-2">
          <CrowdedTradesPanel />
        </div>
      </div>
    </div>
  )
}
