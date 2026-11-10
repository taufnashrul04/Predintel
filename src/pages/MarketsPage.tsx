import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import LiveMarketsBoard from '../components/markets/LiveMarketsBoard'
import { VENUE_MAP } from '../lib/config/venues'

const CATEGORIES = ['all', 'crypto', 'macro', 'sports', 'culture']

// Venues with a live public feed. Sui venues take paper trades; the rest are read-only for comparing prices.
const LIVE_VENUES = [
  { id: 'waterx', label: 'WaterX', note: 'Sui' },
  { id: 'deepbook', label: 'DeepBook Predict', note: 'Sui' },
  { id: 'polymarket', label: 'Polymarket', note: 'compare' },
  { id: 'opinion', label: 'Opinion', note: 'compare' },
  { id: 'limitless', label: 'Limitless', note: 'compare' }
]
const COMPARE = ['polymarket', 'opinion', 'limitless']
// Venues without a usable public price feed today.
const NOT_CONNECTED = [
  { id: 'predictfun', why: 'Its API needs a private key' },
  { id: 'sxbet', why: 'Its public price endpoint was retired' }
]
const DEFAULT_VENUES = 'waterx,deepbook'

// Live markets from the venues you pick, with search, category, sort and view controls.
export default function MarketsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('category') || 'all'
  const search = searchParams.get('q') || ''
  const venues = (searchParams.get('venues') ?? DEFAULT_VENUES).split(',').filter(v => LIVE_VENUES.some(l => l.id === v))
  const withCompare = venues.some(v => COMPARE.includes(v))
  const sort = searchParams.get('sort') === 'gap' && !withCompare ? 'volume' : searchParams.get('sort') || 'volume'
  const view = searchParams.get('view') || 'table'

  const setParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams)
    if (!val || val === 'all') next.delete(key)
    else next.set(key, val)
    setSearchParams(next, { replace: true })
  }

  const toggleVenue = (id: string) => {
    const set = new Set(venues)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    const list = LIVE_VENUES.map(v => v.id).filter(v => set.has(v)).join(',')
    const next = new URLSearchParams(searchParams)
    if (list === DEFAULT_VENUES) next.delete('venues')
    else next.set('venues', list || 'none')
    // Comparing is the reason to add these venues, so sort by gap when the first one is switched on.
    const compareAfter = [...set].some(v => COMPARE.includes(v))
    if (compareAfter && !withCompare) next.set('sort', 'gap')
    if (!compareAfter && next.get('sort') === 'gap') next.delete('sort')
    setSearchParams(next, { replace: true })
  }

  const segment = (active: boolean) =>
    `px-sm py-xxs rounded text-xs font-medium capitalize transition-colors ${
      active ? 'bg-brand-solid text-primary-on-brand' : 'text-tertiary hover:text-primary'
    }`

  return (
    <div className="space-y-md">
      <div className="bg-secondary border border-secondary rounded-xl p-sm space-y-sm">
        <div className="flex flex-wrap items-center gap-xs" role="group" aria-label="Venues">
          <span className="text-[11px] font-mono uppercase text-quaternary mr-xs">Venues</span>
          {LIVE_VENUES.map(v => {
            const on = venues.includes(v.id)
            return (
              <button
                key={v.id}
                onClick={() => toggleVenue(v.id)}
                aria-pressed={on}
                className={`inline-flex items-center gap-xs px-sm py-xxs rounded-lg border text-xs font-semibold transition-colors ${
                  on ? 'border-brand bg-utility-brand-50 text-utility-brand-700' : 'border-secondary bg-primary text-tertiary hover:text-primary'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: VENUE_MAP.get(v.id)?.color ?? '#888' }} />
                {v.label}
                <span className="text-[10px] font-normal text-quaternary">{v.note}</span>
              </button>
            )
          })}
          {NOT_CONNECTED.map(({ id, why }) => (
            <span
              key={id}
              title={why}
              className="inline-flex items-center gap-xs px-sm py-xxs rounded-lg border border-secondary text-xs text-quaternary cursor-not-allowed"
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0 opacity-40" style={{ backgroundColor: VENUE_MAP.get(id)?.color ?? '#888' }} />
              {VENUE_MAP.get(id)?.name ?? id}
              <span className="text-[10px]">no feed</span>
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-sm">
          <div className="flex items-center gap-xs flex-wrap">
            <label className="relative">
              <Search className="size-3.5 text-fg-quaternary absolute left-sm top-2.5 shrink-0" />
              <input
                type="text"
                placeholder="Search markets"
                aria-label="Search markets"
                value={search}
                onChange={e => setParam('q', e.target.value)}
                className="bg-primary border border-secondary rounded-md pl-xl pr-sm py-xs text-xs text-primary placeholder:text-placeholder focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              />
            </label>
            <div className="flex items-center gap-xxs bg-tertiary p-xxs rounded-md border border-secondary">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setParam('category', c)} className={segment(category === c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-sm text-xs">
            <select
              value={sort}
              onChange={e => setParam('sort', e.target.value === 'volume' ? '' : e.target.value)}
              aria-label="Sort markets"
              className="bg-primary border border-secondary text-primary rounded px-sm py-xxs focus:outline-none"
            >
              <option value="volume">Most volume</option>
              <option value="closing">Closing soon</option>
              {withCompare && <option value="gap">Biggest gap vs WaterX</option>}
            </select>
            <div className="flex items-center gap-xxs bg-tertiary p-xxs rounded border border-secondary">
              <button onClick={() => setParam('view', '')} className={segment(view === 'table')}>Table</button>
              <button onClick={() => setParam('view', 'cards')} className={segment(view === 'cards')}>Cards</button>
            </div>
          </div>
        </div>

        {withCompare && (
          <p className="text-[11px] text-tertiary">
            Polymarket, Opinion and Limitless are shown to compare prices. Paper trades always go through Sui: rows WaterX also lists
            open a paper ticket on WaterX, the rest open on their own venue.
          </p>
        )}
      </div>

      <LiveMarketsBoard category={category} search={search} sort={sort} view={view} venues={venues} />
    </div>
  )
}
