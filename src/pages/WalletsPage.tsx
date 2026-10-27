import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Panel, TruncatedAddress } from '../components/SharedUI'
import { formatMoney } from '../lib/formatters'
import { useApp } from '../context/AppContext'

export default function WalletsPage() {
  const [wallets, setWallets] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { showToast } = useApp()

  const fetchWallets = () => {
    fetch('/api/wallets')
      .then(r => r.json())
      .then(d => setWallets(Array.isArray(d) ? d : []))
      .catch(console.error)
  }

  useEffect(() => {
    fetchWallets()
  }, [])

  const handleToggleFollow = async (address: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/wallets/${address}/follow`, { method: 'POST' }).then(r => r.json())
      setWallets(prev =>
        prev.map(w => (w.address.toLowerCase() === address.toLowerCase() ? { ...w, isFollowed: res.followed } : w))
      )
      showToast(res.followed ? `Now following ${address.slice(0, 6)}...` : `Unfollowed wallet`)
    } catch (err) {
      console.error(err)
    }
  }

  const filtered = wallets.filter(
    (w: any) =>
      w.address.toLowerCase().includes(search.toLowerCase()) ||
      (w.label && w.label.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-md">
      <div className="bg-primary border border-secondary rounded-xl p-xl shadow-xs flex items-center justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="size-3.5 text-fg-quaternary absolute left-sm top-2.5" />
          <input
            type="text"
            placeholder="Search wallet by address or label..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-secondary border border-secondary rounded-md pl-xl pr-sm py-xs text-xs text-primary placeholder:text-placeholder focus:outline-none"
          />
        </div>
        <div className="text-xs font-mono text-quaternary">{filtered.length} Tracked Forecasters</div>
      </div>

      <Panel title="Tracked Forecasters & Smart Wallets" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                <th className="py-xs px-sm">Forecaster</th>
                <th className="py-xs px-sm">Network</th>
                <th className="py-xs px-sm">Total Volume</th>
                <th className="py-xs px-sm">Realized PnL</th>
                <th className="py-xs px-sm">Win Rate</th>
                <th className="py-xs px-sm">Brier Score</th>
                <th className="py-xs px-sm">Credibility</th>
                <th className="py-xs px-sm text-right">Follow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {filtered.map(w => (
                <tr
                  key={w.address}
                  onClick={() => navigate(`/wallets/${w.address}`)}
                  className="hover:bg-secondary-hover cursor-pointer transition-colors"
                >
                  <td className="py-sm px-sm font-sans text-primary">
                    <div className="font-semibold flex items-center gap-xs">
                      <span>{w.label || 'Anonymous Quant'}</span>
                      {w.isWhale && (
                        <span className="text-[10px] px-xs rounded bg-utility-brand-50 text-utility-brand-700 font-mono">
                          WHALE
                        </span>
                      )}
                    </div>
                    <TruncatedAddress address={w.address} />
                  </td>
                  <td className="py-sm px-sm text-quaternary">{w.chain}</td>
                  <td className="py-sm px-sm">{formatMoney(w.totalVolume)}</td>
                  <td
                    className={`py-sm px-sm font-bold ${
                      w.realizedPnl >= 0 ? 'text-utility-success-700' : 'text-utility-error-700'
                    }`}
                  >
                    {w.realizedPnl >= 0 ? `+$${(w.realizedPnl / 1000).toFixed(1)}k` : `-$${(Math.abs(w.realizedPnl) / 1000).toFixed(1)}k`}
                  </td>
                  <td className="py-sm px-sm">{(w.winRate * 100).toFixed(0)}%</td>
                  <td className="py-sm px-sm text-tertiary">{w.brierScore.toFixed(3)}</td>
                  <td className="py-sm px-sm text-brand-primary font-bold text-sm">
                    {w.credibilityScore}
                  </td>
                  <td className="py-sm px-sm text-right">
                    <button
                      onClick={e => handleToggleFollow(w.address, e)}
                      className={`px-sm py-xxs rounded text-xs transition-colors font-sans ${
                        w.isFollowed
                          ? 'bg-brand-solid text-primary-on-brand font-semibold'
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
