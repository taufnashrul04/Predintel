import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, X } from 'lucide-react'
import { formatTimeAgo } from '../../lib/formatters'
import { PredictFill, usePredictFlow } from '../../lib/predictFlow'
import { useJournal } from '../../lib/paperJournal'
import { useApp } from '../../context/AppContext'

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

// Buys by wallets this journal tracks, from real DeepBook Predict fills.
export default function CopySignals({ address, limit = 8 }: { address: string; limit?: number }) {
  const navigate = useNavigate()
  const { showToast } = useApp()
  const { flow, error } = usePredictFlow(15_000)
  const { journal, paperBuy, dismiss } = useJournal(address)
  const [busy, setBusy] = useState<string | null>(null)
  const now = useNow()

  const tracked = new Map(journal.tracked.map(w => [w.address.toLowerCase(), w]))
  const copied = new Set(journal.trades.flatMap(t => (t.source.kind === 'copy' ? [t.source.fillDigest] : [])))
  const dismissed = new Set(journal.dismissed)

  const signals = (flow?.fills ?? []).filter(
    f => f.owner && tracked.has(f.owner.toLowerCase()) && f.action === 'buy' && !dismissed.has(f.digest)
  )

  const copy = async (f: PredictFill) => {
    setBusy(f.digest)
    try {
      const trade = await paperBuy(
        { market: `dbp:${f.marketId}`, outcome: f.side as string, amount: journal.copySize },
        { kind: 'copy', wallet: f.owner!, fillDigest: f.digest }
      )
      showToast(`Copied: paper ${trade.outcomeLabel} ${trade.shares} sh @ ${(trade.entryPrice * 100).toFixed(1)}¢`)
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
        <button onClick={() => navigate('/wallets?view=onchain')} className="text-brand-primary hover:underline">
          Pick one from on-chain traders
        </button>
        .
      </p>
    )
  }
  if (error && !flow) return <p className="text-xs text-utility-error-700">Couldn't load on-chain fills: {error}</p>
  if (!flow) return <div className="h-16 rounded bg-secondary animate-pulse" />
  if (signals.length === 0) {
    return (
      <p className="text-xs text-tertiary">
        No recent DeepBook Predict buys from your {journal.tracked.length} tracked wallet{journal.tracked.length > 1 ? 's' : ''}. New ones
        show up here within about 30 seconds.
      </p>
    )
  }

  return (
    <div className="divide-y divide-secondary border border-secondary rounded-lg">
      {signals.slice(0, limit).map(f => {
        const wallet = tracked.get(f.owner!.toLowerCase())!
        const left = f.closesAt ? Date.parse(f.closesAt) - now : 0
        const copyable = (f.side === 'up' || f.side === 'down') && left > MIN_LEFT_MS
        const done = copied.has(f.digest)
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
                BTC window · {formatTimeAgo(f.at)}
                {left > 0 ? ` · closes in ${Math.ceil(left / 1000)}s` : ' · window closed'}
              </div>
            </div>
            <div className="flex items-center gap-xs">
              {done ? (
                <span className="text-utility-success-700 font-sans">Copied</span>
              ) : copyable ? (
                <button
                  onClick={() => copy(f)}
                  disabled={busy === f.digest}
                  className="inline-flex items-center gap-xxs rounded bg-brand-solid px-sm py-xxs font-sans font-bold text-primary-on-brand disabled:opacity-50"
                >
                  <Copy className="size-3" /> {busy === f.digest ? 'Copying…' : `Copy $${journal.copySize}`}
                </button>
              ) : (
                <span className="text-quaternary font-sans">{f.side === 'range' ? 'Range: not copyable' : 'Too late to copy'}</span>
              )}
              <button onClick={() => dismiss(f.digest)} aria-label="Dismiss signal" className="p-xxs text-quaternary hover:text-primary">
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
