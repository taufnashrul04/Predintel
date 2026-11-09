import React, { useState } from 'react'
import { Panel, VenuePill } from '../SharedUI'
import { VENUE_MAP } from '../../lib/config/venues'
import { formatTimeAgo } from '../../lib/formatters'
import { useApp } from '../../context/AppContext'
import { cents, usd } from './types'
import { useJournal, usePaperMarks } from '../../lib/paperJournal'
import { cancelVaultOrder, closeVaultPosition, useVault, useVaultMarks } from '../../lib/agentVault'
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

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-sm py-xs bg-secondary border-y border-secondary text-[11px] uppercase font-semibold text-quaternary">{children}</div>
}

const pnlClass = (n: number | null) => (n == null ? 'text-quaternary' : n >= 0 ? 'text-utility-success-700' : 'text-utility-error-700')
const signed = (n: number) => `${n >= 0 ? '+' : '-'}${usd(Math.abs(n))}`

interface PositionRow {
  key: string
  marketTitle: string
  outcomeLabel: string
  venueId: string
  shares: number
  entry: number
  mark: number | null
  awaiting: boolean
  cost: number
  onClose: () => Promise<unknown>
}

function PositionsTable({ rows, closing, close }: { rows: PositionRow[]; closing: string | null; close: (r: PositionRow) => void }) {
  return (
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
        {rows.map(r => {
          const pnl = r.mark != null ? r.mark * r.shares - r.cost : null
          return (
            <tr key={r.key} className="hover:bg-secondary-hover">
              <td className={`${td} font-sans font-medium text-primary`}>{r.marketTitle}</td>
              <td className={`${td} font-bold`}>{r.outcomeLabel}</td>
              <td className={td}><Venue id={r.venueId} /></td>
              <td className={td}>{r.shares.toLocaleString('en-US')}</td>
              <td className={td}>{cents(r.entry)}</td>
              <td className={td}>
                {r.awaiting ? <span className="text-utility-warning-700">settling…</span> : <FlashValue value={r.mark}>{cents(r.mark)}</FlashValue>}
              </td>
              <td className={`${td} font-bold ${pnlClass(pnl)}`}>
                {pnl == null ? '—' : `${signed(pnl)} (${((pnl / r.cost) * 100).toFixed(1)}%)`}
              </td>
              <td className={`${td} text-right`}>
                <button
                  onClick={() => close(r)}
                  disabled={closing === r.key || r.awaiting}
                  className="px-sm py-xxs rounded bg-secondary hover:bg-utility-error-50 hover:text-utility-error-700 font-bold disabled:opacity-50"
                >
                  {closing === r.key ? 'Closing…' : 'Close'}
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// Positions, orders and history for both books this browser keeps: paper journal and agent vault.
export default function TradeTables() {
  const { showToast } = useApp()
  const [tab, setTab] = useState<Tab>('positions')
  const [closing, setClosing] = useState<string | null>(null)
  const { journal, closeTrade, applySettlements } = useJournal()
  const vault = useVault()
  const paperOpen = journal.trades.filter(t => t.status === 'open')
  const paperMarks = usePaperMarks(journal.trades, applySettlements)
  const vaultMarks = useVaultMarks(vault.positions)

  const paperRows: PositionRow[] = paperOpen.map(t => ({
    key: t.id,
    marketTitle: t.marketTitle,
    outcomeLabel: t.outcomeLabel,
    venueId: t.venueId,
    shares: t.shares,
    entry: t.entryPrice,
    mark: paperMarks[t.id]?.mark ?? null,
    awaiting: paperMarks[t.id]?.status === 'awaiting',
    cost: t.cost,
    onClose: () => closeTrade(t.id)
  }))
  const vaultRows: PositionRow[] = vault.positions.map(p => ({
    key: p.id,
    marketTitle: p.marketTitle,
    outcomeLabel: p.outcomeLabel,
    venueId: p.venueId,
    shares: p.shares,
    entry: p.avgPrice,
    mark: vaultMarks[p.id]?.mark ?? null,
    awaiting: vaultMarks[p.id]?.status === 'awaiting',
    cost: p.avgPrice * p.shares,
    onClose: () => closeVaultPosition(p.id)
  }))

  const close = async (r: PositionRow) => {
    setClosing(r.key)
    try {
      await r.onClose()
      showToast(`Closed ${r.outcomeLabel} on ${r.marketTitle}`)
    } catch (err: any) {
      showToast(`Couldn't close: ${err.message}`)
    } finally {
      setClosing(null)
    }
  }

  // Paper trades show as a buy, plus a sell once closed or settled; vault fills are recorded per leg.
  const history = [
    ...vault.history.map(h => ({ ...h, book: 'Agent vault' as const })),
    ...journal.trades.flatMap(t => [
      { id: `${t.id}-open`, marketTitle: t.marketTitle, outcomeLabel: t.outcomeLabel, side: 'buy' as const, venueId: t.venueId, shares: t.shares, price: t.entryPrice, amount: t.cost, realizedPnl: undefined as number | undefined, at: t.openedAt, book: 'Paper' as const },
      ...(t.status !== 'open' && t.closedAt
        ? [{ id: `${t.id}-close`, marketTitle: t.marketTitle, outcomeLabel: t.outcomeLabel, side: 'sell' as const, venueId: t.venueId, shares: t.shares, price: t.exitPrice ?? 0, amount: (t.exitPrice ?? 0) * t.shares, realizedPnl: t.realizedPnl, at: t.closedAt, book: 'Paper' as const }]
        : [])
    ])
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'positions', label: 'Positions', count: paperRows.length + vaultRows.length },
    { id: 'orders', label: 'Open orders', count: vault.orders.length },
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
          {tab === 'positions' && (
            <>
              {paperRows.length > 0 && (
                <>
                  <GroupLabel>Paper · live prices</GroupLabel>
                  <PositionsTable rows={paperRows} closing={closing} close={close} />
                </>
              )}
              {vaultRows.length > 0 && (
                <>
                  <GroupLabel>Agent vault (simulated)</GroupLabel>
                  <PositionsTable rows={vaultRows} closing={closing} close={close} />
                </>
              )}
              {paperRows.length + vaultRows.length === 0 && <Empty text="No open positions. Place a paper or agent order to see it here." />}
            </>
          )}

          {tab === 'orders' &&
            (vault.orders.length === 0 ? (
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
                  {vault.orders.map(o => (
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
                          onClick={() => {
                            cancelVaultOrder(o.id)
                            showToast('Order cancelled')
                          }}
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
                    <th className={th}>Book</th>
                    <th className={th}>Venue</th>
                    <th className={th}>Price</th>
                    <th className={th}>Shares</th>
                    <th className={th}>Amount</th>
                    <th className={`${th} text-right`}>Realized</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary">
                  {history.slice(0, 100).map(h => (
                    <tr key={h.id} className="hover:bg-secondary-hover">
                      <td className={`${td} text-quaternary whitespace-nowrap`}>{formatTimeAgo(h.at)}</td>
                      <td className={`${td} font-sans font-medium text-primary`}>{h.marketTitle}</td>
                      <td className={`${td} font-bold ${h.side === 'buy' ? 'text-utility-success-700' : 'text-utility-error-700'}`}>
                        {h.side.toUpperCase()} {h.outcomeLabel}
                      </td>
                      <td className={`${td} text-tertiary`}>{h.book}</td>
                      <td className={td}><Venue id={h.venueId} /></td>
                      <td className={td}>{cents(h.price)}</td>
                      <td className={td}>{h.shares.toLocaleString('en-US')}</td>
                      <td className={td}>{usd(h.amount)}</td>
                      <td className={`${td} text-right font-bold ${pnlClass(h.realizedPnl ?? null)}`}>
                        {h.realizedPnl == null ? '—' : signed(h.realizedPnl)}
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
