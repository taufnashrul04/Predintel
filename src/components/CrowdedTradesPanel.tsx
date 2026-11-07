import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import { Panel } from './SharedUI'
import { VENUE_MAP } from '../lib/config/venues'
import { formatMoney, formatTimeAgo } from '../lib/formatters'
import { usePredictFlow } from '../lib/predictFlow'
import PredictFlowView from './PredictFlowView'
import CopySignals from './journal/CopySignals'
import { useJournal, usePaperSession } from '../lib/paperJournal'
import { useApp } from '../context/AppContext'

interface CrowdedTrade {
  eventId: string
  slug: string
  title: string
  outcomeId: string
  outcomeLabel: string
  side: 'buy' | 'sell'
  walletCount: number
  whaleCount: number
  followedCount: number
  avgCredibility: number | null
  tradeCount: number
  notional: number
  avgPrice: number | null
  venues: string[]
  lastTradeAt: string
  wallets: { address: string; label: string | null; isWhale: boolean }[]
}

const MIN_OPTIONS = [3, 4, 5]

export default function CrowdedTradesPanel() {
  const navigate = useNavigate()
  const [source, setSource] = useState<'onchain' | 'demo'>('onchain')
  const [min, setMin] = useState(3)
  const [groups, setGroups] = useState<CrowdedTrade[] | null>(null)
  const { flow, error: flowError } = usePredictFlow()
  const { showToast } = useApp()
  const { session } = usePaperSession()
  const { journal, paperBuy } = useJournal(session?.address)
  const [buying, setBuying] = useState<string | null>(null)

  // One-click paper trade from a suggestion; sizes use the journal's copy size.
  const paperFrom = async (key: string, order: { market: string; outcome: string }, label: string) => {
    if (!session) {
      showToast('Sign in on the Journal page to paper trade.')
      return navigate('/journal')
    }
    setBuying(key)
    try {
      const t = await paperBuy({ ...order, amount: journal.copySize }, { kind: 'dashboard', label })
      showToast(`Paper ${t.outcomeLabel}: ${t.shares} sh @ ${(t.entryPrice * 100).toFixed(1)}¢ added to your journal`)
    } catch (err: any) {
      showToast(`Paper trade failed: ${err.message}`)
    } finally {
      setBuying(null)
    }
  }

  useEffect(() => {
    setGroups(null)
    fetch(`/api/crowded?min=${min}`)
      .then(r => r.json())
      .then(d => setGroups(Array.isArray(d) ? d : []))
      .catch(() => setGroups([]))
  }, [min])

  return (
    <Panel
      title="Crowded trades"
      badge={source === 'onchain' ? 'DEEPBOOK PREDICT · ON-CHAIN' : 'TRACKED WALLETS · DEMO'}
      badgeVariant={source === 'onchain' ? 'success' : 'warning'}
      actions={
        <div className="flex items-center gap-sm">
          <div className="flex gap-xxs bg-secondary p-xxs rounded-lg border border-secondary" role="tablist" aria-label="Crowd source">
            {(['onchain', 'demo'] as const).map(src => (
              <button
                key={src}
                role="tab"
                aria-selected={source === src}
                onClick={() => setSource(src)}
                className={`px-sm py-xxs rounded text-[11px] font-bold whitespace-nowrap ${
                  source === src ? 'bg-brand-solid text-primary-on-brand' : 'text-quaternary hover:text-primary'
                }`}
              >
                {src === 'onchain' ? 'On-chain' : 'Demo'}
              </button>
            ))}
          </div>
          {source === 'demo' && (
        <label className="flex items-center gap-xs text-xs font-mono text-quaternary">
          Min wallets
          <select
            value={min}
            onChange={e => setMin(Number(e.target.value))}
            className="bg-secondary border border-secondary rounded px-xs py-xxs text-primary focus:outline-none"
          >
            {MIN_OPTIONS.map(n => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>
        </label>
          )}
        </div>
      }
      noPadding
    >
      {source === 'onchain' ? (
        <>
          <PredictFlowView
            flow={flow}
            error={flowError}
            paperSize={journal.copySize}
            buying={buying}
            onPaperBuy={(c, key) => paperFrom(key, { market: `dbp:${c.marketId}`, outcome: c.side }, `${c.accounts} on-chain traders`)}
          />
          <div className="px-md pb-md space-y-xs">
            <div className="text-quaternary uppercase text-[11px] font-semibold font-mono">Your copy signals</div>
            {session ? (
              <CopySignals address={session.address} limit={4} />
            ) : (
              <p className="text-xs text-tertiary">
                <button onClick={() => navigate('/journal')} className="text-brand-primary hover:underline">
                  Sign in on the Journal
                </button>{' '}
                to track wallets and copy their trades on paper.
              </p>
            )}
          </div>
        </>
      ) : groups === null ? (
        <div className="p-md grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-sm">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-36 rounded-lg pi-shimmer" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="p-xl text-center text-xs text-tertiary">No outcome has {min}+ tracked wallets on the same side right now.</p>
      ) : (
        <div className="p-md grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-sm">
          {groups.map(g => (
            <div
              key={`${g.eventId}-${g.outcomeId}-${g.side}`}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/markets/${g.slug}`)}
              onKeyDown={e => e.key === 'Enter' && navigate(`/markets/${g.slug}`)}
              className="pi-lift text-left p-sm rounded-lg border border-secondary bg-secondary hover:bg-secondary-hover transition-colors space-y-xs cursor-pointer"
            >
              <div className="flex items-center justify-between gap-sm">
                <span className="inline-flex items-center gap-xs text-sm font-bold text-primary font-mono">
                  <Users className="size-4 text-brand-primary" />
                  {g.walletCount} wallets
                </span>
                <span
                  className={`text-[11px] font-mono font-bold px-xs rounded ${
                    g.side === 'buy'
                      ? 'bg-utility-success-50 text-utility-success-700'
                      : 'bg-utility-error-50 text-utility-error-700'
                  }`}
                >
                  {g.side.toUpperCase()} {g.outcomeLabel}
                </span>
              </div>
              <div className="text-xs text-primary font-medium leading-snug line-clamp-2">{g.title}</div>
              <div className="flex flex-wrap gap-x-sm gap-y-xxs text-[11px] font-mono text-quaternary">
                <span className="text-primary font-bold">{formatMoney(g.notional)}</span>
                {g.avgPrice != null && <span>avg {(g.avgPrice * 100).toFixed(1)}¢</span>}
                {g.whaleCount > 0 && <span className="text-utility-brand-700">{g.whaleCount} whale{g.whaleCount > 1 ? 's' : ''}</span>}
                {g.followedCount > 0 && <span className="text-utility-warning-700">{g.followedCount} you follow</span>}
                {g.avgCredibility != null && <span>cred {g.avgCredibility}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-xxs">
                {g.wallets.map(w => (
                  <span
                    key={w.address}
                    onClick={e => {
                      e.stopPropagation()
                      navigate(`/wallets/${w.address}`)
                    }}
                    className="text-[10px] font-mono px-xs py-[1px] rounded bg-primary border border-secondary text-secondary hover:text-primary"
                  >
                    {w.label ?? `${w.address.slice(0, 6)}…`}
                  </span>
                ))}
                {g.walletCount > g.wallets.length && (
                  <span className="text-[10px] font-mono text-quaternary">+{g.walletCount - g.wallets.length}</span>
                )}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-quaternary">
                <span className="flex items-center gap-xxs">
                  {g.venues.map(v => (
                    <span
                      key={v}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: VENUE_MAP.get(v)?.color ?? '#888' }}
                      title={VENUE_MAP.get(v)?.name ?? v}
                    />
                  ))}
                  <span className="ml-xxs">{g.tradeCount} trades</span>
                </span>
                <span>last {formatTimeAgo(g.lastTradeAt)}</span>
              </div>
              {g.side === 'buy' && (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    paperFrom(`${g.eventId}-${g.outcomeId}`, { market: g.slug, outcome: g.outcomeId }, `${g.walletCount} tracked wallets (demo)`)
                  }}
                  disabled={buying === `${g.eventId}-${g.outcomeId}`}
                  className="w-full rounded bg-brand-solid px-sm py-xxs text-[11px] font-bold text-primary-on-brand hover:bg-brand-solid-hover disabled:opacity-50"
                >
                  {buying === `${g.eventId}-${g.outcomeId}` ? 'Placing…' : `Paper buy ${g.outcomeLabel} $${journal.copySize}`}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
