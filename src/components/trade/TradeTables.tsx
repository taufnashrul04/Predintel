import React, { useState } from 'react'
import { Panel, VenuePill } from '../SharedUI'
import { VENUE_MAP } from '../../lib/config/venues'
import { formatTimeAgo } from '../../lib/formatters'
import { useApp } from '../../context/AppContext'
import { OpenOrder, Position, TradeRecord, apiJson, cents, shortAddr, usd } from './types'
import { useJournal, usePaperMarks } from '../../lib/paperJournal'
import { FlashValue } from '../motion'

type Tab = 'positions' | 'orders' | 'history'

const th = 'py-xs px-sm'
const td = 'py-sm px-sm'

function Venue({ id }: { id: string }) {
  const v = VENUE_MAP.get(id)
  return <VenuePill name={v?.name || id} color={v?.color || '#888'} />
}

function Empty({ text }: { text: string }) {
  return <div className="p-xl text-center text-xs text-tertiary">{text}</div>
}

export default function TradeTables({
  positions,
  orders,
  history,
  onClosePosition,
  onChange
}: {
  positions: Position[]
  orders: OpenOrder[]
  history: TradeRecord[]
  onClosePosition: (p: Position) => Promise<void>
  onChange: () => void
}) {
  const { showToast } = useApp()
  const [tab, setTab] = useState<Tab>('positions')
  const [closing, setClosing] = useState<string | null>(null)
  const { journal, closeTrade, applySettlements } = useJournal()
  const paperOpen = journal.trades.filter(t => t.status === 'open')
  const marks = usePaperMarks(journal.trades, applySettlements)

  const closePaper = async (id: string) => {
    setClosing(id)
    try {
      await closeTrade(id)
      showToast('Paper position closed at the live bid')
    } catch (err: any) {
      showToast(err.message)
    } finally {
      setClosing(null)
    }
  }

  const closeVault = async (p: Position) => {
    setClosing(p.id)
    try {
      await onClosePosition(p)
    } finally {
      setClosing(null)
    }
  }

  const cancel = async (id: string) => {
    try {
      await apiJson(`/api/trade/orders/${id}`, { method: 'DELETE' })
      showToast('Order cancelled')
      onChange()
    } catch (err: any) {
      showToast(`Couldn't cancel: ${err.message}`)
    }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'positions', label: 'Positions', count: positions.length + paperOpen.length },
    { id: 'orders', label: 'Open orders', count: orders.length },
    { id: 'history', label: 'Trade history', count: history.length }
  ]

  return (
    <div className="space-y-sm">
      <div className="flex gap-lg border-b border-secondary overflow-x-auto" role="tablist">
        {tabs.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-md py-sm text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-brand text-brand-primary' : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <Panel noPadding>
        <div className="overflow-x-auto">
          {tab === 'positions' && paperOpen.length > 0 && (
            <>
              <div className="px-sm py-xs bg-secondary border-b border-secondary text-[11px] uppercase font-semibold text-quaternary">
                Paper · live prices
              </div>
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold">
                    <th className={th}>Market</th>
                    <th className={th}>Outcome</th>
                    <th className={th}>Venue</th>
                    <th className={th}>Shares</th>
                    <th className={th}>Entry</th>
                    <th className={th}>Mark</th>
                    <th className={th}>Unrealized PnL</th>
                    <th className={`${th} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary">
                  {paperOpen.map(t => {
                    const m = marks[t.id]
                    const pnl = m?.mark != null ? m.mark * t.shares - t.cost : null
                    return (
                      <tr key={t.id} className="hover:bg-secondary-hover">
                        <td className={`${td} font-sans font-medium text-primary`}>{t.marketTitle}</td>
                        <td className={`${td} font-bold`}>{t.outcomeLabel}</td>
                        <td className={td}><Venue id={t.venueId} /></td>
                        <td className={td}>{t.shares.toLocaleString('en-US')}</td>
                        <td className={td}>{cents(t.entryPrice)}</td>
                        <td className={td}>
                          {m?.status === 'awaiting' ? <span className="text-utility-warning-700">settling…</span> : <FlashValue value={m?.mark}>{cents(m?.mark)}</FlashValue>}
                        </td>
                        <td className={`${td} font-bold ${pnl == null ? 'text-quaternary' : pnl >= 0 ? 'text-utility-success-700' : 'text-utility-error-700'}`}>
                          {pnl == null ? '—' : `${pnl >= 0 ? '+' : '-'}${usd(Math.abs(pnl))}`}
                        </td>
                        <td className={`${td} text-right`}>
                          <button
                            onClick={() => closePaper(t.id)}
                            disabled={closing === t.id || m?.status === 'awaiting'}
                            className="px-sm py-xxs rounded bg-secondary hover:bg-utility-error-50 hover:text-utility-error-700 font-bold disabled:opacity-50"
                          >
                            {closing === t.id ? 'Closing…' : 'Close'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
          {tab === 'positions' && positions.length > 0 && (
            <div className="px-sm py-xs bg-secondary border-y border-secondary text-[11px] uppercase font-semibold text-quaternary">
              Agent vault (simulated)
            </div>
          )}
          {tab === 'positions' &&
            (positions.length === 0 ? (
              paperOpen.length === 0 && <Empty text="No open positions yet. Place a paper order to see it here." />
            ) : (
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                    <th className={th}>Market</th>
                    <th className={th}>Outcome</th>
                    <th className={th}>Venue</th>
                    <th className={th}>Shares</th>
                    <th className={th}>Avg</th>
                    <th className={th}>Mark</th>
                    <th className={th}>Unrealized PnL</th>
                    <th className={`${th} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary">
                  {positions.map(p => (
                    <tr key={p.id} className="hover:bg-secondary-hover">
                      <td className={`${td} font-sans font-medium text-primary`}>{p.marketTitle}</td>
                      <td className={`${td} font-bold`}>{p.outcomeLabel}</td>
                      <td className={td}><Venue id={p.venueId} /></td>
                      <td className={td}>{p.shares.toLocaleString('en-US')}</td>
                      <td className={td}>{cents(p.avgPrice)}</td>
                      <td className={td}>{cents(p.currentPrice)}</td>
                      <td className={`${td} font-bold ${p.pnl >= 0 ? 'text-utility-success-700' : 'text-utility-error-700'}`}>
                        {p.pnl >= 0 ? '+' : '-'}{usd(Math.abs(p.pnl))} ({p.returnPct}%)
                      </td>
                      <td className={`${td} text-right`}>
                        <button
                          onClick={() => closeVault(p)}
                          disabled={closing === p.id}
                          className="px-sm py-xxs rounded bg-secondary hover:bg-utility-error-50 hover:text-utility-error-700 font-bold disabled:opacity-50"
                        >
                          {closing === p.id ? 'Closing…' : 'Close'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

          {tab === 'orders' &&
            (orders.length === 0 ? (
              <Empty text="No resting limit orders." />
            ) : (
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                    <th className={th}>Market</th>
                    <th className={th}>Order</th>
                    <th className={th}>Venue</th>
                    <th className={th}>Limit</th>
                    <th className={th}>Amount</th>
                    <th className={th}>Placed</th>
                    <th className={`${th} text-right`}>Cancel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary">
                  {orders.map(o => (
                    <tr key={o.id} className="hover:bg-secondary-hover">
                      <td className={`${td} font-sans font-medium text-primary`}>{o.marketTitle}</td>
                      <td className={`${td} font-bold ${o.side === 'buy' ? 'text-utility-success-700' : 'text-utility-error-700'}`}>
                        {o.side.toUpperCase()} {o.outcomeLabel}
                      </td>
                      <td className={td}><Venue id={o.venueId} /></td>
                      <td className={td}>{cents(o.price)}</td>
                      <td className={td}>{usd(o.amount)}</td>
                      <td className={`${td} text-quaternary`}>{formatTimeAgo(o.createdAt)}</td>
                      <td className={`${td} text-right`}>
                        <button
                          onClick={() => cancel(o.id)}
                          className="px-sm py-xxs bg-secondary hover:bg-utility-error-50 hover:text-utility-error-700 rounded"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

          {tab === 'history' &&
            (history.length === 0 ? (
              <Empty text="No trades yet." />
            ) : (
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                    <th className={th}>When</th>
                    <th className={th}>Market</th>
                    <th className={th}>Side</th>
                    <th className={th}>Mode</th>
                    <th className={th}>Venue</th>
                    <th className={th}>Price</th>
                    <th className={th}>Shares</th>
                    <th className={th}>Amount</th>
                    <th className={`${th} text-right`}>Settlement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary">
                  {history.map(h => (
                    <tr key={h.id} className="hover:bg-secondary-hover">
                      <td className={`${td} text-quaternary whitespace-nowrap`}>{formatTimeAgo(h.t)}</td>
                      <td className={`${td} font-sans font-medium text-primary`}>{h.marketTitle}</td>
                      <td className={`${td} font-bold ${h.side === 'buy' ? 'text-utility-success-700' : 'text-utility-error-700'}`}>
                        {h.side.toUpperCase()} {h.outcomeLabel ?? h.outcomeId.toUpperCase()}
                      </td>
                      <td className={td}>
                        {h.mode}
                        {h.signer && <span className="block text-quaternary">{shortAddr(h.signer)}</span>}
                      </td>
                      <td className={td}><Venue id={h.venueId} /></td>
                      <td className={td}>{cents(h.price)}</td>
                      <td className={td}>{h.shares.toLocaleString('en-US')}</td>
                      <td className={td}>{usd(h.amount)}</td>
                      <td className={`${td} text-right text-tertiary whitespace-nowrap`}>
                        {h.txDigest ? `${h.txDigest.slice(0, 10)}…` : h.simulated ? `Simulated · ${h.ref?.slice(0, 12)}` : 'Seed data'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>
      </Panel>
    </div>
  )
}
