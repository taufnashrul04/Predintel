import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Panel, VenuePill } from '../SharedUI'
import { FlashValue } from '../motion'
import { formatMoney, formatTimeAgo } from '../../lib/formatters'
import { VENUE_MAP } from '../../lib/config/venues'

interface Row {
  id: string
  title: string
  category: string
  venueId: 'waterx' | 'deepbook'
  kind: string
  lead: string
  price: number | null
  volume: number | null
  closesAt: string | null
}

const KIND_LABEL: Record<string, string> = {
  event: 'Event',
  'sport-match': 'Match',
  'crypto-updown': 'Up / down',
  window: 'BTC window'
}

function toRows(live: any): Row[] {
  const fromWaterx = (m: any, kind: string): Row => ({
    id: m.id,
    title: m.title,
    category: m.category,
    venueId: 'waterx',
    kind,
    lead: m.preview?.[0]?.label ?? '',
    price: m.preview?.[0]?.price ?? null,
    volume: m.volumeUsd ?? null,
    closesAt: m.settlesAt ?? null
  })
  return [
    ...(live.deepbook ?? []).map((m: any) => ({
      id: m.id, title: m.title, category: 'crypto', venueId: 'deepbook' as const, kind: 'window',
      lead: 'Up', price: m.outcomes?.[0]?.ask ?? null, volume: null, closesAt: m.settlesAt
    })),
    ...(live.waterx ?? []).map((m: any) => fromWaterx(m, 'event')),
    ...(live.waterxUpdown ?? []).map((m: any) => fromWaterx(m, 'crypto-updown')),
    ...(live.waterxMatches ?? []).map((m: any) => fromWaterx(m, 'sport-match'))
  ]
}

const closesIn = (iso: string | null) => {
  if (!iso) return '—'
  const ms = Date.parse(iso) - Date.now()
  if (ms <= 0) return 'closing'
  const h = ms / 3_600_000
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))}m`
  if (h < 48) return `${Math.round(h)}h`
  return new Date(iso).toISOString().slice(0, 10)
}

// Every market tradable on the two Sui venues, refreshed live.
export default function LiveMarketsBoard({
  category,
  search,
  sort,
  view
}: {
  category: string
  search: string
  sort: string
  view: string
}) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch('/api/trade/live-markets')
        .then(r => r.json())
        .then(live => {
          if (cancelled) return
          setRows(toRows(live))
          setError(live.errors?.waterx ?? null)
          setFetchedAt(new Date().toISOString())
        })
        .catch(err => !cancelled && setError(err.message))
    load()
    const t = window.setInterval(load, 30_000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [])

  if (!rows) return <div className="h-64 rounded-xl pi-shimmer" />

  const q = search.toLowerCase()
  const shown = rows
    .filter(r => (category === 'all' || r.category === category) && (!q || r.title.toLowerCase().includes(q) || r.lead.toLowerCase().includes(q)))
    .sort((a, b) =>
      sort === 'closing'
        ? (a.closesAt ? Date.parse(a.closesAt) : Infinity) - (b.closesAt ? Date.parse(b.closesAt) : Infinity)
        : (b.volume ?? -1) - (a.volume ?? -1)
    )
  const open = (r: Row) => navigate(`/trade?market=${encodeURIComponent(r.id)}`)
  const venue = (id: string) => {
    const v = VENUE_MAP.get(id)
    return <VenuePill name={id === 'deepbook' ? 'DeepBook Predict' : v?.name ?? id} color={v?.color ?? '#888'} />
  }

  const footer = (
    <p className="text-[10px] text-quaternary font-mono">
      {shown.length} of {rows.length} live markets · WaterX + DeepBook Predict · updated {fetchedAt ? formatTimeAgo(fetchedAt) : '—'}
      {error && <span className="text-utility-warning-700"> · {error}</span>}
    </p>
  )

  if (view === 'cards') {
    return (
      <div className="space-y-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {shown.slice(0, 120).map(r => (
            <button
              key={r.id}
              onClick={() => open(r)}
              className="pi-spotlight pi-lift text-left bg-primary border border-secondary hover:border-brand rounded-xl p-xl shadow-xs transition-colors flex flex-col justify-between gap-sm"
            >
              <div className="flex items-center justify-between gap-sm text-xs">
                {venue(r.venueId)}
                <span className="text-[10px] uppercase font-mono text-quaternary">{KIND_LABEL[r.kind]}</span>
              </div>
              <h4 className="text-sm font-semibold text-primary leading-snug line-clamp-2">{r.title}</h4>
              <div className="flex items-end justify-between gap-sm pt-sm border-t border-secondary text-xs font-mono">
                <span className="text-tertiary truncate">{r.lead}</span>
                <FlashValue value={r.price} className="text-primary font-bold text-sm">
                  {r.price == null ? '—' : `${(r.price * 100).toFixed(1)}¢`}
                </FlashValue>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-quaternary">
                <span>{r.volume ? formatMoney(r.volume) : '—'} vol</span>
                <span>closes {closesIn(r.closesAt)}</span>
              </div>
            </button>
          ))}
        </div>
        {footer}
      </div>
    )
  }

  return (
    <Panel noPadding>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
              <th className="py-xs px-sm">Market</th>
              <th className="py-xs px-sm">Type</th>
              <th className="py-xs px-sm">Venue</th>
              <th className="py-xs px-sm">Leading outcome</th>
              <th className="py-xs px-sm">Buy</th>
              <th className="py-xs px-sm">Volume</th>
              <th className="py-xs px-sm">Closes</th>
              <th className="py-xs px-sm text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary">
            {shown.map(r => (
              <tr key={r.id} onClick={() => open(r)} className="hover:bg-secondary-hover cursor-pointer transition-colors">
                <td className="py-sm px-sm font-medium text-primary">
                  <div className="truncate max-w-md">{r.title}</div>
                  <div className="text-[10px] text-quaternary uppercase font-mono">{r.category}</div>
                </td>
                <td className="py-sm px-sm text-[11px] font-mono text-tertiary whitespace-nowrap">{KIND_LABEL[r.kind]}</td>
                <td className="py-sm px-sm whitespace-nowrap">{venue(r.venueId)}</td>
                <td className="py-sm px-sm text-secondary truncate max-w-[180px]">{r.lead}</td>
                <td className="py-sm px-sm font-mono font-bold text-primary">
                  <FlashValue value={r.price}>{r.price == null ? '—' : `${(r.price * 100).toFixed(1)}¢`}</FlashValue>
                </td>
                <td className="py-sm px-sm font-mono text-tertiary">{r.volume ? formatMoney(r.volume) : '—'}</td>
                <td className="py-sm px-sm font-mono text-tertiary whitespace-nowrap">{closesIn(r.closesAt)}</td>
                <td className="py-sm px-sm text-right">
                  <span className="px-sm py-xxs bg-tertiary rounded text-xs font-mono font-bold">Trade →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="p-xl text-center text-xs text-tertiary">No live market matches these filters.</p>}
        <div className="px-sm py-xs border-t border-secondary">{footer}</div>
      </div>
    </Panel>
  )
}
