import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Zap,
  Shield,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  Clock,
  RotateCcw
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area
} from 'recharts'
import { Panel, StatCard, VenuePill } from '../components/SharedUI'
import { VENUE_MAP } from '../lib/config/venues'
import { formatMoney, formatTimeAgo } from '../lib/formatters'
import { useApp } from '../context/AppContext'

export default function TradePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useApp()

  // Markets list
  const [markets, setMarkets] = useState<any[]>([])
  const [selectedMarketSlug, setSelectedMarketSlug] = useState<string>(
    searchParams.get('market') || 'btc-above-150k-dec-31'
  )
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>(
    searchParams.get('outcome') || 'yes'
  )

  // Order Ticket State
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [amount, setAmount] = useState<string>('100')
  const [limitPrice, setLimitPrice] = useState<string>('0.50')
  const [splitAcrossVenues, setSplitAcrossVenues] = useState<boolean>(false)
  const [execMode, setExecMode] = useState<'direct' | 'agent'>('agent')

  // Smart routing quote result
  const [quote, setQuote] = useState<any>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  // Execution status
  const [executionStatus, setExecutionStatus] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)

  // Agent Wallet & Rules State
  const [agentWallet, setAgentWallet] = useState<any>(null)
  const [agentRulesOpen, setAgentRulesOpen] = useState(false)
  const [depositModalOpen, setDepositModalOpen] = useState(false)
  const [depositAmt, setDepositAmt] = useState('500')

  // Bottom Tabs: Open Orders, Positions, Trade History
  const [bottomTab, setBottomTab] = useState<'orders' | 'positions' | 'history'>('positions')
  const [orders, setOrders] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])

  // Market Order Book and History for center panel
  const [orderBook, setOrderBook] = useState<any>(null)
  const [historyPoints, setHistoryPoints] = useState<any[]>([])
  const [selectedVenue, setSelectedVenue] = useState<string>('deepbook')

  // Load markets
  useEffect(() => {
    fetch('/api/markets')
      .then(r => r.json())
      .then(m => {
        setMarkets(Array.isArray(m) ? m : [])
        if (!selectedMarketSlug && m.length > 0) {
          setSelectedMarketSlug(m[0].slug || m[0].id)
        }
      })
      .catch(console.error)
  }, [])

  // Load agent wallet state & bottom tables
  const reloadUserData = () => {
    fetch('/api/agent').then(r => r.json()).then(setAgentWallet).catch(() => {})
    fetch('/api/trade/orders').then(r => r.json()).then(o => setOrders(Array.isArray(o) ? o : [])).catch(() => {})
    fetch('/api/trade/positions').then(r => r.json()).then(p => setPositions(Array.isArray(p) ? p : [])).catch(() => {})
    fetch('/api/trade/history').then(r => r.json()).then(h => setHistory(Array.isArray(h) ? h : [])).catch(() => {})
  }

  useEffect(() => {
    reloadUserData()
  }, [])

  const currentMarket = markets.find(m => m.slug === selectedMarketSlug || m.id === selectedMarketSlug)

  // Fetch quote whenever parameters change
  useEffect(() => {
    if (!currentMarket) return
    setQuoteLoading(true)
    setQuoteError(null)

    const url = `/api/trade/quote?market=${currentMarket.id}&outcome=${selectedOutcomeId}&side=${side}&amount=${amount}&type=${orderType}&limitPrice=${limitPrice}&split=${splitAcrossVenues}`
    fetch(url)
      .then(r => {
        if (!r.ok) return r.json().then(e => { throw new Error(e.error) })
        return r.json()
      })
      .then(d => {
        setQuote(d)
        setQuoteLoading(false)
      })
      .catch(err => {
        setQuoteError(err.message)
        setQuoteLoading(false)
      })
  }, [selectedMarketSlug, selectedOutcomeId, side, orderType, amount, limitPrice, splitAcrossVenues, currentMarket])

  // Fetch center panel chart & orderbook
  useEffect(() => {
    if (!currentMarket) return
    const eventId = currentMarket.id

    fetch(`/api/markets/${eventId}/history?outcomeId=${selectedOutcomeId}&range=24H`)
      .then(r => r.json())
      .then(pts => setHistoryPoints(Array.isArray(pts) ? pts : []))
      .catch(console.error)

    fetch(`/api/markets/${eventId}/orderbook?outcomeId=${selectedOutcomeId}&venueId=${selectedVenue}`)
      .then(r => r.json())
      .then(obRes => setOrderBook(obRes.orderBook))
      .catch(console.error)
  }, [currentMarket, selectedOutcomeId, selectedVenue])

  // Execute trade
  const handleConfirmTrade = async () => {
    if (!quote || !quote.bestRoute) return
    setIsSubmitting(true)
    setConfirmModalOpen(false)

    try {
      if (execMode === 'agent') {
        // Agent mode x402
        const res = await fetch('/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: currentMarket.id,
            venueId: quote.bestRoute.venueId,
            outcomeId: selectedOutcomeId,
            side,
            amount: parseFloat(amount)
          })
        }).then(r => {
          if (!r.ok) return r.json().then(e => { throw new Error(e.error) })
          return r.json()
        })

        setExecutionStatus({
          id: res.id,
          status: 'pending',
          mode: 'Agent (x402 · Sui)',
          venue: quote.bestRoute.venueName,
          amount: parseFloat(amount),
          shares: quote.totalShares
        })
        showToast('Autonomous Agent Trade Dispatched on Sui')

        // Poll confirmation
        const timer = setInterval(async () => {
          const check = await fetch(`/api/execute/${res.id}`).then(r => r.json())
          if (check.status === 'confirmed') {
            clearInterval(timer)
            setIsSubmitting(false)
            setExecutionStatus((prev: any) => ({ ...prev, status: 'confirmed', txDigest: check.txDigest }))
            showToast(`Agent Confirmed: Tx ${check.txDigest.slice(0, 10)}...`)
            reloadUserData()
          }
        }, 1000)
      } else {
        // Direct Mode
        const res = await fetch('/api/trade/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketTitle: currentMarket.title,
            outcomeId: selectedOutcomeId,
            venueId: quote.bestRoute.venueId,
            side,
            amount: parseFloat(amount),
            price: quote.avgFillPrice,
            shares: quote.totalShares
          })
        }).then(r => r.json())

        setIsSubmitting(false)
        setExecutionStatus({
          status: 'confirmed',
          mode: 'Direct (User Signed)',
          venue: quote.bestRoute.venueName,
          amount: parseFloat(amount),
          shares: quote.totalShares,
          txDigest: res.txDigest
        })
        showToast('Direct Move Call Confirmed on Sui')
        reloadUserData()
      }
    } catch (err: any) {
      setIsSubmitting(false)
      showToast(`Trade Failed: ${err.message}`)
      setExecutionStatus({ status: 'failed', reason: err.message })
    }
  }

  // Handle agent deposit
  const handleAgentDeposit = async () => {
    try {
      await fetch('/api/agent/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(depositAmt) || 500 })
      })
      showToast('Agent Vault Re-funded')
      setDepositModalOpen(false)
      reloadUserData()
    } catch (e) {
      console.error(e)
    }
  }

  // Quick amount chips
  const quickChips = [10, 50, 100, 500]

  return (
    <div className="space-y-md">
      {/* Agent Wallet Top Bar (Collapsible) */}
      <div className="bg-primary border border-secondary rounded-xl p-md shadow-xs flex flex-wrap items-center justify-between gap-md">
        <div className="flex items-center gap-md">
          <div className="p-xs bg-utility-brand-50 border border-utility-brand-200 rounded-lg text-brand-primary">
            <Zap className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-xs">
              <span className="text-xs font-bold text-primary">Autonomous Sui Agent Vault (x402)</span>
              <span className="text-[10px] px-xs rounded bg-utility-success-50 text-utility-success-700 font-mono font-bold">
                ACTIVE
              </span>
            </div>
            <div className="text-xs font-mono text-quaternary truncate max-w-sm">
              {agentWallet?.address || '0x3a7e...c89f'} (Sui Mainnet)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-lg">
          <div className="text-right font-mono text-xs">
            <div className="text-quaternary">Vault Balance:</div>
            <div className="text-primary font-bold">
              ${agentWallet?.balanceUSDC?.toFixed(2) || '2,450.00'} USDC · {agentWallet?.balanceSUI || '128.5'} SUI
            </div>
          </div>
          <div className="text-right font-mono text-xs">
            <div className="text-quaternary">Today's Spend:</div>
            <div className="text-utility-warning-700 font-bold">
              ${agentWallet?.spentToday || '1,350'} / ${agentWallet?.dailyBudget || '5,000'}
            </div>
          </div>
          <div className="flex items-center gap-xs">
            <button
              onClick={() => setDepositModalOpen(true)}
              className="px-md py-xs bg-brand-solid text-primary-on-brand font-bold text-xs rounded-lg hover:bg-brand-solid-hover shadow-xs"
            >
              + Deposit
            </button>
            <button
              onClick={() => setAgentRulesOpen(!agentRulesOpen)}
              className="px-md py-xs bg-secondary border border-secondary text-primary font-bold text-xs rounded-lg hover:bg-secondary-hover"
            >
              Rules
            </button>
          </div>
        </div>
      </div>

      {/* Agent Rules Collapsible Panel */}
      {agentRulesOpen && (
        <div className="p-md bg-secondary border border-secondary rounded-xl text-xs font-mono space-y-sm animate-in fade-in">
          <div className="flex items-center justify-between font-bold text-primary">
            <span>Autonomous Risk Parameters</span>
            <span className="text-utility-success-700">Auto-Arbitrage Active</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
            <div className="p-xs bg-primary rounded border border-secondary">
              <span className="text-quaternary block">Max per Trade:</span>
              <span className="font-bold text-primary">${agentWallet?.rules?.maxPerTrade || '1,000'}</span>
            </div>
            <div className="p-xs bg-primary rounded border border-secondary">
              <span className="text-quaternary block">Daily Budget:</span>
              <span className="font-bold text-primary">${agentWallet?.rules?.dailyBudget || '5,000'}</span>
            </div>
            <div className="p-xs bg-primary rounded border border-secondary">
              <span className="text-quaternary block">Allowed Venues:</span>
              <span className="font-bold text-primary">WaterX, DeepBook (Sui)</span>
            </div>
            <div className="p-xs bg-primary rounded border border-secondary">
              <span className="text-quaternary block">Auto-Arb Min Spread:</span>
              <span className="font-bold text-utility-warning-700">≥ 6.0pp</span>
            </div>
          </div>
        </div>
      )}

      {/* 3-Column Trading Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        {/* Left Column (3 cols): Market Picker & Outcomes */}
        <div className="lg:col-span-3 space-y-md">
          <Panel title="Market Selector" badge="14 ACTIVE" noPadding>
            <div className="divide-y divide-secondary max-h-[500px] overflow-y-auto">
              {markets.map(m => {
                const isSelected = m.slug === selectedMarketSlug || m.id === selectedMarketSlug
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedMarketSlug(m.slug || m.id)
                      setSelectedOutcomeId(m.outcomes[0].id)
                    }}
                    className={`w-full text-left p-sm transition-colors flex flex-col justify-between ${
                      isSelected ? 'bg-secondary font-semibold' : 'hover:bg-secondary-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-quaternary uppercase mb-xxs">
                      <span>{m.category}</span>
                      <span className="font-mono text-primary font-bold">
                        {(m.consensus * 100).toFixed(1)}¢
                      </span>
                    </div>
                    <div className="text-xs text-primary leading-snug line-clamp-2">{m.title}</div>
                  </button>
                )
              })}
            </div>
          </Panel>

          {/* Outcome Selector */}
          {currentMarket && (
            <Panel title="Outcome Selection" badge={currentMarket.outcomes.length > 2 ? 'MULTI' : 'BINARY'}>
              <div className="space-y-xs">
                {currentMarket.outcomes.map((o: any) => (
                  <button
                    key={o.id}
                    onClick={() => setSelectedOutcomeId(o.id)}
                    className={`w-full flex items-center justify-between p-sm rounded-lg border text-xs font-mono transition-colors ${
                      selectedOutcomeId === o.id
                        ? 'border-brand bg-utility-brand-50 text-utility-brand-700 font-bold'
                        : 'border-secondary bg-secondary text-primary hover:bg-secondary-hover'
                    }`}
                  >
                    <span>{o.label}</span>
                    <span>{(currentMarket.consensus * 100).toFixed(1)}¢</span>
                  </button>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* Center Column (5 cols): Live Chart & Order Book Depth */}
        <div className="lg:col-span-5 space-y-md">
          {/* Price Chart with Venue Lines + Consensus */}
          <Panel
            title={`Odds Trend — ${currentMarket?.title || ''}`}
            badge="24H VWAP"
            actions={
              <span className="font-mono text-xs font-bold text-brand-primary">
                {((quote?.consensusPrice || 0.5) * 100).toFixed(1)}¢
              </span>
            }
          >
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyPoints}>
                  <XAxis dataKey="t" stroke="#5C6773" fontSize={10} tickFormatter={t => t.substring(11, 16)} />
                  <YAxis domain={['auto', 'auto']} stroke="#5C6773" fontSize={10} unit="¢" />
                  <Tooltip contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2933', fontSize: '11px' }} />
                  <Line type="monotone" dataKey="consensus" stroke="#22D3EE" strokeWidth={3} dot={false} name="Consensus" />
                  <Line type="monotone" dataKey="waterx" stroke="#38BDF8" strokeWidth={1.5} dot={false} name="WaterX" />
                  <Line type="monotone" dataKey="deepbook" stroke="#4ADE80" strokeWidth={1.5} dot={false} name="DeepBook" />
                  <Line type="monotone" dataKey="polymarket" stroke="#2E5CFF" strokeWidth={1.5} dot={false} name="Polymarket" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {/* Venue Order Book & Depth Ladder */}
          <Panel
            title="Order Book Switcher"
            badge="DEPTH"
            actions={
              <select
                value={selectedVenue}
                onChange={e => setSelectedVenue(e.target.value)}
                className="bg-secondary border border-secondary rounded px-sm py-xxs text-xs font-mono text-primary focus:outline-none"
              >
                <option value="waterx">WaterX (Sui AMM)</option>
                <option value="deepbook">DeepBook (Sui Book)</option>
                <option value="polymarket">Polymarket (Polygon)</option>
                <option value="predictfun">Predict.fun (BNB)</option>
              </select>
            }
            noPadding
          >
            <div className="p-sm text-[11px] font-mono flex flex-col justify-between h-56">
              <div className="space-y-0.5 overflow-hidden">
                {orderBook?.asks?.slice(0, 4).reverse().map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-utility-error-700 px-xs hover:bg-secondary">
                    <span>{(a.price * 100).toFixed(1)}¢</span>
                    <span className="text-quaternary">{a.size}</span>
                    <span className="text-secondary">{a.total}</span>
                  </div>
                ))}
              </div>

              <div className="py-xxs px-xs bg-secondary border-y border-secondary text-center text-xs text-primary font-bold">
                Mid: {((orderBook?.midPrice || 0.5) * 100).toFixed(1)}¢ · Spread: {orderBook?.spread || 0.008}
              </div>

              <div className="space-y-0.5 overflow-hidden">
                {orderBook?.bids?.slice(0, 4).map((b: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-utility-success-700 px-xs hover:bg-secondary">
                    <span>{(b.price * 100).toFixed(1)}¢</span>
                    <span className="text-quaternary">{b.size}</span>
                    <span className="text-secondary">{b.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        {/* Right Column (4 cols): THE ORDER TICKET */}
        <div className="lg:col-span-4 space-y-md">
          <Panel title="Smart Order Ticket" badge={execMode === 'agent' ? 'AGENT x402' : 'DIRECT'}>
            <div className="space-y-sm text-xs font-mono">
              {/* Execution Mode Switch */}
              <div className="grid grid-cols-2 gap-xs bg-secondary p-xxs rounded-lg border border-secondary">
                <button
                  onClick={() => setExecMode('agent')}
                  className={`py-xs rounded text-xs font-bold transition-colors ${
                    execMode === 'agent'
                      ? 'bg-brand-solid text-primary-on-brand shadow-xs'
                      : 'text-quaternary hover:text-primary'
                  }`}
                >
                  Agent (x402 · Sui)
                </button>
                <button
                  onClick={() => setExecMode('direct')}
                  className={`py-xs rounded text-xs font-bold transition-colors ${
                    execMode === 'direct'
                      ? 'bg-brand-solid text-primary-on-brand shadow-xs'
                      : 'text-quaternary hover:text-primary'
                  }`}
                >
                  Direct (Sui Wallet)
                </button>
              </div>

              {/* Side: Buy / Sell */}
              <div className="grid grid-cols-2 gap-sm">
                <button
                  onClick={() => setSide('buy')}
                  className={`inline-flex items-center justify-center rounded-lg px-lg py-sm text-sm font-semibold uppercase transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    side === 'buy'
                      ? 'border border-utility-success-200 bg-utility-success-50 text-utility-success-700 shadow-xs'
                      : 'border border-primary bg-primary text-secondary hover:bg-secondary-hover'
                  }`}
                >
                  BUY YES
                </button>
                <button
                  onClick={() => setSide('sell')}
                  className={`inline-flex items-center justify-center rounded-lg px-lg py-sm text-sm font-semibold uppercase transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    side === 'sell'
                      ? 'border border-utility-error-200 bg-utility-error-50 text-utility-error-700 shadow-xs'
                      : 'border border-primary bg-primary text-secondary hover:bg-secondary-hover'
                  }`}
                >
                  SELL NO
                </button>
              </div>

              {/* Order Type: Market / Limit */}
              <div className="flex items-center justify-between text-xs font-sans">
                <span className="text-secondary font-medium">Order Type:</span>
                <div className="flex items-center gap-xs">
                  <button
                    onClick={() => setOrderType('market')}
                    className={`px-sm py-xxs rounded ${orderType === 'market' ? 'bg-brand-solid text-primary-on-brand font-bold' : 'bg-secondary text-quaternary'}`}
                  >
                    Market
                  </button>
                  <button
                    onClick={() => setOrderType('limit')}
                    className={`px-sm py-xxs rounded ${orderType === 'limit' ? 'bg-brand-solid text-primary-on-brand font-bold' : 'bg-secondary text-quaternary'}`}
                  >
                    Limit
                  </button>
                </div>
              </div>

              {/* Limit Price if active */}
              {orderType === 'limit' && (
                <div className="flex flex-col gap-sm">
                  <label className="text-sm font-medium text-secondary">Limit Price ($0.01 - $0.99)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="0.99"
                    value={limitPrice}
                    onChange={e => setLimitPrice(e.target.value)}
                    className="rounded-md bg-primary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring font-mono"
                  />
                </div>
              )}

              {/* Amount Input with Quick Chips */}
              <div className="flex flex-col gap-sm">
                <label className="text-sm font-medium text-secondary">Amount (USDC)</label>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="rounded-md bg-primary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring font-mono"
                />
                <div className="flex items-center gap-xs">
                  {quickChips.map(c => (
                    <button
                      key={c}
                      onClick={() => setAmount(c.toString())}
                      className="inline-flex items-center rounded-lg bg-primary px-md py-xs text-xs font-semibold text-secondary border border-primary shadow-xs hover:bg-secondary-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      ${c}
                    </button>
                  ))}
                  <button
                    onClick={() => setAmount('1000')}
                    className="inline-flex items-center rounded-lg bg-primary px-md py-xs text-xs font-semibold text-brand-primary border border-primary shadow-xs hover:bg-secondary-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Split across venues toggle */}
              <div className="flex items-center justify-between p-xs bg-secondary rounded border border-secondary">
                <span className="text-primary font-sans text-xs">Split Across Venues (Deep Fill)</span>
                <input
                  type="checkbox"
                  checked={splitAcrossVenues}
                  onChange={e => setSplitAcrossVenues(e.target.checked)}
                  className="accent-cyan-400 size-4"
                />
              </div>

              {/* Smart Routing Table */}
              {quote && (
                <div className="space-y-xs">
                  <div className="text-quaternary uppercase text-[11px] font-semibold">Available Venue Routes</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {quote.routes?.map((r: any) => {
                      const isBest = quote.bestRoute?.venueId === r.venueId
                      return (
                        <div
                          key={r.venueId}
                          className={`p-xs rounded border text-[11px] flex items-center justify-between ${
                            isBest ? 'border-brand bg-utility-brand-50 text-utility-brand-700 font-bold' : 'border-secondary bg-secondary text-primary'
                          }`}
                        >
                          <div className="flex items-center gap-xs">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.venueColor }} />
                            <span>{r.venueName}</span>
                            {isBest && <span className="text-[10px] text-brand-primary">(BEST)</span>}
                          </div>
                          <div>{(r.price * 100).toFixed(1)}¢ · {r.estimatedShares} sh</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Trade Preview Breakdown */}
              {quote && (
                <div className="p-xs bg-secondary rounded border border-secondary space-y-xxs text-[11px]">
                  <div className="flex items-center justify-between text-quaternary">
                    <span>Avg Fill Price:</span>
                    <span className="text-primary font-bold">{(quote.avgFillPrice * 100).toFixed(1)}¢</span>
                  </div>
                  <div className="flex items-center justify-between text-quaternary">
                    <span>Est. Shares:</span>
                    <span className="text-primary font-bold">{quote.totalShares} Shares</span>
                  </div>
                  <div className="flex items-center justify-between text-quaternary">
                    <span>Max Payout:</span>
                    <span className="text-utility-success-700 font-bold">${quote.maxPayout?.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-quaternary">
                    <span>Potential Profit:</span>
                    <span className="text-utility-success-700 font-bold">+${quote.potentialProfit?.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-quaternary">
                    <span>Consensus Gap:</span>
                    <span className={quote.consensusGapPp <= 0 ? 'text-utility-success-700' : 'text-utility-error-700'}>
                      {quote.consensusGapPp <= 0 ? `${quote.consensusGapPp}pp under consensus` : `+${quote.consensusGapPp}pp over`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-quaternary">
                    <span>Fees &amp; Slippage:</span>
                    <span className="text-primary">${quote.totalFees?.toFixed(2)} · {quote.slippagePct}%</span>
                  </div>
                </div>
              )}

              {quoteError && (
                <div className="p-xs bg-utility-error-50 border border-utility-error-200 text-utility-error-700 rounded text-xs">
                  {quoteError}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={() => setConfirmModalOpen(true)}
                disabled={isSubmitting || !quote}
                className="w-full inline-flex items-center justify-center gap-sm rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-sm font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover disabled:opacity-50"
              >
                <Zap className="size-4 shrink-0" />
                <span>
                  {isSubmitting
                    ? 'Executing Order...'
                    : execMode === 'agent'
                    ? 'Execute Via Agent (x402)'
                    : 'Sign & Submit (Direct Move)'}
                </span>
              </button>

              {/* Status Card */}
              {executionStatus && (
                <div className="p-xs bg-primary border border-secondary rounded-lg text-xs font-mono space-y-xxs">
                  <div className="flex items-center justify-between">
                    <span className="text-quaternary">Execution Result:</span>
                    <span
                      className={`font-bold ${
                        executionStatus.status === 'confirmed'
                          ? 'text-utility-success-700'
                          : executionStatus.status === 'pending'
                          ? 'text-utility-warning-700 animate-pulse'
                          : 'text-utility-error-700'
                      }`}
                    >
                      {executionStatus.status.toUpperCase()}
                    </span>
                  </div>
                  {executionStatus.txDigest && (
                    <div className="text-[11px] text-quaternary flex items-center justify-between">
                      <span className="truncate max-w-[180px]">Digest: {executionStatus.txDigest}</span>
                      <a
                        href={`https://suiscan.xyz/mainnet/tx/${executionStatus.txDigest}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-primary hover:underline inline-flex items-center gap-xxs"
                      >
                        <span>Suiscan</span>
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* Confirmation Dialog (dialog.md) */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-md">
          <div className="fixed inset-0 bg-overlay opacity-70" onClick={() => setConfirmModalOpen(false)}></div>
          <div className="relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-lg bg-primary shadow-2xl border border-secondary">
            <header className="flex items-center justify-between border-b border-secondary p-xl">
              <h2 className="text-lg font-semibold text-primary">Confirm Trade Order</h2>
            </header>
            <div className="p-xl space-y-sm text-xs font-mono">
              <div className="p-sm bg-secondary rounded border border-secondary space-y-xxs">
                <div className="flex justify-between text-quaternary">
                  <span>Market:</span>
                  <span className="text-primary font-bold">{currentMarket?.title}</span>
                </div>
                <div className="flex justify-between text-quaternary">
                  <span>Side &amp; Outcome:</span>
                  <span className="text-utility-success-700 font-bold">
                    {side.toUpperCase()} {selectedOutcomeId.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between text-quaternary">
                  <span>Amount:</span>
                  <span className="text-primary font-bold">${amount} USDC</span>
                </div>
                <div className="flex justify-between text-quaternary">
                  <span>Best Route:</span>
                  <span className="text-brand-primary font-bold">{quote?.bestRoute?.venueName}</span>
                </div>
                <div className="flex justify-between text-quaternary">
                  <span>Mode:</span>
                  <span className="text-primary font-bold">
                    {execMode === 'agent' ? 'Autonomous Sui Agent (x402)' : 'Direct Sui Wallet Move Call'}
                  </span>
                </div>
              </div>
            </div>
            <footer className="flex justify-end gap-sm border-t border-secondary p-xl">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-sm font-semibold text-secondary border border-primary shadow-xs hover:bg-secondary-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTrade}
                className="inline-flex items-center gap-sm rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-sm font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                Confirm &amp; Execute
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {depositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-md">
          <div className="fixed inset-0 bg-overlay opacity-70" onClick={() => setDepositModalOpen(false)}></div>
          <div className="relative flex max-h-full w-full max-w-sm flex-col overflow-hidden rounded-lg bg-primary shadow-2xl border border-secondary">
            <header className="border-b border-secondary p-xl">
              <h2 className="text-base font-semibold text-primary">Fund Agent Trading Vault</h2>
            </header>
            <div className="p-xl space-y-sm text-xs font-mono">
              <div className="flex flex-col gap-sm">
                <label className="text-sm font-medium text-secondary">USDC Amount to Deposit</label>
                <input
                  type="number"
                  value={depositAmt}
                  onChange={e => setDepositAmt(e.target.value)}
                  className="rounded-md bg-primary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring font-mono"
                />
                <p className="text-xs text-tertiary">
                  Funds are held in your dedicated Sui agent vault for autonomous arbitrage.
                </p>
              </div>
            </div>
            <footer className="flex justify-end gap-sm border-t border-secondary p-xl">
              <button
                onClick={() => setDepositModalOpen(false)}
                className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-sm font-semibold text-secondary border border-primary shadow-xs hover:bg-secondary-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                Cancel
              </button>
              <button
                onClick={handleAgentDeposit}
                className="inline-flex items-center gap-sm rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-sm font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                Deposit USDC
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Bottom Tabs: Positions, Open Orders, Trade History */}
      <div className="space-y-sm">
        <div className="flex gap-lg border-b border-secondary">
          <button
            onClick={() => setBottomTab('positions')}
            className={`border-b-2 px-md py-sm text-sm font-semibold uppercase transition-colors ${
              bottomTab === 'positions' ? 'border-brand text-brand-primary' : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            Positions ({positions.length})
          </button>
          <button
            onClick={() => setBottomTab('orders')}
            className={`border-b-2 px-md py-sm text-sm font-semibold uppercase transition-colors ${
              bottomTab === 'orders' ? 'border-brand text-brand-primary' : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            Open Orders ({orders.length})
          </button>
          <button
            onClick={() => setBottomTab('history')}
            className={`border-b-2 px-md py-sm text-sm font-semibold uppercase transition-colors ${
              bottomTab === 'history' ? 'border-brand text-brand-primary' : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            Trade History ({history.length})
          </button>
        </div>

        {bottomTab === 'positions' && (
          <Panel noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                    <th className="py-xs px-sm">Market</th>
                    <th className="py-xs px-sm">Outcome</th>
                    <th className="py-xs px-sm">Venue</th>
                    <th className="py-xs px-sm">Shares</th>
                    <th className="py-xs px-sm">Avg Price</th>
                    <th className="py-xs px-sm">Current Price</th>
                    <th className="py-xs px-sm">Unrealized PnL</th>
                    <th className="py-xs px-sm text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary">
                  {positions.map((p: any) => (
                    <tr key={p.id} className="hover:bg-secondary-hover transition-colors">
                      <td className="py-sm px-sm font-sans font-medium text-primary">{p.marketTitle}</td>
                      <td className="py-sm px-sm font-bold text-utility-success-700">{p.outcomeLabel}</td>
                      <td className="py-sm px-sm font-sans">
                        <VenuePill name={VENUE_MAP.get(p.venueId)?.name || p.venueId} color={VENUE_MAP.get(p.venueId)?.color || '#fff'} />
                      </td>
                      <td className="py-sm px-sm">{p.shares}</td>
                      <td className="py-sm px-sm">{(p.avgPrice * 100).toFixed(1)}¢</td>
                      <td className="py-sm px-sm font-bold">{(p.currentPrice * 100).toFixed(1)}¢</td>
                      <td className={`py-sm px-sm font-bold ${p.pnl >= 0 ? 'text-utility-success-700' : 'text-utility-error-700'}`}>
                        {p.pnl >= 0 ? `+$${p.pnl.toFixed(2)}` : `-$${Math.abs(p.pnl).toFixed(2)}`}
                      </td>
                      <td className="py-sm px-sm text-right">
                        <button
                          onClick={() => {
                            setSide('sell')
                            setAmount(p.shares.toString())
                            showToast('Filled Sell Ticket from Position')
                          }}
                          className="px-sm py-xxs rounded bg-secondary hover:bg-utility-error-50 hover:text-utility-error-700 text-xs font-bold"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {bottomTab === 'orders' && (
          <Panel noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                    <th className="py-xs px-sm">Order ID</th>
                    <th className="py-xs px-sm">Market</th>
                    <th className="py-xs px-sm">Type / Side</th>
                    <th className="py-xs px-sm">Limit Price</th>
                    <th className="py-xs px-sm">Amount</th>
                    <th className="py-xs px-sm">Status</th>
                    <th className="py-xs px-sm text-right">Cancel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary">
                  {orders.map((o: any) => (
                    <tr key={o.id} className="hover:bg-secondary-hover transition-colors">
                      <td className="py-sm px-sm text-quaternary">{o.id}</td>
                      <td className="py-sm px-sm font-sans font-medium text-primary">{o.marketTitle}</td>
                      <td className="py-sm px-sm font-bold text-utility-success-700">
                        {o.type.toUpperCase()} {o.side.toUpperCase()}
                      </td>
                      <td className="py-sm px-sm">{(o.price * 100).toFixed(1)}¢</td>
                      <td className="py-sm px-sm">${o.amount}</td>
                      <td className="py-sm px-sm font-bold text-utility-warning-700 uppercase">{o.status}</td>
                      <td className="py-sm px-sm text-right">
                        <button
                          onClick={async () => {
                            await fetch(`/api/trade/orders/${o.id}`, { method: 'DELETE' })
                            reloadUserData()
                            showToast('Order Cancelled')
                          }}
                          className="px-sm py-xxs bg-secondary hover:bg-utility-error-50 hover:text-utility-error-700 rounded text-xs"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {bottomTab === 'history' && (
          <Panel noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                    <th className="py-xs px-sm">Execution ID</th>
                    <th className="py-xs px-sm">Market</th>
                    <th className="py-xs px-sm">Mode</th>
                    <th className="py-xs px-sm">Venue</th>
                    <th className="py-xs px-sm">Side</th>
                    <th className="py-xs px-sm">Fill Price</th>
                    <th className="py-xs px-sm">Shares</th>
                    <th className="py-xs px-sm text-right">Tx Digest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary">
                  {history.map((h: any) => (
                    <tr key={h.id} className="hover:bg-secondary-hover transition-colors">
                      <td className="py-sm px-sm text-quaternary">{h.id}</td>
                      <td className="py-sm px-sm font-sans font-medium text-primary">{h.marketTitle}</td>
                      <td className="py-sm px-sm font-bold text-brand-primary">{h.mode}</td>
                      <td className="py-sm px-sm font-sans">
                        <VenuePill name={VENUE_MAP.get(h.venueId)?.name || h.venueId} color={VENUE_MAP.get(h.venueId)?.color || '#fff'} />
                      </td>
                      <td className={`py-sm px-sm font-bold ${h.side === 'buy' ? 'text-utility-success-700' : 'text-utility-error-700'}`}>
                        {h.side.toUpperCase()}
                      </td>
                      <td className="py-sm px-sm">{(h.price * 100).toFixed(1)}¢</td>
                      <td className="py-sm px-sm">{h.shares}</td>
                      <td className="py-sm px-sm text-right text-tertiary">
                        {h.txDigest ? `${h.txDigest.slice(0, 10)}…` : 'Internal'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}
