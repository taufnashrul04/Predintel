import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { Panel, TruncatedAddress } from '../components/SharedUI'
import { formatMoney } from '../lib/formatters'
import { useApp } from '../context/AppContext'

export default function LeaderboardPage() {
  const [wallets, setWallets] = useState<any[]>([])
  const [category, setCategory] = useState('all')
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | 'All'>('All')
  const navigate = useNavigate()
  const { showToast } = useApp()

  useEffect(() => {
    fetch(`/api/leaderboard?category=${category}`)
      .then(r => r.json())
      .then(d => setWallets(Array.isArray(d) ? d : []))
      .catch(console.error)
  }, [category])

  const handleToggleFollow = async (address: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/wallets/${address}/follow`, { method: 'POST' }).then(r => r.json())
      setWallets(prev =>
        prev.map(w => (w.address.toLowerCase() === address.toLowerCase() ? { ...w, isFollowed: res.followed } : w))
      )
      showToast(res.followed ? `Now following ${address.slice(0, 6)}...` : 'Unfollowed')
    } catch (e) {
      console.error(e)
    }
  }

  // Culture tab added (Spec Item 2)
  const categories = ['all', 'sports', 'politics', 'crypto', 'culture', 'macro']

  return (
    <div className="space-y-md">
      <div className="bg-primary border border-secondary rounded-xl p-xl shadow-xs flex flex-wrap items-center justify-between gap-md">
        <div>
          <h2 className="text-heading-xs font-bold text-primary">Forecaster Leaderboard</h2>
          <p className="text-xs text-secondary mt-xxs">
            Calibrated rankings backed by Brier score calculations stored in Walrus Memory.
          </p>
        </div>

        {/* Time range toggle: 7D / 30D / All (Spec Item 2) */}
        <div className="flex items-center gap-xs bg-secondary p-xxs rounded-md border border-secondary text-xs font-mono">
          <span className="text-quaternary px-xs">Range:</span>
          {(['7D', '30D', 'All'] as const).map(tr => (
            <button
              key={tr}
              onClick={() => setTimeRange(tr)}
              className={`px-sm py-xxs rounded ${
                timeRange === tr ? 'bg-brand-solid text-primary-on-brand font-bold' : 'text-quaternary hover:text-primary'
              }`}
            >
              {tr}
            </button>
          ))}
        </div>
      </div>

      {/* Category Tabs (tabs.md) including Culture */}
      <div className="flex gap-lg border-b border-secondary overflow-x-auto">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`border-b-2 px-md py-sm text-sm font-semibold uppercase transition-colors ${
              category === cat
                ? 'border-brand text-brand-primary'
                : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <Panel noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                <th className="py-xs px-sm w-12">Rank</th>
                <th className="py-xs px-sm">Forecaster</th>
                <th className="py-xs px-sm">Credibility</th>
                <th className="py-xs px-sm">Brier Score</th>
                <th className="py-xs px-sm">Win Rate</th>
                <th className="py-xs px-sm">Markets Traded</th>
                <th className="py-xs px-sm">Total Volume</th>
                <th className="py-xs px-sm text-right">Follow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {wallets.map((w: any, idx: number) => (
                <tr
                  key={w.address}
                  onClick={() => navigate(`/wallets/${w.address}`)}
                  className={`cursor-pointer transition-colors ${
                    idx < 3 ? 'bg-secondary/40 hover:bg-secondary' : 'hover:bg-secondary-hover'
                  }`}
                >
                  <td className="py-sm px-sm font-bold">
                    {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                  </td>
                  <td className="py-sm px-sm font-sans text-primary">
                    <div className="font-semibold flex items-center gap-xs">
                      <span>{w.label || 'Anonymous Quant'}</span>
                      {w.isFollowed && <Star className="size-3.5 text-warning-primary" />}
                    </div>
                    <TruncatedAddress address={w.address} />
                  </td>
                  <td className="py-sm px-sm text-brand-primary font-bold text-sm">
                    {w.credibilityScore}
                  </td>
                  <td className="py-sm px-sm text-tertiary">{w.brierScore.toFixed(3)}</td>
                  <td className="py-sm px-sm font-bold text-utility-success-700">
                    {(w.winRate * 100).toFixed(0)}%
                  </td>
                  <td className="py-sm px-sm">{w.marketsTraded}</td>
                  <td className="py-sm px-sm">{formatMoney(w.totalVolume)}</td>
                  <td className="py-sm px-sm text-right">
                    <button
                      onClick={e => handleToggleFollow(w.address, e)}
                      className={`px-sm py-xxs rounded text-xs transition-colors ${
                        w.isFollowed
                          ? 'bg-brand-solid text-primary-on-brand font-bold'
                          : 'bg-secondary text-quaternary hover:text-primary'
                      }`}
                    >
                      {w.isFollowed ? 'Following' : 'Follow'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
