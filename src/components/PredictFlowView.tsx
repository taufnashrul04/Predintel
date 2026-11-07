import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, MoveHorizontal, ExternalLink } from 'lucide-react'
import { formatTimeAgo } from '../lib/formatters'
import { PredictFlow, PredictCrowd, shortId, usdFmt } from '../lib/predictFlow'

const SIDE_META = {
  up: { label: 'Up', icon: ArrowUpRight, tone: 'text-utility-success-700', bar: 'bg-utility-success-600' },
  down: { label: 'Down', icon: ArrowDownRight, tone: 'text-utility-error-700', bar: 'bg-utility-error-600' },
  range: { label: 'Range', icon: MoveHorizontal, tone: 'text-utility-brand-700', bar: 'bg-brand-solid' }
} as const

const strikeLabel = (c: Pick<PredictCrowd, 'side' | 'strike' | 'upper'>) =>
  c.strike == null
    ? ''
    : c.side === 'range' && c.upper
    ? `$${Math.round(c.strike).toLocaleString('en-US')}–$${Math.round(c.upper).toLocaleString('en-US')}`
    : `$${Math.round(c.strike).toLocaleString('en-US')}`

export default function PredictFlowView({
  flow,
  error,
  onPaperBuy,
  paperSize,
  buying
}: {
  flow: PredictFlow | null
  error: string | null
  onPaperBuy?: (crowd: PredictCrowd & { side: 'up' | 'down' }, key: string) => void
  paperSize?: number
  buying?: string | null
}) {
  const navigate = useNavigate()
  if (error && !flow) return <p className="p-xl text-center text-xs text-utility-error-700">Couldn't load on-chain flow: {error}</p>
  if (!flow) {
    return (
      <div className="p-md grid grid-cols-1 md:grid-cols-3 gap-sm">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-32 rounded-lg pi-shimmer" />
        ))}
      </div>
    )
  }

  const { totals } = flow
  const sides = (['up', 'down', 'range'] as const).map(k => ({ key: k, ...totals[k] }))
  const buyVolume = sides.reduce((s, x) => s + x.volume, 0) || 1
  const sameSide = flow.crowds.filter(c => c.accounts >= 2)
  const openWallet = (addr: string | null) => addr && navigate(`/wallets/${addr}`)

  return (
    <div className="p-md space-y-md text-xs font-mono">
      <div className="flex flex-wrap items-center gap-x-md gap-y-xxs text-quaternary">
        <span>
          <span className="text-primary font-bold">{totals.fills}</span> fills
        </span>
        <span>
          <span className="text-primary font-bold">{totals.traders}</span> traders
        </span>
        <span>
          <span className="text-primary font-bold">{usdFmt(totals.volume)}</span> volume
        </span>
        {flow.window.from && (
          <span>
            since {formatTimeAgo(flow.window.from)} · last fill {formatTimeAgo(flow.window.to!)}
          </span>
        )}
      </div>

      <div className="space-y-xs">
        <div className="flex h-2.5 rounded-full overflow-hidden bg-secondary">
          {sides.map(s => (
            <div key={s.key} className={SIDE_META[s.key].bar} style={{ width: `${(s.volume / buyVolume) * 100}%` }} title={SIDE_META[s.key].label} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-sm">
          {sides.map(s => {
            const M = SIDE_META[s.key]
            return (
              <div key={s.key} className="p-sm rounded-lg bg-secondary border border-secondary">
                <div className={`flex items-center gap-xxs font-bold ${M.tone}`}>
                  <M.icon className="size-3.5" /> {M.label}
                </div>
                <div className="text-primary font-bold text-sm">{usdFmt(s.volume)}</div>
                <div className="text-quaternary">
                  {s.accounts} trader{s.accounts === 1 ? '' : 's'} · {Math.round((s.volume / buyVolume) * 100)}%
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <div className="text-quaternary uppercase text-[11px] font-semibold mb-xs">Same window, same side (2+ traders)</div>
        {sameSide.length === 0 ? (
          <p className="text-tertiary font-sans">
            No BTC window had two or more traders on the same side in this period. Windows last 1–5 minutes, so overlaps are
            rare while few traders are active.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
            {sameSide.map(c => {
              const M = SIDE_META[c.side]
              return (
                <div key={`${c.marketId}-${c.side}`} className="p-sm rounded-lg border border-secondary bg-secondary space-y-xxs">
                  <div className="flex items-center justify-between">
                    <span className="text-primary font-bold">{c.accounts} traders</span>
                    <span className={`font-bold ${M.tone}`}>
                      {M.label} {strikeLabel(c)}
                    </span>
                  </div>
                  <div className="text-quaternary">
                    {usdFmt(c.volume)} · avg {c.avgProbability != null ? `${(c.avgProbability * 100).toFixed(1)}¢` : '—'}
                    {c.closesAt && ` · closed ${formatTimeAgo(c.closesAt)}`}
                  </div>
                  {onPaperBuy && c.side !== 'range' && c.closesAt && Date.parse(c.closesAt) > Date.now() + 20_000 && (
                    <button
                      onClick={() => onPaperBuy(c as PredictCrowd & { side: 'up' | 'down' }, `${c.marketId}-${c.side}`)}
                      disabled={buying === `${c.marketId}-${c.side}`}
                      className="w-full rounded bg-brand-solid px-sm py-xxs text-[11px] font-bold text-primary-on-brand disabled:opacity-50"
                    >
                      Paper buy {M.label} ${paperSize}
                    </button>
                  )}
                  <div className="flex flex-wrap gap-xxs">
                    {c.owners.map((o, i) => (
                      <button
                        key={c.accountIds[i]}
                        onClick={() => openWallet(o)}
                        disabled={!o}
                        className="text-[10px] px-xs rounded bg-primary border border-secondary text-secondary hover:text-primary disabled:opacity-60"
                      >
                        {o ? shortId(o) : shortId(c.accountIds[i])}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <div className="text-quaternary uppercase text-[11px] font-semibold mb-xs">Most active traders</div>
        <div className="border border-secondary rounded-lg divide-y divide-secondary">
          {flow.traders.slice(0, 6).map(t => {
            const bias = t.up === t.down ? 'Mixed' : t.up > t.down ? 'Leans Up' : 'Leans Down'
            return (
              <button
                key={t.accountId}
                onClick={() => openWallet(t.owner)}
                disabled={!t.owner}
                className="w-full flex flex-wrap items-center justify-between gap-sm px-sm py-xs text-left hover:bg-secondary-hover disabled:cursor-default"
              >
                <span className="text-primary">
                  {t.owner ? shortId(t.owner) : <span className="text-quaternary">account {shortId(t.accountId)}</span>}
                </span>
                <span className="flex items-center gap-sm text-quaternary">
                  <span className="text-primary font-bold">{usdFmt(t.volume)}</span>
                  <span>{t.fills} fills</span>
                  <span className={t.up > t.down ? 'text-utility-success-700' : t.down > t.up ? 'text-utility-error-700' : ''}>{bias}</span>
                  <span className="w-14 text-right">{formatTimeAgo(t.lastAt)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-[10px] text-quaternary font-sans flex flex-wrap items-center gap-xs">
        {flow.source}. Owners mapped from on-chain account events ({flow.ownersResolved.toLocaleString('en-US')} accounts scanned).
        <a
          href={`https://suiscan.xyz/mainnet/tx/${flow.fills[0]?.digest ?? ''}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-xxs text-brand-primary hover:underline"
        >
          Latest fill <ExternalLink className="size-3" />
        </a>
      </p>
    </div>
  )
}
