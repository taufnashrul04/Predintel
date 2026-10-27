import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts'
import { Panel, StatCard } from '../components/SharedUI'
import { formatMoney } from '../lib/formatters'
import { useApp } from '../context/AppContext'

export default function WalletDetailPage() {
  const { address } = useParams()
  const [profile, setProfile] = useState<any>(null)
  const navigate = useNavigate()
  const { showToast } = useApp()

  useEffect(() => {
    if (!address) return
    fetch(`/api/wallets/${address}`)
      .then(r => r.json())
      .then(d => setProfile(d))
      .catch(console.error)
  }, [address])

  if (!profile || !profile.wallet) {
    return <div className="p-xl text-center font-mono text-xs text-quaternary">Loading wallet profile...</div>
  }

  const { wallet, isFollowed, trades } = profile

  const handleToggleFollow = async () => {
    try {
      const res = await fetch(`/api/wallets/${wallet.address}/follow`, { method: 'POST' }).then(r => r.json())
      setProfile((prev: any) => ({ ...prev, isFollowed: res.followed }))
      showToast(res.followed ? `Now following ${wallet.address.slice(0, 6)}...` : 'Unfollowed')
    } catch (e) {
      console.error(e)
    }
  }

  // Radar chart data: accuracy by category (Spec Item 2)
  const radarData = [
    { category: 'Sports', score: Math.round((wallet.categoryAccuracy?.sports || 0.5) * 100) },
    { category: 'Politics', score: Math.round((wallet.categoryAccuracy?.politics || 0.5) * 100) },
    { category: 'Crypto', score: Math.round((wallet.categoryAccuracy?.crypto || 0.5) * 100) },
    { category: 'Culture', score: Math.round((wallet.categoryAccuracy?.culture || 0.5) * 100) },
    { category: 'Macro', score: Math.round((wallet.categoryAccuracy?.macro || 0.5) * 100) }
  ]

  return (
    <div className="space-y-md">
      <div className="flex items-center justify-between bg-primary border border-secondary p-xl rounded-xl shadow-xs">
        <div className="flex items-center gap-md">
          <button
            onClick={() => navigate('/wallets')}
            className="inline-flex items-center gap-xs rounded-lg bg-secondary px-md py-sm text-xs font-semibold text-secondary hover:text-primary transition-colors border border-secondary"
          >
            <ArrowLeft className="size-3.5" />
            <span>Wallets</span>
          </button>
          <div>
            <div className="flex items-center gap-xs">
              <span className="text-[10px] px-xs rounded bg-utility-brand-50 text-utility-brand-700 font-mono font-bold">
                {wallet.chain.toUpperCase()}
              </span>
              <span className="text-xs font-mono text-quaternary">{wallet.address}</span>
            </div>
            <h2 className="text-heading-xs font-bold text-primary mt-xxs">
              {wallet.label || 'Forecaster Profile'}
            </h2>
          </div>
        </div>

        <button
          onClick={handleToggleFollow}
          className={`inline-flex items-center gap-sm rounded-lg px-lg py-sm text-sm font-semibold transition-colors ${
            isFollowed
              ? 'bg-brand-solid text-primary-on-brand shadow-xs'
              : 'bg-primary border border-primary text-secondary hover:bg-secondary-hover'
          }`}
        >
          {isFollowed ? 'Following' : '+ Follow Forecaster'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
        <StatCard label="Credibility Score" value={wallet.credibilityScore} subtext="Brier calibrated" />
        <StatCard label="Win Rate" value={`${(wallet.winRate * 100).toFixed(0)}%`} subtext="Last 30 picks" />
        <StatCard label="Total Volume" value={formatMoney(wallet.totalVolume)} subtext="Across all venues" />
        <StatCard
          label="Realized PnL"
          value={`$${(wallet.realizedPnl / 1000).toFixed(1)}k`}
          changePositive={wallet.realizedPnl >= 0}
        />
      </div>

      {/* Accuracy Radar Chart + PnL History Line Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        {/* Radar Chart (Spec Item 2) */}
        <Panel title="Forecaster Domain Accuracy (Radar)" badge="SPECIALTY">
          <div className="h-60 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1F2933" />
                <PolarAngleAxis dataKey="category" stroke="#8B949E" fontSize={11} />
                <PolarRadiusAxis stroke="#5C6773" fontSize={10} domain={[0, 100]} />
                <Radar name="Accuracy" dataKey="score" stroke="#22D3EE" fill="#22D3EE" fillOpacity={0.3} />
                <Tooltip contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2933', fontSize: '11px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* PnL History Line Chart */}
        <Panel title="Cumulative PnL History (30 Days)" badge="PORTFOLIO">
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={wallet.pnlHistory}>
                <XAxis dataKey="t" stroke="#5C6773" fontSize={10} />
                <YAxis stroke="#5C6773" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2933', fontSize: '11px' }}
                />
                <Line type="monotone" dataKey="pnl" stroke="#00E5A0" strokeWidth={2} dot={false} name="PnL ($)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Open Positions Table (Spec Item 2) */}
      <Panel title="Open Positions" badge={`${wallet.positions?.length || 0} ACTIVE`} noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                <th className="py-xs px-sm">Market</th>
                <th className="py-xs px-sm">Outcome</th>
                <th className="py-xs px-sm">Shares</th>
                <th className="py-xs px-sm">Avg Price</th>
                <th className="py-xs px-sm">Current Price</th>
                <th className="py-xs px-sm text-right">Unrealized PnL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {wallet.positions?.map((pos: any, idx: number) => (
                <tr key={idx} className="hover:bg-secondary-hover transition-colors">
                  <td className="py-sm px-sm font-sans font-medium text-primary">{pos.eventTitle}</td>
                  <td className="py-sm px-sm font-bold text-utility-success-700">{pos.outcomeId.toUpperCase()}</td>
                  <td className="py-sm px-sm">{pos.shares}</td>
                  <td className="py-sm px-sm">{(pos.avgPrice * 100).toFixed(1)}¢</td>
                  <td className="py-sm px-sm font-bold">{(pos.currentPrice * 100).toFixed(1)}¢</td>
                  <td className={`py-sm px-sm text-right font-bold ${pos.pnl >= 0 ? 'text-utility-success-700' : 'text-utility-error-700'}`}>
                    {pos.pnl >= 0 ? `+$${pos.pnl}` : `-$${Math.abs(pos.pnl)}`}
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
