import React, { useState } from 'react'
import { FlashValue } from '../components/motion'
import { useNavigate } from 'react-router-dom'
import { Trash2, Plus, ExternalLink } from 'lucide-react'
import { Panel, StatCard, VenuePill } from '../components/SharedUI'
import CopySignals from '../components/journal/CopySignals'
import { VENUE_MAP } from '../lib/config/venues'
import { formatTimeAgo } from '../lib/formatters'
import { parseSuiAddress } from '../lib/myWallets'
import { isPolygonAddress, polymarketProfile } from '../lib/polymarketCopy'
import { PaperTrade, usePaperMarks, useJournal } from '../lib/paperJournal'
import { useApp } from '../context/AppContext'

const th = 'py-xs px-sm'
const td = 'py-sm px-sm'
const cents = (p: number | null | undefined) => (p == null ? '—' : `${(p * 100).toFixed(1)}¢`)
const usd = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pnlTone = (n: number) => (n > 0 ? 'text-utility-success-700' : n < 0 ? 'text-utility-error-700' : 'text-primary')
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

function sourceLabel(t: PaperTrade, labels: Map<string, string>) {
  if (t.source.kind === 'copy') return `Copy · ${labels.get(t.source.wallet.toLowerCase()) ?? short(t.source.wallet)}`
  if (t.source.kind === 'dashboard') return `Dashboard · ${t.source.label}`
  return 'Trade tab'
}

function Venue({ id }: { id: string }) {
  const v = VENUE_MAP.get(id)
  return <VenuePill name={v?.name ?? id} color={v?.color ?? '#888'} />
}

function JournalWorkspace() {
  const navigate = useNavigate()
  const { showToast } = useApp()
  const { journal, closeTrade, applySettlements, removeTrade, track, untrack, setCopySize } = useJournal()
  const marks = usePaperMarks(journal.trades, applySettlements)
  const [walletInput, setWalletInput] = useState('')
  const [labelInput, setLabelInput] = useState('')
  const [trackError, setTrackError] = useState<string | null>(null)
  const [closing, setClosing] = useState<string | null>(null)

  const open = journal.trades.filter(t => t.status === 'open')
  const done = journal.trades.filter(t => t.status !== 'open')
  const unrealized = open.reduce((s, t) => {
    const m = marks[t.id]?.mark
    return m == null ? s : s + (m * t.shares - t.cost)
  }, 0)
  const realized = done.reduce((s, t) => s + (t.realizedPnl ?? 0), 0)
  const wins = done.filter(t => (t.realizedPnl ?? 0) > 0).length
  const labels = new Map(journal.tracked.map(w => [w.address.toLowerCase(), w.label]))

  const settled = done.filter(t => t.status === 'settled')
  const buckets = [0, 0.2, 0.4, 0.6, 0.8].map(lo => {
    const inBucket = settled.filter(t => t.entryPrice >= lo && t.entryPrice < lo + 0.2)
    const won = inBucket.filter(t => t.exitPrice === 1).length
    return { lo, n: inBucket.length, hit: inBucket.length ? won / inBucket.length : null }
  })

  const marketLink = (t: PaperTrade) =>
    navigate(t.live ? `/trade?market=${encodeURIComponent(t.market)}&outcome=${t.outcomeId}` : `/trade?market=${t.market}&outcome=${t.outcomeId}`)

  const close = async (t: PaperTrade) => {
    setClosing(t.id)
    try {
      await closeTrade(t.id)
      showToast('Paper position closed at the live bid')
    } catch (err: any) {
      showToast(err.message)
    } finally {
      setClosing(null)
    }
  }

  const addTracked = (e: React.FormEvent) => {
    e.preventDefault()
    const raw = walletInput.trim()
    const wallet = isPolygonAddress(raw) ? raw.toLowerCase() : parseSuiAddress(raw)
    if (!wallet) return setTrackError('Enter a Sui address or a Polymarket (Polygon) wallet.')
    if (journal.tracked.some(w => w.address === wallet)) return setTrackError('Already tracked.')
    track(wallet, labelInput)
    setWalletInput('')
    setLabelInput('')
    setTrackError(null)
    showToast('Wallet tracked for copy signals')
  }

  return (
    <div className="space-y-md">
      <Panel title="Paper journal" badge="PAPER · NO REAL FUNDS" badgeVariant="warning">
        <div className="space-y-sm">
          <p className="text-xs text-tertiary">
            Every paper trade is priced at the live venue price when you place it, then marked live. DeepBook Predict windows settle on-chain
            within minutes, so their results are real. Your journal is saved in this browser; no wallet needed.
          </p>
        </div>
      </Panel>

      {(
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-sm">
            <StatCard label="Open positions" value={open.length} subtext={`${usd(open.reduce((s, t) => s + t.cost, 0))} at cost`} />
            <StatCard label="Unrealized PnL" value={usd(unrealized)} changePositive={unrealized >= 0} subtext="at live bid" />
            <StatCard label="Realized PnL" value={usd(realized)} changePositive={realized >= 0} subtext={`${done.length} closed`} />
            <StatCard label="Win rate" value={done.length ? `${Math.round((wins / done.length) * 100)}%` : '—'} subtext={`${wins} of ${done.length}`} />
            <StatCard label="Tracked wallets" value={journal.tracked.length} subtext="copy signals" />
          </div>

          <Panel title="Open paper positions" badge={`${open.length}`} noPadding>
            <div className="overflow-x-auto">
              {open.length === 0 ? (
                <p className="p-xl text-center text-xs text-tertiary">
                  No open positions. Place a paper order on the{' '}
                  <button onClick={() => navigate('/trade')} className="text-brand-primary hover:underline">
                    Trade tab
                  </button>
                  , from a Dashboard suggestion, or copy a tracked wallet below.
                </p>
              ) : (
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                      <th className={th}>Market</th>
                      <th className={th}>Outcome</th>
                      <th className={th}>Venue</th>
                      <th className={th}>Source</th>
                      <th className={th}>Entry</th>
                      <th className={th}>Mark</th>
                      <th className={th}>Shares</th>
                      <th className={th}>Unrealized</th>
                      <th className={`${th} text-right`}>Close</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary">
                    {open.map(t => {
                      const m = marks[t.id]
                      const pnl = m?.mark != null ? m.mark * t.shares - t.cost : null
                      return (
                        <tr key={t.id} className="hover:bg-secondary-hover">
                          <td className={`${td} font-sans font-medium text-primary`}>
                            <button onClick={() => marketLink(t)} className="text-left hover:underline">
                              {t.marketTitle}
                            </button>
                            {!t.live && <span className="ml-xs text-[10px] px-xs rounded bg-secondary text-quaternary font-mono">DEMO</span>}
                            {t.expiresAt && <div className="text-[10px] text-quaternary font-mono">closes {new Date(t.expiresAt).toISOString().slice(0, 16).replace('T', ' ')} UTC</div>}
                          </td>
                          <td className={`${td} font-bold`}>{t.outcomeLabel}</td>
                          <td className={td}><Venue id={t.venueId} /></td>
                          <td className={`${td} text-tertiary`}>{sourceLabel(t, labels)}</td>
                          <td className={td}>{cents(t.entryPrice)}</td>
                          <td className={td}>
                            {m?.status === 'awaiting' ? <span className="text-utility-warning-700">settling…</span> : <FlashValue value={m?.mark}>{cents(m?.mark)}</FlashValue>}
                          </td>
                          <td className={td}>{t.shares.toLocaleString('en-US')}</td>
                          <td className={`${td} font-bold ${pnl == null ? 'text-quaternary' : pnlTone(pnl)}`}>{pnl == null ? '—' : usd(pnl)}</td>
                          <td className={`${td} text-right`}>
                            <button
                              onClick={() => close(t)}
                              disabled={closing === t.id || m?.status === 'awaiting'}
                              className="px-sm py-xxs rounded bg-secondary hover:bg-utility-error-50 hover:text-utility-error-700 font-bold disabled:opacity-50"
                            >
                              {closing === t.id ? '…' : 'Close'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
            <Panel title="Copy trading" badge="DEEPBOOK PREDICT · POLYMARKET → WATERX" badgeVariant="success">
              <div className="space-y-md">
                <form onSubmit={addTracked} className="flex flex-col sm:flex-row gap-xs">
                  <input
                    value={walletInput}
                    onChange={e => {
                      setWalletInput(e.target.value)
                      setTrackError(null)
                    }}
                    placeholder="Sui or Polymarket wallet 0x…"
                    aria-label="Wallet address to track"
                    className="flex-1 min-w-0 bg-secondary border border-secondary rounded-md px-sm py-xs text-xs font-mono text-primary placeholder:text-placeholder focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  />
                  <input
                    value={labelInput}
                    onChange={e => setLabelInput(e.target.value)}
                    placeholder="Label"
                    aria-label="Label"
                    maxLength={40}
                    className="sm:w-32 bg-secondary border border-secondary rounded-md px-sm py-xs text-xs text-primary placeholder:text-placeholder focus:outline-none"
                  />
                  <button type="submit" className="inline-flex items-center justify-center gap-xxs rounded-lg bg-brand-solid px-md py-xs text-xs font-bold text-primary-on-brand">
                    <Plus className="size-3.5" /> Track
                  </button>
                </form>
                {trackError && <p className="text-xs text-utility-error-700">{trackError}</p>}

                {journal.tracked.length > 0 && (
                  <div className="flex flex-wrap gap-xs">
                    {journal.tracked.map(w => (
                      <span key={w.address} className="inline-flex items-center gap-xs rounded-lg border border-secondary bg-secondary px-sm py-xxs text-xs">
                        <button
                          onClick={() => (isPolygonAddress(w.address) ? window.open(polymarketProfile(w.address), '_blank', 'noopener') : navigate(`/wallets/${w.address}`))}
                          className="text-primary hover:underline"
                        >
                          {w.label}
                        </button>
                        <button onClick={() => untrack(w.address)} aria-label={`Stop tracking ${w.label}`} className="text-quaternary hover:text-utility-error-700">
                          <Trash2 className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <label className="flex items-center gap-sm text-xs text-secondary">
                  Copy size (USDC)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={journal.copySize}
                    onChange={e => setCopySize(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))}
                    className="w-24 bg-secondary border border-secondary rounded-md px-sm py-xxs font-mono text-primary focus:outline-none"
                  />
                </label>

                <CopySignals />
                <p className="text-[10px] text-quaternary">
                  DeepBook Predict copies take the same BTC window and direction. Polymarket copies land on the same WaterX market (sport
                  winners, crypto up/down rounds, YES on binary questions). Every copy is a paper trade priced live on Sui.
                </p>
              </div>
            </Panel>

            <Panel title="Calibration" badge="SETTLED ONLY">
              {settled.length === 0 ? (
                <p className="text-xs text-tertiary">
                  Calibration fills in as DeepBook Predict windows you hold settle: it compares your entry price with how often those positions won.
                </p>
              ) : (
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-quaternary uppercase text-[11px]">
                      <th className="py-xxs">Entry price</th>
                      <th className="py-xxs">Settled</th>
                      <th className="py-xxs">Won</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buckets.map(b => (
                      <tr key={b.lo} className="border-t border-secondary">
                        <td className="py-xxs">{Math.round(b.lo * 100)}–{Math.round((b.lo + 0.2) * 100)}¢</td>
                        <td className="py-xxs">{b.n}</td>
                        <td className={`py-xxs ${b.hit == null ? 'text-quaternary' : b.hit >= b.lo + 0.1 ? 'text-utility-success-700' : 'text-utility-error-700'}`}>
                          {b.hit == null ? '—' : `${Math.round(b.hit * 100)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          <Panel title="Closed & settled" badge={`${done.length}`} noPadding>
            <div className="overflow-x-auto">
              {done.length === 0 ? (
                <p className="p-xl text-center text-xs text-tertiary">Closed and settled paper trades show up here.</p>
              ) : (
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                      <th className={th}>Market</th>
                      <th className={th}>Outcome</th>
                      <th className={th}>Source</th>
                      <th className={th}>Entry</th>
                      <th className={th}>Exit</th>
                      <th className={th}>Result</th>
                      <th className={th}>PnL</th>
                      <th className={th}>When</th>
                      <th className={`${th} text-right`}>Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary">
                    {done.map(t => (
                      <tr key={t.id} className="hover:bg-secondary-hover">
                        <td className={`${td} font-sans font-medium text-primary`}>{t.marketTitle}</td>
                        <td className={`${td} font-bold`}>{t.outcomeLabel}</td>
                        <td className={`${td} text-tertiary`}>{sourceLabel(t, labels)}</td>
                        <td className={td}>{cents(t.entryPrice)}</td>
                        <td className={td}>{cents(t.exitPrice)}</td>
                        <td className={td}>
                          {t.status === 'settled' ? (
                            <span className={t.exitPrice === 1 ? 'text-utility-success-700' : 'text-utility-error-700'}>
                              {t.exitPrice === 1 ? 'Won' : 'Lost'}
                              {t.settlementPrice != null && <span className="text-quaternary"> · BTC ${t.settlementPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>}
                            </span>
                          ) : (
                            <span className="text-tertiary">Closed early</span>
                          )}
                        </td>
                        <td className={`${td} font-bold ${pnlTone(t.realizedPnl ?? 0)}`}>{usd(t.realizedPnl ?? 0)}</td>
                        <td className={`${td} text-quaternary`}>{t.closedAt ? formatTimeAgo(t.closedAt) : '—'}</td>
                        <td className={`${td} text-right`}>
                          <button onClick={() => removeTrade(t.id)} aria-label="Remove from journal" className="p-xxs text-quaternary hover:text-utility-error-700">
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Panel>

          <p className="text-[10px] text-quaternary flex items-center gap-xs">
            Paper trades never touch your wallet's funds.
            <a href="https://docs.sui.io/onchain-finance/deepbook-predict/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-xxs text-brand-primary hover:underline">
              How DeepBook Predict settles <ExternalLink className="size-3" />
            </a>
          </p>
        </>
      )}
    </div>
  )
}

export default function PickJournalPage() {
  return (
    <JournalWorkspace />
  )
}
