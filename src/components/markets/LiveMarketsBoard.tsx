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
  venueId: 'waterx' | 'deepbook' | 'polymarket'
  kind: string
  // Polymarket rows: read-only, with the WaterX mirror (if any) that paper trades go to.
  url?: string
  mirror?: { market: string; outcome: string; label: string; price: number } | null
  gapPp?: number | null
  lead: string
  price: number | null
  volume: number | null
  closesAt: string | null
}

const KIND_LABEL: Record<string, string> = {
  event: 'Event',
  'sport-match': 'Match',
  'crypto-updown': 'Up / down',
  window: 'BTC window',
  binary: 'Binary'
}

function fromPolymarket(r: any): Row {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    venueId: 'polymarket',
    kind: 'binary',
    lead: r.lead,
    price: r.price,
    volume: null,
    closesAt: r.closesAt,
    url: r.url,
    mirror: r.waterx,
    gapPp: r.gapPp
  }
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

// Live markets from the chosen venues. Sui venues trade on paper directly; Polymarket is read-only and
// paper trades go to the same market on WaterX when it lists one.
export default function LiveMarketsBoard({
  category,
  search,
  sort,
  view,
  venues
}: {
  category: string
  search: string
  sort: string
  view: string
  venues: string[]
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

  // Polymarket has ~11k markets, so the server filters them; refetch once the search settles.
  const withPolymarket = venues.includes('polymarket')
  const [pm, setPm] = useState<{ rows: Row[]; total: number; mirrored: number } | null>(null)
  const [pmError, setPmError] = useState<string | null>(null)
  useEffect(() => {
    if (!withPolymarket) {
      setPm(null)
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      const params = new URLSearchParams({ q: search, category, limit: '300' })
      fetch(`/api/polymarket/markets?${params}`)
        .then(async r => {
          const body = await r.json()
          if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
          if (!cancelled) {
            setPm({ rows: body.rows.map(fromPolymarket), total: body.total, mirrored: body.mirrored })
            setPmError(null)
          }
        })
        .catch(err => !cancelled && setPmError(err.message))
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [withPolymarket, search, category])

  if (!rows || (withPolymarket && !pm && !pmError)) return <div className="h-64 rounded-xl pi-shimmer" />

  const q = search.toLowerCase()
  const all = [...rows.filter(r => venues.includes(r.venueId)), ...(pm?.rows ?? [])]
  const shown = all
    .filter(r => (category === 'all' || r.category === category) && (!q || r.title.toLowerCase().includes(q) || r.lead.toLowerCase().includes(q)))
    .sort((a, b) =>
      sort === 'closing'
        ? (a.closesAt ? Date.parse(a.closesAt) : Infinity) - (b.closesAt ? Date.parse(b.closesAt) : Infinity)
        : sort === 'gap'
          ? (b.gapPp ?? -1) - (a.gapPp ?? -1)
          : (b.volume ?? -1) - (a.volume ?? -1)
    )
  const open = (r: Row) => {
    if (r.venueId !== 'polymarket') return navigate(`/trade?market=${encodeURIComponent(r.id)}`)
    if (r.mirror) return navigate(`/trade?market=${encodeURIComponent(r.mirror.market)}&outcome=${encodeURIComponent(r.mirror.outcome)}`)
    window.open(r.url, '_blank', 'noopener')
  }
  const venue = (id: string) => {
    const v = VENUE_MAP.get(id)
    return <VenuePill name={id === 'deepbook' ? 'DeepBook Predict' : v?.name ?? id} color={v?.color ?? '#888'} />
  }
  const cents = (p: number | null | undefined) => (p == null ? '—' : `${(p * 100).toFixed(1)}¢`)
  const compare = (r: Row) =>
    r.mirror ? (
      <span className="whitespace-nowrap">
        WaterX {cents(r.mirror.price)}{' '}
        <span className={(r.gapPp ?? 0) >= 1 ? 'text-utility-warning-700 font-bold' : 'text-quaternary'}>· {r.gapPp?.toFixed(1)}pp</span>
      </span>
    ) : r.venueId === 'polymarket' ? (
      <span className="text-quaternary">not on Sui</span>
    ) : (
      <span className="text-quaternary">—</span>
    )
  const action = (r: Row) => (r.venueId !== 'polymarket' ? 'Trade →' : r.mirror ? 'Paper on WaterX →' : 'Open ↗')
  const sources = [
    venues.includes('waterx') && 'WaterX',
    venues.includes('deepbook') && 'DeepBook Predict',
    withPolymarket && (pm ? `Polymarket (${pm.total.toLocaleString('en-US')} matching, ${pm.mirrored} also on WaterX)` : 'Polymarket')
  ].filter(Boolean)

  const footer = (
    <p className="text-[10px] text-quaternary font-mono">
      {shown.length} shown · {sources.join(' + ') || 'no venue selected'} · updated {fetchedAt ? formatTimeAgo(fetchedAt) : '—'}
      {withPolymarket && pm && pm.total > pm.rows.length && ' · search to narrow Polymarket'}
      {error && <span className="text-utility-warning-700"> · {error}</span>}
      {pmError && <span className="text-utility-warning-700"> · Polymarket: {pmError}</span>}
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
              {r.venueId === 'polymarket' && <div className="text-[11px] font-mono text-tertiary">{compare(r)}</div>}
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
              {withPolymarket && <th className="py-xs px-sm">Other venue</th>}
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
                {withPolymarket && <td className="py-sm px-sm font-mono text-xs">{compare(r)}</td>}
                <td className="py-sm px-sm font-mono text-tertiary">{r.volume ? formatMoney(r.volume) : '—'}</td>
                <td className="py-sm px-sm font-mono text-tertiary whitespace-nowrap">{closesIn(r.closesAt)}</td>
                <td className="py-sm px-sm text-right">
                  <span className="px-sm py-xxs bg-tertiary rounded text-xs font-mono font-bold whitespace-nowrap">{action(r)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="p-xl text-center text-xs text-tertiary">{venues.length === 0 ? 'Pick at least one venue.' : 'No live market matches these filters.'}</p>
        )}
        <div className="px-sm py-xs border-t border-secondary">{footer}</div>
      </div>
    </Panel>
  )
}
