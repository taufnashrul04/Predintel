import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import LiveMarketsBoard from '../components/markets/LiveMarketsBoard'

const CATEGORIES = ['all', 'crypto', 'macro', 'sports', 'culture']

// Every live market on the two Sui venues, with search, category, sort and view controls.
export default function MarketsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('category') || 'all'
  const search = searchParams.get('q') || ''
  const sort = searchParams.get('sort') || 'volume'
  const view = searchParams.get('view') || 'table'

  const setParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams)
    if (!val || val === 'all') next.delete(key)
    else next.set(key, val)
    setSearchParams(next, { replace: true })
  }

  const segment = (active: boolean) =>
    `px-sm py-xxs rounded text-xs font-medium capitalize transition-colors ${
      active ? 'bg-brand-solid text-primary-on-brand' : 'text-tertiary hover:text-primary'
    }`

  return (
    <div className="space-y-md">
      <div className="bg-secondary border border-secondary rounded-xl p-sm flex flex-wrap items-center justify-between gap-sm">
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
          </select>
          <div className="flex items-center gap-xxs bg-tertiary p-xxs rounded border border-secondary">
            <button onClick={() => setParam('view', '')} className={segment(view === 'table')}>Table</button>
            <button onClick={() => setParam('view', 'cards')} className={segment(view === 'cards')}>Cards</button>
          </div>
        </div>
      </div>

      <LiveMarketsBoard category={category} search={search} sort={sort} view={view} />
    </div>
  )
}
