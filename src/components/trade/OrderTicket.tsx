import React, { useEffect, useRef, useState } from 'react'
import { FlashValue } from '../motion'
import { Zap, PenLine, AlertCircle } from 'lucide-react'
import { Panel } from '../SharedUI'
import { useApp } from '../../context/AppContext'
import { useJournal } from '../../lib/paperJournal'
import { executeVaultOrder, useVault } from '../../lib/agentVault'
import {
  AgentWallet,
  ExecutionStatus,
  TicketState,
  TradeQuote,
  apiJson,
  cents,
  postJson,
  shortAddr,
  usd
} from './types'

interface Props {
  market: { id: string; slug: string; title: string }
  outcomeId: string
  outcomeLabel: string
  ticket: TicketState
  setTicket: React.Dispatch<React.SetStateAction<TicketState>>
  onExecuted?: () => void
  live?: boolean
  priceVersion?: string
}

const segment = (active: boolean) =>
  `py-xs rounded text-xs font-bold transition-colors ${
    active ? 'bg-brand-solid text-primary-on-brand shadow-xs' : 'text-quaternary hover:text-primary'
  }`

function PreviewRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-utility-success-700' : tone === 'bad' ? 'text-utility-error-700' : 'text-primary'
  return (
    <div className="flex items-center justify-between text-quaternary">
      <span>{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  )
}

export default function OrderTicket({ market, outcomeId, outcomeLabel, ticket, setTicket, onExecuted, live, priceVersion }: Props) {
  const { showToast } = useApp()
  const { journal, paperBuy, closeTrade } = useJournal()
  // Paper positions this ticket can close: same market and outcome, still open.
  const paperOpen = journal.trades.filter(t => t.status === 'open' && t.market === market.id && t.outcomeId === outcomeId)
  const isPaper = ticket.mode === 'direct'
  const vault = useVault()
  // Vault shares on this outcome, for agent sells; the backend can't see browser-held positions.
  const vaultHeld = vault.positions.filter(p => p.market === market.id && p.outcomeId === outcomeId)
  const vaultVenue = vaultHeld[0]?.venueId
  const vaultShares = vaultHeld.filter(p => p.venueId === vaultVenue).reduce((s, p) => s + p.shares, 0)

  const [quote, setQuote] = useState<TradeQuote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [execution, setExecution] = useState<ExecutionStatus | null>(null)

  const update = (patch: Partial<TicketState>) => setTicket(t => ({ ...t, ...patch }))
  const busy = execution?.status === 'building' || execution?.status === 'signing' || execution?.status === 'pending'

  useEffect(() => {
    const amount = Number(ticket.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setQuote(null)
      setQuoteError('Enter an amount greater than 0.')
      return
    }
    const params = new URLSearchParams({
      market: market.id,
      outcome: outcomeId,
      side: ticket.side,
      amount: String(amount),
      type: ticket.type,
      split: String(ticket.split),
      mode: ticket.mode
    })
    if (ticket.type === 'limit') params.set('limitPrice', ticket.limitPrice)
    if (ticket.mode === 'agent') {
      params.set('allowed', vault.rules.allowedVenues.join(','))
      if (ticket.side === 'sell') {
        params.set('held', String(vaultShares))
        if (vaultVenue) params.set('venue', vaultVenue)
      }
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setQuoteLoading(true)
      apiJson<TradeQuote>(`/api/trade/quote?${params}`, { signal: controller.signal })
        .then(q => {
          if (!Array.isArray(q?.legs) || !Array.isArray(q?.routes)) throw new Error('Unexpected quote response. Try again.')
          setQuote(q)
          setQuoteError(null)
        })
        .catch(err => {
          if (err.name === 'AbortError') return
          setQuote(null)
          setQuoteError(err.message)
        })
        .finally(() => setQuoteLoading(false))
    }, 250)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [market.id, outcomeId, ticket.side, ticket.type, ticket.amount, ticket.limitPrice, ticket.split, ticket.mode, priceVersion, vault.rules.allowedVenues.join(','), vaultShares, vaultVenue])

  const legsLabel = quote?.legs?.map(l => l.venueName).join(' + ') || quote?.bestExecutableRoute?.venueName || ''

  const agentLimits = {
    dailyLeft: Math.max(0, vault.rules.dailyBudget - vault.spentToday),
    maxPerTrade: vault.rules.maxPerTrade,
    balance: vault.balanceUSDC
  }
  const agentWarning = (() => {
    if (ticket.mode !== 'agent' || !agentLimits || !quote) return null
    const amount = Number(ticket.amount)
    if (amount > agentLimits.maxPerTrade) return `Above the agent's max per trade (${usd(agentLimits.maxPerTrade)}).`
    if (ticket.side === 'buy' && amount > agentLimits.balance) return `Vault only holds ${usd(agentLimits.balance)} — deposit first.`
    if (ticket.side === 'buy' && amount > agentLimits.dailyLeft) return `Only ${usd(agentLimits.dailyLeft)} of today's budget left.`
    if (quote.slippagePct > vault.rules.maxSlippagePct) return `Slippage ${quote.slippagePct}% is above the agent limit.`
    return null
  })()

  const maxAmount = (() => {
    if (ticket.side === 'sell' && quote?.heldShares) return Math.floor(quote.heldShares * (quote.bestRoute.topPrice ?? quote.avgFillPrice))
    if (ticket.mode === 'agent' && agentLimits) return Math.floor(Math.min(agentLimits.balance, agentLimits.maxPerTrade, agentLimits.dailyLeft))
    return null
  })()

  const execute = async () => {
    if (!quote && !paperClosing) return
    setConfirmOpen(false)
    const order = {
      market: market.id,
      outcome: outcomeId,
      side: ticket.side,
      amount: Number(ticket.amount),
      type: ticket.type,
      limitPrice: ticket.type === 'limit' ? Number(ticket.limitPrice) : undefined,
      split: ticket.split
    }
    const base = { mode: ticket.mode, venues: legsLabel, amount: order.amount, shares: quote?.totalShares ?? 0 }

    try {
      if (ticket.mode === 'agent') {
        setExecution({ ...base, status: 'pending' })
        const q = await executeVaultOrder(order)
        setExecution({ ...base, shares: q.totalShares, status: 'confirmed', simulated: true })
        showToast(
          q.totalShares > 0
            ? `Agent ${q.side} ${q.outcomeLabel}: ${q.totalShares} sh @ ${(q.avgFillPrice * 100).toFixed(1)}¢ (simulated)`
            : `Agent limit order resting at ${(q.limitPrice * 100).toFixed(1)}¢`
        )
        onExecuted?.()
        return
      }

      setExecution({ ...base, status: 'pending' })
      if (ticket.side === 'sell') {
        for (const t of paperOpen) await closeTrade(t.id)
        setExecution({ ...base, status: 'confirmed', simulated: true })
        showToast(`Closed ${paperOpen.length} paper position${paperOpen.length > 1 ? 's' : ''} at the live bid`)
        return
      }
      const trade = await paperBuy({ market: market.id, outcome: outcomeId, amount: order.amount }, { kind: 'trade' })
      setExecution({ ...base, venues: legsLabel, shares: trade.shares, status: 'confirmed', ref: trade.id, simulated: true })
      showToast(`Paper ${trade.outcomeLabel}: ${trade.shares} sh @ ${(trade.entryPrice * 100).toFixed(1)}¢ added to your journal`)
    } catch (err: any) {
      const reason = /reject|denied|cancel/i.test(err?.message ?? '') ? 'You declined the signature in your wallet.' : err?.message
      setExecution({ ...base, status: 'failed', reason })
      showToast(`Order failed: ${reason}`)
    }
  }

  const paperWarning = !isPaper
    ? null
    : !live
    ? 'Paper trading uses live markets only. Pick one from the Live list.'
    : ticket.side === 'sell' && paperOpen.length === 0
    ? `You have no open paper ${outcomeLabel} position on this market.`
    : ticket.type === 'limit'
    ? 'Paper orders fill at the live price. Switch to Market.'
    : null
  // A paper sell closes browser-held positions, so the server's quote (which can't see them) doesn't gate it.
  const paperClosing = isPaper && ticket.side === 'sell'
  const shownQuoteError = paperClosing ? null : quoteError
  const canSubmit = paperClosing
    ? paperOpen.length > 0 && !busy && !paperWarning
    : Boolean(quote?.executable) && !quoteLoading && !busy && !agentWarning && !paperWarning

  return (
    <Panel title="Order ticket" badge={ticket.mode === 'agent' ? 'AGENT · SUI' : 'PAPER · JOURNAL'} badgeVariant="brand">
      <div className="space-y-sm text-xs font-mono">
        <div className="grid grid-cols-2 gap-xs bg-secondary p-xxs rounded-lg border border-secondary" role="tablist" aria-label="Execution mode">
          <button role="tab" aria-selected={ticket.mode === 'direct'} onClick={() => update({ mode: 'direct' })} className={segment(ticket.mode === 'direct')}>
            Paper (journal)
          </button>
          <button role="tab" aria-selected={ticket.mode === 'agent'} onClick={() => update({ mode: 'agent' })} className={segment(ticket.mode === 'agent')}>
            Agent (x402 · Sui)
          </button>
        </div>

        {ticket.mode === 'direct' ? (
          <div className="p-xs bg-secondary rounded border border-secondary text-quaternary font-sans">
            Paper trading at live prices, saved in this browser. No wallet needed.
            {paperOpen.length > 0 && ` You hold ${paperOpen.reduce((s, t) => s + t.shares, 0).toLocaleString('en-US')} paper ${outcomeLabel} shares here.`}
          </div>
        ) : (
          agentLimits && (
            <div className="p-xs bg-secondary rounded border border-secondary text-quaternary">
              Vault {usd(agentLimits.balance)} · {usd(agentLimits.dailyLeft)} left today · max {usd(agentLimits.maxPerTrade)}/trade
            </div>
          )
        )}

        <div className="grid grid-cols-2 gap-sm">
          {(['buy', 'sell'] as const).map(s => (
            <button
              key={s}
              onClick={() => update({ side: s })}
              aria-pressed={ticket.side === s}
              className={`rounded-lg px-md py-sm text-sm font-semibold transition-colors border ${
                ticket.side === s
                  ? s === 'buy'
                    ? 'border-utility-success-200 bg-utility-success-50 text-utility-success-700'
                    : 'border-utility-error-200 bg-utility-error-50 text-utility-error-700'
                  : 'border-primary bg-primary text-secondary hover:bg-secondary-hover'
              }`}
            >
              {s === 'buy' ? 'Buy' : 'Sell'} {outcomeLabel}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between font-sans">
          <span className="text-secondary font-medium">Order type</span>
          <div className="flex items-center gap-xs">
            {(['market', 'limit'] as const).map(t => (
              <button
                key={t}
                onClick={() => update({ type: t })}
                className={`px-sm py-xxs rounded capitalize ${ticket.type === t ? 'bg-brand-solid text-primary-on-brand font-bold' : 'bg-secondary text-quaternary'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {ticket.type === 'limit' && (
          <label className="flex flex-col gap-xs">
            <span className="text-sm font-medium text-secondary font-sans">Limit price (0.01 – 0.99)</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="0.99"
              value={ticket.limitPrice}
              onChange={e => update({ limitPrice: e.target.value })}
              className="rounded-md bg-primary px-lg py-sm text-sm text-primary border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
            />
          </label>
        )}

        <label className="flex flex-col gap-xs">
          <span className="text-sm font-medium text-secondary font-sans">
            {ticket.side === 'buy' ? 'Amount to spend (USDC)' : 'Proceeds to receive (USDC)'}
          </span>
          <input
            type="number"
            min="0"
            step="1"
            value={ticket.amount}
            onChange={e => update({ amount: e.target.value })}
            className="rounded-md bg-primary px-lg py-sm text-sm text-primary border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
        </label>
        <div className="flex flex-wrap items-center gap-xs">
          {[10, 50, 100, 500].map(c => (
            <button
              key={c}
              onClick={() => update({ amount: String(c) })}
              className="rounded-lg bg-primary px-md py-xs text-xs font-semibold text-secondary border border-primary hover:bg-secondary-hover"
            >
              ${c}
            </button>
          ))}
          {maxAmount != null && maxAmount > 0 && (
            <button
              onClick={() => update({ amount: String(maxAmount) })}
              className="rounded-lg bg-primary px-md py-xs text-xs font-semibold text-brand-primary border border-primary hover:bg-secondary-hover"
            >
              Max ${maxAmount.toLocaleString('en-US')}
            </button>
          )}
        </div>

        {!live && (
          <label className="flex items-center justify-between p-xs bg-secondary rounded border border-secondary cursor-pointer">
            <span className="text-primary font-sans">Split across WaterX + DeepBook</span>
            <input
              type="checkbox"
              checked={ticket.split}
              onChange={e => update({ split: e.target.checked })}
              className="accent-cyan-400 size-4"
            />
          </label>
        )}

        {quote && (
          <div className="space-y-xs">
            <div className="text-quaternary uppercase text-[11px] font-semibold">Sui venue routes</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {quote.routes.map(r => {
                const leg = quote.legs.find(l => l.venueId === r.venueId)
                const isBest = quote.bestRoute.venueId === r.venueId
                return (
                  <div
                    key={r.venueId}
                    className={`p-xs rounded border text-[11px] flex items-center justify-between gap-sm ${
                      leg ? 'border-brand bg-utility-brand-50 text-utility-brand-700' : 'border-secondary bg-secondary text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-xs min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: r.venueColor }} />
                      <span className="truncate">{r.venueName}</span>
                      {isBest && <span className="font-bold">BEST</span>}
                      {leg && <span className="font-bold">· FILLS {leg.allocatedShares} sh</span>}
                    </div>
                    <div className="flex items-center gap-xs shrink-0">
                      <span>{cents(r.price)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {quote && (
          <div className="p-xs bg-secondary rounded border border-secondary space-y-xxs text-[11px]">
            <PreviewRow label="Avg fill price" value={<FlashValue value={quote.avgFillPrice}>{cents(quote.avgFillPrice)}</FlashValue>} />
            <PreviewRow label={ticket.side === 'buy' ? 'Shares' : 'Shares sold'} value={quote.totalShares.toLocaleString('en-US')} />
            {ticket.side === 'buy' ? (
              <>
                <PreviewRow label="Total cost" value={usd(quote.totalCost)} />
                <PreviewRow label="Max payout" value={usd(quote.maxPayout)} tone="good" />
                <PreviewRow label={`Profit if ${outcomeLabel} wins`} value={usd(quote.potentialProfit)} tone={(quote.potentialProfit ?? 0) >= 0 ? 'good' : 'bad'} />
              </>
            ) : (
              <>
                <PreviewRow label="Proceeds" value={usd(quote.proceeds)} />
                <PreviewRow label="Shares you hold" value={(quote.heldShares ?? 0).toLocaleString('en-US')} />
              </>
            )}
            <PreviewRow label="Fees · slippage" value={`${usd(quote.totalFees)} · ${quote.slippagePct}%`} />
            <PreviewRow
              label="vs consensus"
              value={`${quote.consensusGapPp > 0 ? '+' : ''}${quote.consensusGapPp}pp (${cents(quote.consensusPrice)})`}
              tone={(ticket.side === 'buy' ? quote.consensusGapPp <= 0 : quote.consensusGapPp >= 0) ? 'good' : 'bad'}
            />
            {quote.restingAmount > 0 && <PreviewRow label="Rests as limit order" value={usd(quote.restingAmount)} />}
            {quote.unfilledAmount > 0 && ticket.type === 'market' && (
              <PreviewRow label="Unfilled (no liquidity)" value={usd(quote.unfilledAmount)} tone="bad" />
            )}
          </div>
        )}

        {(shownQuoteError || (!paperClosing && quote?.notExecutableReason) || agentWarning || paperWarning) && (
          <div className="flex gap-xs p-xs bg-utility-warning-50 border border-utility-warning-200 text-utility-warning-700 rounded font-sans">
            <AlertCircle className="size-4 shrink-0" />
            <span>{paperWarning || shownQuoteError || agentWarning || quote?.notExecutableReason}</span>
          </div>
        )}

        <button
            onClick={() => (paperClosing ? execute() : setConfirmOpen(true))}
            disabled={!canSubmit}
            className="pi-sheen w-full inline-flex items-center justify-center gap-sm rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-sm font-semibold text-primary-on-brand hover:bg-brand-solid-hover disabled:opacity-50"
          >
            {ticket.mode === 'agent' ? <Zap className="size-4" /> : <PenLine className="size-4" />}
            {busy
              ? execution?.status === 'signing'
                ? 'Waiting for wallet…'
                : 'Submitting…'
              : ticket.mode === 'agent'
              ? 'Review agent order'
              : paperClosing
              ? 'Close paper position at live bid'
              : 'Review paper order'}
          </button>

        {execution && (
          <div className="p-xs bg-primary border border-secondary rounded-lg space-y-xxs" aria-live="polite">
            <div className="flex items-center justify-between">
              <span className="text-quaternary">{execution.mode === 'agent' ? 'Agent order' : 'Paper order'} · {execution.venues}</span>
              <span
                className={`font-bold uppercase ${
                  execution.status === 'confirmed'
                    ? 'text-utility-success-700'
                    : execution.status === 'failed'
                    ? 'text-utility-error-700'
                    : 'text-utility-warning-700 animate-pulse'
                }`}
              >
                {execution.status === 'confirmed' ? 'filled' : execution.status}
              </span>
            </div>
            {execution.reason && <p className="text-utility-error-700 font-sans">{execution.reason}</p>}
            {execution.status === 'confirmed' && (
              <p className="text-[11px] text-quaternary font-sans">
                {execution.mode === 'direct'
                  ? 'Added to your paper journal at the live price.'
                  : execution.mode === 'agent'
                  ? 'Filled in your agent vault (simulated, saved in this browser).'
                  : execution.simulated
                  ? `Simulated fill (ref ${execution.ref}). On-chain settlement on ${execution.venues} isn't wired yet.`
                  : `Tx ${execution.txDigest}`}
              </p>
            )}
          </div>
        )}
      </div>

      {confirmOpen && quote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-md">
          <div className="fixed inset-0 bg-overlay opacity-70" onClick={() => setConfirmOpen(false)} />
          <div className="relative w-full max-w-md rounded-lg bg-primary shadow-2xl border border-secondary" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <header className="border-b border-secondary p-xl">
              <h2 id="confirm-title" className="text-lg font-semibold text-primary">Confirm order</h2>
            </header>
            <div className="p-xl text-xs font-mono">
              <div className="p-sm bg-secondary rounded border border-secondary space-y-xxs">
                <PreviewRow label="Market" value={market.title} />
                <PreviewRow label="Order" value={`${ticket.side.toUpperCase()} ${outcomeLabel} · ${ticket.type}`} />
                <PreviewRow label={ticket.side === 'buy' ? 'Spend' : 'Receive'} value={usd(Number(ticket.amount))} />
                <PreviewRow label="Fills on" value={legsLabel || '—'} />
                <PreviewRow label="Avg price · shares" value={`${cents(quote.avgFillPrice)} · ${quote.totalShares}`} />
                <PreviewRow label="Fees" value={usd(quote.totalFees)} />
                <PreviewRow label="Mode" value={ticket.mode === 'agent' ? 'Agent vault (x402 · Sui)' : 'Paper journal (this browser)'} />
              </div>
              {ticket.mode === 'direct' && (
                <p className="mt-sm text-tertiary font-sans">Paper trade at the live price. No funds move; it is recorded in your journal.</p>
              )}
            </div>
            <footer className="flex justify-end gap-sm border-t border-secondary p-xl">
              <button onClick={() => setConfirmOpen(false)} className="rounded-lg bg-primary px-lg py-sm text-sm font-semibold text-secondary border border-primary hover:bg-secondary-hover">
                Cancel
              </button>
              <button onClick={execute} className="rounded-lg bg-brand-solid px-lg py-sm text-sm font-semibold text-primary-on-brand hover:bg-brand-solid-hover">
                {ticket.mode === 'agent' ? 'Execute via agent' : 'Place paper order'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </Panel>
  )
}
