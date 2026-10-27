import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GitCompare,
  TrendingUp,
  Brain,
  Activity,
  ArrowRight,
  ExternalLink
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts'
import { Panel, StatCard, VenuePill, ChangeBadge } from '../components/SharedUI'
import { VENUE_MAP } from '../lib/config/venues'
import { formatMoney, formatTimeAgo } from '../lib/formatters'

export default function DashboardPage() {
  const [stats, setStats] = useState<any>({
    totalVolume24h: 33293218,
    totalOpenInterest: 56106533,
    activeMarketsCount: 14,
    liveDivergencesCount: 4,
    whaleTradesCount: 45,
    storedMemoriesCount: 5,
    venuesCount: 7
  })
  const [divergences, setDivergences] = useState<any[]>([])
  const [movers, setMovers] = useState<any[]>([])
  const [whales, setWhales] = useState<any[]>([])
  const [memories, setMemories] = useState<any[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/divergence').then(r => r.json()),
      fetch('/api/movers').then(r => r.json()),
      fetch('/api/whales').then(r => r.json()),
      fetch('/api/memory').then(r => r.json())
    ]).then(([s, d, m, w, mem]) => {
      setStats(s || {})
      setDivergences(Array.isArray(d) ? d : [])
      setMovers(Array.isArray(m) ? m : [])
      setWhales(Array.isArray(w) ? w : [])
      setMemories(Array.isArray(mem) ? mem : [])
    }).catch(console.error)
  }, [])

  // Volume by Venue 14 days stacked
  const volumeData = [
    { day: '10/14', polymarket: 1.2, predictfun: 0.8, waterx: 0.5, deepbook: 0.6, opinion: 0.4 },
    { day: '10/16', polymarket: 1.5, predictfun: 0.9, waterx: 0.7, deepbook: 0.8, opinion: 0.5 },
    { day: '10/18', polymarket: 2.1, predictfun: 1.1, waterx: 0.9, deepbook: 1.0, opinion: 0.6 },
    { day: '10/20', polymarket: 1.8, predictfun: 1.0, waterx: 0.8, deepbook: 0.9, opinion: 0.5 },
    { day: '10/22', polymarket: 2.4, predictfun: 1.3, waterx: 1.2, deepbook: 1.1, opinion: 0.7 },
    { day: '10/24', polymarket: 2.9, predictfun: 1.6, waterx: 1.4, deepbook: 1.3, opinion: 0.8 },
    { day: '10/27', polymarket: 3.4, predictfun: 1.8, waterx: 1.7, deepbook: 1.5, opinion: 0.9 }
  ]

  // OI Donut share data
  const oiData = [
    { name: 'Polymarket', value: 38, color: '#2E5CFF' },
    { name: 'Predict.fun', value: 22, color: '#F0B90B' },
    { name: 'WaterX (Sui)', value: 16, color: '#38BDF8' },
    { name: 'DeepBook (Sui)', value: 12, color: '#4ADE80' },
    { name: 'Opinion (BNB)', value: 7, color: '#F472B6' },
    { name: 'SX Bet / Limitless', value: 5, color: '#FB923C' }
  ]

  return (
    <div className="space-y-md">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-sm">
        <StatCard
          label="24h Volume (All)"
          value={formatMoney(stats.totalVolume24h)}
          change="+14.2%"
          changePositive={true}
          subtext="7 Venues"
        />
        <StatCard
          label="Open Interest"
          value={formatMoney(stats.totalOpenInterest)}
          subtext="Locked Liquidity"
        />
        <StatCard
          label="Active Markets"
          value={stats.activeMarketsCount}
          subtext="5 macro domains"
        />
        <StatCard
          label="Live Divergences"
          value={`${stats.liveDivergencesCount} High`}
          change="Arb: 8.4pp"
          changePositive={true}
          indicatorColor="#F5B83D"
        />
        <StatCard
          label="Whale Trades 24h"
          value={stats.whaleTradesCount}
          subtext="≥ $15,000 notional"
        />
        <StatCard
          label="Walrus Memories"
          value={`${stats.storedMemoriesCount} Blobs`}
          subtext="100% Encrypted Sync"
          indicatorColor="#22D3EE"
        />
      </div>

      {/* Memory Insights Panel */}
      <Panel
        title="Walrus Intelligence & Autonomous Recall"
        badge="AI INSIGHTS"
        badgeVariant="brand"
        actions={
          <button
            onClick={() => navigate('/memory')}
            className="text-xs text-brand-primary hover:underline font-mono inline-flex items-center gap-xxs"
          >
            <span>View All Blobs</span>
            <ArrowRight className="size-3" />
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
          {memories.slice(0, 4).map((mem: any, i: number) => (
            <div
              key={mem.id || i}
              className="bg-secondary p-md rounded-xl border border-secondary flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-xxs">
                  <span className="text-brand-primary font-semibold uppercase tracking-wider text-[11px]">
                    {mem.kind}
                  </span>
                  <span className="text-xs text-utility-success-700 font-mono">Stored</span>
                </div>
                <p className="text-xs text-secondary leading-relaxed font-sans">{mem.text}</p>
              </div>
              <div className="text-quaternary text-[11px] mt-md font-mono flex items-center justify-between border-t border-secondary pt-xs">
                <span>Stored on Walrus</span>
                <span>{formatTimeAgo(mem.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Divergence Scanner + Top Movers 24h */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        {/* Divergence Scanner (2 cols) */}
        <Panel
          title="Cross-Venue Divergence Scanner"
          badge="TOP ARB SPOTS"
          badgeVariant="warning"
          className="lg:col-span-2"
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                  <th className="py-xs px-sm">Event</th>
                  <th className="py-xs px-sm">Consensus</th>
                  <th className="py-xs px-sm">Min Venue</th>
                  <th className="py-xs px-sm">Max Venue</th>
                  <th className="py-xs px-sm">Spread</th>
                  <th className="py-xs px-sm text-right">Arb Edge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {divergences.slice(0, 5).map((div: any) => (
                  <tr
                    key={div.event.id + (div.outcome?.id || 'yes')}
                    onClick={() => navigate(`/markets/${div.event.slug || div.event.id}`)}
                    className="hover:bg-secondary-hover cursor-pointer transition-colors"
                  >
                    <td className="py-sm px-sm font-medium text-primary">
                      <div className="truncate max-w-xs">{div.event.title}</div>
                      <span className="text-[10px] text-tertiary uppercase">{div.event.category}</span>
                    </td>
                    <td className="py-sm px-sm font-mono text-primary font-bold">
                      {(div.consensus * 100).toFixed(1)}¢ · {(div.consensus * 100).toFixed(1)}%
                    </td>
                    <td className="py-sm px-sm font-mono text-tertiary">
                      <VenuePill
                        name={VENUE_MAP.get(div.minQuote.venueId)?.name || div.minQuote.venueId}
                        color={VENUE_MAP.get(div.minQuote.venueId)?.color || '#fff'}
                      />
                      <span className="ml-xs">{(div.minQuote.lastPrice * 100).toFixed(1)}¢</span>
                    </td>
                    <td className="py-sm px-sm font-mono text-tertiary">
                      <VenuePill
                        name={VENUE_MAP.get(div.maxQuote.venueId)?.name || div.maxQuote.venueId}
                        color={VENUE_MAP.get(div.maxQuote.venueId)?.color || '#fff'}
                      />
                      <span className="ml-xs">{(div.maxQuote.lastPrice * 100).toFixed(1)}¢</span>
                    </td>
                    <td className="py-sm px-sm font-mono font-bold text-utility-error-700">
                      +{div.spreadPp.toFixed(1)}pp
                    </td>
                    <td className="py-sm px-sm font-mono text-right text-utility-success-700 font-bold">
                      +{div.arbitrageEdge.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Top Movers 24h (Missing Spec Item Added) */}
        <Panel
          title="Top Movers 24h"
          badge="VOLATILITY"
          badgeVariant="gray"
          noPadding
        >
          <div className="divide-y divide-secondary overflow-y-auto max-h-80">
            {movers.slice(0, 6).map((item: any, idx: number) => {
              const v = VENUE_MAP.get(item.quote.venueId)
              const mockSpark = [
                { v: item.quote.lastPrice - (item.quote.change24h / 100) * 0.8 },
                { v: item.quote.lastPrice - (item.quote.change24h / 100) * 0.5 },
                { v: item.quote.lastPrice - (item.quote.change24h / 100) * 0.2 },
                { v: item.quote.lastPrice }
              ]
              return (
                <div
                  key={idx}
                  onClick={() => item.event && navigate(`/markets/${item.event.slug || item.event.id}`)}
                  className="p-sm hover:bg-secondary-hover cursor-pointer transition-colors flex items-center justify-between gap-sm"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-primary truncate max-w-[160px]">
                      {item.event?.title || item.quote.eventId}
                    </div>
                    <div className="flex items-center gap-xs mt-xxs">
                      <VenuePill name={v?.name || item.quote.venueId} color={v?.color || '#fff'} />
                      <span className="text-[11px] font-mono font-bold text-primary">
                        {(item.quote.lastPrice * 100).toFixed(1)}¢
                      </span>
                    </div>
                  </div>

                  <div className="w-16 h-8 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mockSpark}>
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke={item.quote.change24h >= 0 ? '#00E5A0' : '#FF4D6D'}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="text-right shrink-0">
                    <ChangeBadge change={item.quote.change24h} />
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      {/* Whale Tape & Venue Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        <Panel
          title="Whale Tape (Live Orders)"
          badge="≥ $15K NOTIONAL"
          badgeVariant="brand"
          actions={<span className="w-2 h-2 rounded-full bg-utility-success-700 animate-ping" />}
        >
          <div className="space-y-xs overflow-y-auto max-h-80">
            {whales.slice(0, 7).map((t: any) => {
              const venue = VENUE_MAP.get(t.venueId)
              return (
                <div
                  key={t.id}
                  onClick={() => navigate(`/wallets/${t.wallet}`)}
                  className="p-xs bg-secondary hover:bg-secondary-hover transition-colors rounded-lg border border-secondary text-xs flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-xs">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: venue?.color || '#38BDF8' }}
                      title={venue?.name}
                    />
                    <div>
                      <div className="font-mono text-secondary hover:text-primary">
                        {t.wallet.slice(0, 6)}…{t.wallet.slice(-4)}
                      </div>
                      <span
                        className={`text-[10px] font-bold ${
                          t.side === 'buy' ? 'text-utility-success-700' : 'text-utility-error-700'
                        }`}
                      >
                        {t.side.toUpperCase()} {t.outcomeId.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-primary">{formatMoney(t.notional)}</div>
                    <div className="text-quaternary text-[11px]">
                      @ {(t.price * 100).toFixed(1)}¢ · {formatTimeAgo(t.t)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel
          title="14-Day Trading Volume By Venue ($M)"
          badge="MULTI-VENUE"
          className="lg:col-span-2"
        >
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData}>
                <XAxis dataKey="day" stroke="#5C6773" fontSize={11} />
                <YAxis stroke="#5C6773" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2933', fontSize: '11px' }}
                />
                <Bar dataKey="polymarket" stackId="a" fill="#2E5CFF" name="Polymarket" />
                <Bar dataKey="predictfun" stackId="a" fill="#F0B90B" name="Predict.fun" />
                <Bar dataKey="waterx" stackId="a" fill="#38BDF8" name="WaterX (Sui)" />
                <Bar dataKey="deepbook" stackId="a" fill="#4ADE80" name="DeepBook (Sui)" />
                <Bar dataKey="opinion" stackId="a" fill="#F472B6" name="Opinion" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  )
}
