import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, X } from 'lucide-react'
import { formatTimeAgo } from '../../lib/formatters'
import { PredictFill, usePredictFlow } from '../../lib/predictFlow'
import { useJournal } from '../../lib/paperJournal'
import { useApp } from '../../context/AppContext'
import { PolymarketSignal, isPolygonAddress, usePolymarketSignals } from '../../lib/polymarketCopy'

// Copy needs room to price and land before the DeepBook window's no-trade cutoff.
const MIN_LEFT_MS = 20_000
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(t)
  }, [ms])
  return now
}

// Buys by wallets this journal tracks: real DeepBook Predict fills on Sui, and Polymarket buys that
// copy onto the matching WaterX market.
export default function CopySignals({ limit = 8 }: { limit?: number }) {
  const navigate = useNavigate()
  const { showToast } = useApp()
  const { flow, error } = usePredictFlow(15_000)
  const { journal, paperBuy, dismiss } = useJournal()
  const [busy, setBusy] = useState<string | null>(null)
  const now = useNow()

  const tracked = new Map(journal.tracked.map(w => [w.address.toLowerCase(), w]))
  const copied = new Set(journal.trades.flatMap(t => (t.source.kind === 'copy' ? [t.source.fillDigest] : [])))
  const dismissed = new Set(journal.dismissed)
  const pmWallets = journal.tracked.map(w => w.address).filter(isPolygonAddress)
  const suiTracked = journal.tracked.length - pmWallets.length
  const { signals: pmRaw, error: pmError } = usePolymarketSignals(pmWallets)

  const dbSignals = (flow?.fills ?? []).filter(
    f => f.owner && tracked.has(f.owner.toLowerCase()) && f.action === 'buy' && !dismissed.has(f.digest)
  )
  // Only buys WaterX can mirror are actionable; the rest are summarized in one line.
  const pmOpen = (pmRaw ?? []).filter(s => !dismissed.has(s.id))
  const pmSignals = pmOpen.filter(s => s.sui.market || copied.has(s.id))
  const pmSkipped = pmOpen.length - pmSignals.length

  const run = async (id: string, order: { market: string; outcome: string }, wallet: string, venue: string) => {
    setBusy(id)
    try {
      const trade = await paperBuy({ ...order, amount: journal.copySize }, { kind: 'copy', wallet, fillDigest: id })
      showToast(`Copied${venue}: paper ${trade.outcomeLabel} ${trade.shares} sh @ ${(trade.entryPrice * 100).toFixed(1)}¢`)
    } catch (err: any) {
      showToast(`Couldn't copy: ${err.message}`)
    } finally {
      setBusy(null)
    }
  }

  if (journal.tracked.length === 0) {
    return (
      <p className="text-xs text-tertiary">
        Track a wallet to get copy signals.{' '}
        <button onClick={() => navigate('/wallets')} className="text-brand-primary hover:underline">
          Pick one from the traders list
        </button>
        .
      </p>
    )
  }

  const copyButton = (id: string, onClick: () => void) => (
    <button
      onClick={onClick}
      disabled={busy === id}
      className="inline-flex items-center gap-xxs rounded bg-brand-solid px-sm py-xxs font-sans font-bold text-primary-on-brand disabled:opacity-50"
    >
      <Copy className="size-3" /> {busy === id ? 'Copying…' : `Copy $${journal.copySize}`}
    </button>
  )

  const dismissButton = (id: string) => (
    <button onClick={() => dismiss(id)} aria-label="Dismiss signal" className="p-xxs text-quaternary hover:text-primary">
      <X className="size-3.5" />
    </button>
  )

  const deepbookRow = (f: PredictFill) => {
    const wallet = tracked.get(f.owner!.toLowerCase())!
    const left = f.closesAt ? Date.parse(f.closesAt) - now : 0
    const copyable = (f.side === 'up' || f.side === 'down') && left > MIN_LEFT_MS
    const strike = f.strike != null ? `$${Math.round(f.strike).toLocaleString('en-US')}` : ''
    return (
      <div key={f.digest} className="flex flex-wrap items-center justify-between gap-sm px-sm py-xs text-xs font-mono">
        <div className="min-w-0">
          <div className="text-primary">
            <span className="font-sans font-semibold">{wallet.label}</span> bought{' '}
            <span className={f.side === 'up' ? 'text-utility-success-700' : f.side === 'down' ? 'text-utility-error-700' : 'text-utility-brand-700'}>
              {f.side === 'range' ? `range ${strike}–$${Math.round(f.upper ?? 0).toLocaleString('en-US')}` : `${f.side?.toUpperCase()} ${strike}`}
            </span>{' '}
            ${f.cost.toFixed(2)} @ {f.probability != null ? `${(f.probability * 100).toFixed(1)}¢` : '—'}
          </div>
          <div className="text-[10px] text-quaternary">
            DeepBook Predict · BTC window · {formatTimeAgo(f.at)}
            {left > 0 ? ` · closes in ${Math.ceil(left / 1000)}s` : ' · window closed'}
          </div>
        </div>
        <div className="flex items-center gap-xs">
          {copied.has(f.digest) ? (
            <span className="text-utility-success-700 font-sans">Copied</span>
          ) : copyable ? (
            copyButton(f.digest, () => run(f.digest, { market: `dbp:${f.marketId}`, outcome: f.side as string }, f.owner!, ''))
          ) : (
            <span className="text-quaternary font-sans">{f.side === 'range' ? 'Range: not copyable' : 'Too late to copy'}</span>
          )}
          {dismissButton(f.digest)}
        </div>
      </div>
    )
  }

  const polymarketRow = (s: PolymarketSignal) => {
    const wallet = tracked.get(s.wallet.toLowerCase())
    return (
      <div key={s.id} className="flex flex-wrap items-center justify-between gap-sm px-sm py-xs text-xs font-mono">
        <div className="min-w-0">
          <div className="text-primary">
            <span className="font-sans font-semibold">{wallet?.label ?? short(s.wallet)}</span> bought{' '}
            <span className="text-utility-brand-700">{s.outcome}</span> ${s.notional.toLocaleString('en-US', { maximumFractionDigits: s.notional < 10 ? 2 : 0 })} @{' '}
            {(s.price * 100).toFixed(1)}¢
          </div>
          <div className="text-[10px] text-quaternary truncate max-w-[440px]" title={s.market}>
            Polymarket · {s.market} · {formatTimeAgo(s.at)}
            {s.sui.market ? ` · copies to WaterX: ${s.sui.label}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-xs">
          {copied.has(s.id) ? (
            <span className="text-utility-success-700 font-sans">Copied</span>
          ) : s.sui.market && s.sui.outcome ? (
            copyButton(s.id, () => run(s.id, { market: s.sui.market!, outcome: s.sui.outcome! }, s.wallet, ' on WaterX'))
          ) : (
            <span className="text-quaternary font-sans">{s.sui.reason ?? 'Not on WaterX'}</span>
          )}
          {dismissButton(s.id)}
        </div>
      </div>
    )
  }

  const rows = [
    ...dbSignals.map(f => ({ at: f.at, node: deepbookRow(f) })),
    ...pmSignals.map(s => ({ at: s.at, node: polymarketRow(s) }))
  ].sort((x, y) => y.at.localeCompare(x.at))

  const failures = [
    suiTracked > 0 && error && !flow ? `DeepBook Predict: ${error}` : null,
    pmWallets.length > 0 && pmError && !pmRaw ? `Polymarket: ${pmError}` : null
  ].filter(Boolean)
  const loading = (suiTracked > 0 && !flow && !error) || (pmWallets.length > 0 && !pmRaw && !pmError)

  const skippedNote = pmSkipped > 0 && (
    <p className="text-[10px] text-quaternary">
      {pmSkipped} other Polymarket buy{pmSkipped > 1 ? 's' : ''} in the last 24h {pmSkipped > 1 ? 'have' : 'has'} no matching WaterX market
      (spreads, totals, NO bets), so {pmSkipped > 1 ? "they can't" : "it can't"} be copied on Sui.
    </p>
  )

  if (rows.length === 0) {
    if (failures.length > 0) return <p className="text-xs text-utility-error-700">Couldn't load copy signals. {failures.join(' · ')}</p>
    if (loading) return <div className="h-16 rounded pi-shimmer" />
    return (
      <div className="space-y-xs">
        <p className="text-xs text-tertiary">
          No copyable buys from your {journal.tracked.length} tracked wallet{journal.tracked.length > 1 ? 's' : ''} right now. New ones show up
          here within about 30 seconds.
        </p>
        {skippedNote}
      </div>
    )
  }

  return (
    <div className="space-y-xs">
      <div className="divide-y divide-secondary border border-secondary rounded-lg">{rows.slice(0, limit).map(r => r.node)}</div>
      {skippedNote}
    </div>
  )
}
