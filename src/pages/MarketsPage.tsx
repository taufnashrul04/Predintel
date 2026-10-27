import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Star, ArrowUpDown } from 'lucide-react'
import { Panel, VenuePill } from '../components/SharedUI'
import { VENUE_MAP } from '../lib/config/venues'
import { formatMoney } from '../lib/formatters'
import { useApp } from '../context/AppContext'

export default function MarketsPage() {
  const [markets, setMarkets] = useState<any[]>([])
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useApp()
  const navigate = useNavigate()

  // Sync state from query params
  const categoryFilter = searchParams.get('category') || 'all'
  const searchFilter = searchParams.get('q') || ''
  const sortBy = searchParams.get('sort') || 'volume'
  const viewMode = searchParams.get('view') || 'table'

  const categories = ['all', 'crypto', 'macro', 'sports', 'politics', 'culture']

  const setParam = (key: string, val: string) => {
    const updated = new URLSearchParams(searchParams)
    if (val === 'all' || !val) {
      updated.delete(key)
    } else {
      updated.set(key, val)
    }
    setSearchParams(updated)
  }

  const fetchMarkets = async () => {
    try {
      const res = await fetch('/api/markets').then(r => r.json())
      setMarkets(Array.isArray(res) ? res : [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchMarkets()
  }, [])

  const handleToggleWatchlist = async (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/markets/${eventId}/watchlist`, { method: 'POST' }).then(r => r.json())
      setMarkets(prev =>
        prev.map(m => (m.id === eventId ? { ...m, isWatchlisted: res.watchlisted } : m))
      )
      showToast(res.watchlisted ? 'Added to Walrus watchlist' : 'Removed from watchlist')
    } catch (err) {
      console.error(err)
    }
  }

  const filtered = markets
    .filter(m => {
      if (categoryFilter !== 'all' && m.category !== categoryFilter) return false
      if (searchFilter && !m.title.toLowerCase().includes(searchFilter.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'volume') return b.totalVolume - a.totalVolume
      if (sortBy === 'oi') return b.totalOI - a.totalOI
      if (sortBy === 'spread') return b.spread - a.spread
      return b.consensus - a.consensus
    })

  return (
    <div className="space-y-md">
      {/* Controls Bar */}
      <div className="bg-secondary border border-secondary rounded-xl p-sm flex flex-wrap items-center justify-between gap-sm">
        <div className="flex items-center gap-xs flex-wrap">
          <div className="relative">
            <Search className="size-3.5 text-fg-quaternary absolute left-sm top-2.5" />
            <input
              type="text"
              placeholder="Filter markets..."
              value={searchFilter}
              onChange={e => setParam('q', e.target.value)}
              className="bg-primary border border-secondary rounded-md pl-xl pr-sm py-xs text-xs text-primary placeholder:text-placeholder focus:outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>

          <div className="flex items-center gap-xxs bg-tertiary p-xxs rounded-md border border-secondary">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setParam('category', cat)}
                className={`px-sm py-xxs rounded text-xs uppercase font-medium transition-colors ${
                  categoryFilter === cat
                    ? 'bg-brand-solid text-primary-on-brand'
                    : 'text-tertiary hover:text-primary'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-sm">
          <div className="flex items-center gap-xs text-xs font-mono">
            <span className="text-quaternary">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setParam('sort', e.target.value)}
              className="bg-primary border border-secondary text-primary rounded px-sm py-xxs text-xs focus:outline-none"
            >
              <option value="volume">Volume</option>
              <option value="oi">Open Interest</option>
              <option value="spread">Spread</option>
            </select>
          </div>

          <div className="flex items-center gap-xxs bg-tertiary p-xxs rounded border border-secondary text-xs">
            <button
              onClick={() => setParam('view', 'table')}
              className={`px-xs py-xxs rounded ${
                viewMode === 'table' ? 'bg-secondary text-primary font-bold' : 'text-quaternary'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setParam('view', 'cards')}
              className={`px-xs py-xxs rounded ${
                viewMode === 'cards' ? 'bg-secondary text-primary font-bold' : 'text-quaternary'
              }`}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Table Mode */}
      {viewMode === 'table' ? (
        <Panel noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                  <th className="py-xs px-sm w-8">★</th>
                  <th className="py-xs px-sm">Market Title</th>
                  <th className="py-xs px-sm">Category</th>
                  <th className="py-xs px-sm">Consensus Odds</th>
                  <th className="py-xs px-sm">Listing Venues</th>
                  <th className="py-xs px-sm">24h Vol</th>
                  <th className="py-xs px-sm">OI</th>
                  <th className="py-xs px-sm">Spread</th>
                  <th className="py-xs px-sm text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {filtered.map(m => (
                  <tr
                    key={m.id}
                    onClick={() => navigate(`/markets/${m.slug || m.id}`)}
                    className="hover:bg-secondary-hover cursor-pointer transition-colors"
                  >
                    <td className="py-sm px-sm" onClick={e => handleToggleWatchlist(m.id, e)}>
                      <Star
                        className={`size-3.5 ${
                          m.isWatchlisted ? 'text-warning-primary' : 'text-quaternary hover:text-primary'
                        }`}
                      />
                    </td>
                    <td className="py-sm px-sm font-medium text-primary">
                      <div className="truncate max-w-sm">{m.title}</div>
                      <div className="text-[10px] text-quaternary font-mono">
                        Ends: {m.endDate.substring(0, 10)}
                      </div>
                    </td>
                    <td className="py-sm px-sm">
                      <span className="text-xs px-xs py-none rounded-full bg-secondary border border-secondary text-secondary uppercase font-medium">
                        {m.category}
                      </span>
                    </td>
                    <td className="py-sm px-sm">
                      <div className="font-mono font-bold text-primary">
                        {(m.consensus * 100).toFixed(1)}¢ · {(m.consensus * 100).toFixed(1)}%
                      </div>
                      <div className="w-24 bg-tertiary h-1 rounded-full mt-xxs overflow-hidden">
                        <div
                          className="bg-brand-solid h-full"
                          style={{ width: `${m.consensus * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-sm px-sm">
                      <div className="flex items-center gap-xxs flex-wrap max-w-xs">
                        {m.quotes?.map((q: any) => {
                          const v = VENUE_MAP.get(q.venueId)
                          return (
                            <span
                              key={q.venueId}
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: v?.color || '#fff' }}
                              title={`${v?.name}: ${(q.lastPrice * 100).toFixed(1)}¢`}
                            />
                          )
                        })}
                      </div>
                    </td>
                    <td className="py-sm px-sm font-mono">{formatMoney(m.totalVolume)}</td>
                    <td className="py-sm px-sm font-mono text-tertiary">{formatMoney(m.totalOI)}</td>
                    <td className="py-sm px-sm font-mono">
                      {m.spread >= 5.0 ? (
                        <span className="text-utility-warning-700 font-bold">+{m.spread.toFixed(1)}pp</span>
                      ) : (
                        <span className="text-tertiary">+{m.spread.toFixed(1)}pp</span>
                      )}
                    </td>
                    <td className="py-sm px-sm text-right">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          navigate(`/trade?market=${m.slug || m.id}`)
                        }}
                        className="px-sm py-xxs bg-tertiary hover:bg-brand-solid hover:text-primary-on-brand rounded text-xs transition-colors font-mono font-bold"
                      >
                        Trade →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        /* Cards Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {filtered.map(m => (
            <div
              key={m.id}
              onClick={() => navigate(`/markets/${m.slug || m.id}`)}
              className="bg-primary border border-secondary hover:border-brand rounded-xl p-xl shadow-xs cursor-pointer transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-xs">
                  <span className="text-xs px-xs py-none rounded-full bg-secondary border border-secondary text-secondary uppercase font-medium">
                    {m.category}
                  </span>
                  <button onClick={e => handleToggleWatchlist(m.id, e)}>
                    <Star
                      className={`size-3.5 ${
                        m.isWatchlisted ? 'text-warning-primary' : 'text-quaternary'
                      }`}
                    />
                  </button>
                </div>
                <h4 className="text-sm font-semibold text-primary mb-sm leading-snug">{m.title}</h4>
              </div>

              <div className="space-y-xs pt-sm border-t border-secondary">
                <div className="flex items-center justify-between">
                  <span className="text-quaternary text-xs">Consensus:</span>
                  <span className="font-mono font-bold text-primary">
                    {(m.consensus * 100).toFixed(1)}¢ ({(m.consensus * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-brand-solid h-full"
                    style={{ width: `${m.consensus * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-mono pt-xxs">
                  <span className="text-tertiary">Vol: {formatMoney(m.totalVolume)}</span>
                  <span className="text-utility-warning-700 font-bold">Spread: +{m.spread.toFixed(1)}pp</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
