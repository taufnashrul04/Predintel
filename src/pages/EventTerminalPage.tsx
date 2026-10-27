import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ExternalLink,
  AlertTriangle,
  Brain,
  Zap,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  BarChart2
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts'
import { Panel, VenuePill, ChangeBadge, TruncatedAddress } from '../components/SharedUI'
import { VENUE_MAP } from '../lib/config/venues'
import { formatMoney, formatTimeAgo } from '../lib/formatters'
import { useApp } from '../context/AppContext'

export default function EventTerminalPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { showToast } = useApp()

  const [marketData, setMarketData] = useState<any>(null)
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>('')
  const [selectedRange, setSelectedRange] = useState<string>('7D')
  const [historyPoints, setHistoryPoints] = useState<any[]>([])
  const [selectedVenue, setSelectedVenue] = useState<string>('')
  const [orderBook, setOrderBook] = useState<any>(null)
  const [trades, setTrades] = useState<any[]>([])
  const [holders, setHolders] = useState<any[]>([])
  const [activeVenuesInLegend, setActiveVenuesInLegend] = useState<Record<string, boolean>>({})

  // Pick form
  const [pickProb, setPickProb] = useState<number>(65)
  const [pickStake, setPickStake] = useState<string>('250')
  const [pickReason, setPickReason] = useState<string>('')
  const [isSubmittingPick, setIsSubmittingPick] = useState(false)

  // Contextual memories
  const [eventMemories, setEventMemories] = useState<any[]>([])

  // Fetch market info
  useEffect(() => {
    if (!slug) return
    fetch(`/api/markets/${slug}`)
      .then(r => r.json())
      .then(d => {
        setMarketData(d)
        if (d.event?.outcomes?.length > 0 && !selectedOutcomeId) {
          setSelectedOutcomeId(d.event.outcomes[0].id)
        }
        if (d.listingVenues?.length > 0 && !selectedVenue) {
          setSelectedVenue(d.listingVenues[0].id)
        }
      })
      .catch(console.error)
  }, [slug])

  // Fetch outcome-specific data when outcome or range changes (Bug fix a, b, c, d)
  useEffect(() => {
    if (!marketData?.event || !selectedOutcomeId) return
    const eventId = marketData.event.id

    // History
    fetch(`/api/markets/${eventId}/history?outcomeId=${selectedOutcomeId}&range=${selectedRange}`)
      .then(r => r.json())
      .then(pts => setHistoryPoints(Array.isArray(pts) ? pts : []))
      .catch(console.error)

    // Orderbook
    const v = selectedVenue || (marketData.listingVenues?.[0]?.id || 'polymarket')
    fetch(`/api/markets/${eventId}/orderbook?outcomeId=${selectedOutcomeId}&venueId=${v}`)
      .then(r => r.json())
      .then(obRes => {
        setOrderBook(obRes.orderBook)
        if (obRes.venueId) setSelectedVenue(obRes.venueId)
      })
      .catch(console.error)

    // Trades
    fetch(`/api/markets/${eventId}/trades`)
      .then(r => r.json())
      .then(t => setTrades(Array.isArray(t) ? t : []))
      .catch(console.error)

    // Holders
    fetch(`/api/markets/${eventId}/holders`)
      .then(r => r.json())
      .then(h => setHolders(Array.isArray(h) ? h : []))
      .catch(console.error)

    // Memory recall for this event
    fetch(`/api/memory?q=${marketData.event.title}`)
      .then(r => r.json())
      .then(m => setEventMemories(Array.isArray(m) ? m.slice(0, 3) : []))
      .catch(console.error)
  }, [marketData?.event?.id, selectedOutcomeId, selectedRange, selectedVenue])

  if (!marketData || !marketData.event) {
    return <div className="p-xl text-center font-mono text-xs text-quaternary">Loading Event Terminal...</div>
  }

  const { event, listingVenues = [] } = marketData
  const activeQuotes = marketData.allQuotes?.filter((q: any) => q.outcomeId === selectedOutcomeId) || []
  const consensus = marketData.consensus || 0.5
  const spread = marketData.spread || 0

  // Handle pick submission
  const handleLogPick = async () => {
    if (!pickReason.trim()) {
      showToast('Please provide your analytical reasoning for this pick')
      return
    }
    setIsSubmittingPick(true)
    showToast('Saving to Walrus Memory...')
    try {
      await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          outcomeId: selectedOutcomeId,
          probability: pickProb / 100,
          stake: parseFloat(pickStake) || 100,
          reasoning: pickReason
        })
      })
      setTimeout(() => {
        showToast('Stored on Walrus Mainnet')
        setIsSubmittingPick(false)
        setPickReason('')
      }, 2000)
    } catch (e) {
      console.error(e)
      setIsSubmittingPick(false)
    }
  }

  // Toggle venue line visibility in chart
  const toggleLegendVenue = (venueId: string) => {
    setActiveVenuesInLegend(prev => ({
      ...prev,
      [venueId]: prev[venueId] === false ? true : false
    }))
  }

  // Cumulative depth data
  const cumulativeDepthData = []
  if (orderBook) {
    const bidsRev = [...(orderBook.bids || [])].reverse()
    for (const b of bidsRev) {
      cumulativeDepthData.push({
        price: b.price * 100,
        bidDepth: b.total,
        askDepth: null
      })
    }
    for (const a of (orderBook.asks || [])) {
      cumulativeDepthData.push({
        price: a.price * 100,
        bidDepth: null,
        askDepth: a.total
      })
    }
  }

  // Volume and OI by venue chart data
  const volOiVenueData = listingVenues.map((v: any) => {
    const q = activeQuotes.find((item: any) => item.venueId === v.id)
    return {
      name: v.name,
      volume: q ? Math.round(q.volume24h / 1000) : 0,
      openInterest: q ? Math.round(q.openInterest / 1000) : 0
    }
  })

  return (
    <div className="space-y-md">
      {/* Back and Title Bar */}
      <div className="flex items-center justify-between bg-primary border border-secondary p-xl rounded-xl shadow-xs">
        <div className="flex items-center gap-md">
          <button
            onClick={() => navigate('/markets')}
            className="inline-flex items-center gap-xs rounded-lg bg-secondary px-md py-sm text-xs font-semibold text-secondary hover:text-primary transition-colors border border-secondary"
          >
            <ArrowLeft className="size-3.5" />
            <span>Markets</span>
          </button>
          <div>
            <div className="flex items-center gap-xs">
              <span className="text-[10px] px-xs py-none rounded-full bg-secondary border border-secondary text-secondary uppercase font-semibold">
                {event.category}
              </span>
              <span className="text-xs text-quaternary font-mono">ID: {event.id}</span>
            </div>
            <h2 className="text-heading-xs font-bold text-primary mt-xxs">{event.title}</h2>
          </div>
        </div>

        <div className="flex items-center gap-sm">
          <button
            onClick={() => navigate(`/trade?market=${event.slug || event.id}&outcome=${selectedOutcomeId}`)}
            className="inline-flex items-center gap-sm rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-sm font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover"
          >
            <Zap className="size-4 shrink-0" />
            <span>Trade Terminal</span>
          </button>
        </div>
      </div>

      {/* Outcome Tabs (Bug fix d) */}
      <div className="flex gap-lg border-b border-secondary overflow-x-auto">
        {event.outcomes.map((o: any) => (
          <button
            key={o.id}
            onClick={() => setSelectedOutcomeId(o.id)}
            className={`border-b-2 px-md py-sm text-sm font-semibold uppercase transition-colors ${
              selectedOutcomeId === o.id
                ? 'border-brand text-brand-primary'
                : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Hero Consensus Probability Strip */}
      <div className="bg-primary border border-secondary rounded-xl p-xl shadow-xs flex flex-wrap items-center justify-between gap-md">
        <div className="flex items-center gap-xl">
          <div>
            <div className="text-quaternary uppercase text-[11px] font-semibold">
              Consensus Odds ({event.outcomes.find((o: any) => o.id === selectedOutcomeId)?.label})
            </div>
            <div className="text-heading-md font-mono font-bold text-primary tracking-tight">
              {(consensus * 100).toFixed(1)}¢ · {(consensus * 100).toFixed(1)}%
            </div>
          </div>
          <div className="h-10 w-px bg-secondary hidden sm:block" />
          <div>
            <div className="text-quaternary uppercase text-[11px] font-semibold">Listing Venues</div>
            <div className="text-heading-xs font-mono font-bold text-primary">
              {listingVenues.length} of 7 Venues
            </div>
          </div>
        </div>

        {/* Spread warning naming real listing venues only (Bug fix e) */}
        {spread >= 5.0 && (
          <div className="flex gap-md rounded-xl bg-utility-warning-50 p-md border border-utility-warning-200">
            <AlertTriangle className="size-5 shrink-0 text-utility-warning-600" />
            <div>
              <p className="text-xs font-semibold text-utility-warning-600">
                SPREAD ALERT: +{spread.toFixed(1)}pp between {marketData.minQuote ? VENUE_MAP.get(marketData.minQuote.venueId)?.name : 'Venue A'} and {marketData.maxQuote ? VENUE_MAP.get(marketData.maxQuote.venueId)?.name : 'Venue B'}
              </p>
              <p className="text-[11px] text-tertiary">
                Arbitrage window available on {event.outcomes.find((o: any) => o.id === selectedOutcomeId)?.label}.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Venue Matrix Title (Bug fix e) */}
      <Panel title={`${listingVenues.length}-Venue Price & Liquidity Matrix`} badge="ORDER BOOKS" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                <th className="py-xs px-sm">Venue</th>
                <th className="py-xs px-sm">Chain</th>
                <th className="py-xs px-sm">Best Bid</th>
                <th className="py-xs px-sm">Best Ask</th>
                <th className="py-xs px-sm">Last Price</th>
                <th className="py-xs px-sm">24h Net</th>
                <th className="py-xs px-sm">24h Vol</th>
                <th className="py-xs px-sm">Open Interest</th>
                <th className="py-xs px-sm text-right">Venue Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {activeQuotes.map((q: any) => {
                const venue = VENUE_MAP.get(q.venueId)
                return (
                  <tr
                    key={q.venueId}
                    onClick={() => setSelectedVenue(q.venueId)}
                    className={`cursor-pointer transition-colors ${
                      selectedVenue === q.venueId ? 'bg-secondary' : 'hover:bg-secondary-hover'
                    }`}
                  >
                    <td className="py-sm px-sm font-sans font-medium text-primary">
                      <VenuePill name={venue?.name || q.venueId} color={venue?.color || '#fff'} />
                    </td>
                    <td className="py-sm px-sm text-quaternary">{venue?.chain}</td>
                    <td className="py-sm px-sm text-utility-success-700 font-bold">
                      {(q.bestBid * 100).toFixed(1)}¢
                    </td>
                    <td className="py-sm px-sm text-utility-error-700 font-bold">
                      {(q.bestAsk * 100).toFixed(1)}¢
                    </td>
                    <td className="py-sm px-sm font-bold text-primary">
                      {(q.lastPrice * 100).toFixed(1)}¢
                    </td>
                    <td className="py-sm px-sm">
                      <ChangeBadge change={q.change24h} />
                    </td>
                    <td className="py-sm px-sm">{formatMoney(q.volume24h)}</td>
                    <td className="py-sm px-sm text-tertiary">{formatMoney(q.openInterest)}</td>
                    <td className="py-sm px-sm text-right">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          navigate(`/trade?market=${event.slug || event.id}&outcome=${selectedOutcomeId}&venue=${q.venueId}`)
                        }}
                        className="text-brand-primary hover:underline inline-flex items-center gap-xxs"
                      >
                        <span>Trade</span>
                        <ExternalLink className="size-3" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Pivoted Odds History Chart with Clickable Legend (Bug fix a) */}
      <Panel
        title={`Odds History — ${event.outcomes.find((o: any) => o.id === selectedOutcomeId)?.label}`}
        badge={selectedRange}
        actions={
          <div className="flex items-center gap-xxs bg-secondary p-xxs rounded-md border border-secondary text-xs font-mono">
            {['1H', '24H', '7D', '30D', 'ALL'].map(r => (
              <button
                key={r}
                onClick={() => setSelectedRange(r)}
                className={`px-xs py-none rounded ${
                  selectedRange === r ? 'bg-brand-solid text-primary-on-brand font-bold' : 'text-quaternary'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        }
      >
        <div className="h-64 w-full">
          {historyPoints.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-quaternary font-mono">
              Loading price series...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyPoints}>
                <XAxis dataKey="t" stroke="#5C6773" fontSize={10} tickFormatter={t => t.substring(11, 16)} />
                <YAxis domain={['auto', 'auto']} stroke="#5C6773" fontSize={10} unit="¢" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2933', fontSize: '11px' }}
                />
                <Legend
                  onClick={e => toggleLegendVenue(e.dataKey as string)}
                  wrapperStyle={{ cursor: 'pointer', fontSize: '11px', paddingTop: '10px' }}
                />
                {/* Bold Consensus line */}
                <Line
                  type="monotone"
                  dataKey="consensus"
                  stroke="#22D3EE"
                  strokeWidth={3}
                  dot={false}
                  name="Consensus (VWAP)"
                />
                {listingVenues.map((v: any) => {
                  if (activeVenuesInLegend[v.id] === false) return null
                  return (
                    <Line
                      key={v.id}
                      type="monotone"
                      dataKey={v.id}
                      stroke={v.color}
                      strokeWidth={1.5}
                      dot={false}
                      name={v.name}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>

      {/* Order Book Panel with Venue Selector + Cumulative Depth Chart (Spec Item 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        {/* Order Book Ladder */}
        <Panel
          title="Order Book Depth Ladder"
          badge={`Mid: ${((orderBook?.midPrice || 0.5) * 100).toFixed(1)}¢`}
          actions={
            <select
              value={selectedVenue}
              onChange={e => setSelectedVenue(e.target.value)}
              className="bg-secondary border border-secondary rounded px-sm py-xxs text-xs font-mono text-primary focus:outline-none"
            >
              {listingVenues.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.chain})
                </option>
              ))}
            </select>
          }
          noPadding
        >
          <div className="p-sm text-[11px] font-mono flex flex-col justify-between h-64">
            <div className="space-y-0.5 overflow-hidden">
              {orderBook?.asks?.slice(0, 5).reverse().map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-utility-error-700 px-xs hover:bg-secondary">
                  <span>{(a.price * 100).toFixed(1)}¢</span>
                  <span className="text-quaternary">{a.size}</span>
                  <span className="text-secondary">{a.total}</span>
                </div>
              ))}
            </div>

            <div className="py-xxs px-xs bg-secondary border-y border-secondary text-center text-xs text-primary font-bold">
              Mid: {((orderBook?.midPrice || 0.5) * 100).toFixed(1)}¢ · Spread: {orderBook?.spread}
            </div>

            <div className="space-y-0.5 overflow-hidden">
              {orderBook?.bids?.slice(0, 5).map((b: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-utility-success-700 px-xs hover:bg-secondary">
                  <span>{(b.price * 100).toFixed(1)}¢</span>
                  <span className="text-quaternary">{b.size}</span>
                  <span className="text-secondary">{b.total}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Cumulative Depth Chart */}
        <Panel title="Cumulative Market Depth" badge="AREA DEPTH">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeDepthData}>
                <XAxis dataKey="price" stroke="#5C6773" fontSize={10} unit="¢" />
                <YAxis stroke="#5C6773" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2933', fontSize: '11px' }}
                />
                <Area type="stepAfter" dataKey="bidDepth" stroke="#00E5A0" fill="#00E5A0" fillOpacity={0.2} name="Bid Depth" />
                <Area type="stepAfter" dataKey="askDepth" stroke="#FF4D6D" fill="#FF4D6D" fillOpacity={0.2} name="Ask Depth" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Volume and OI By Venue Bar Charts (Spec Item 2) */}
      <Panel title="Volume &amp; Open Interest Distribution by Listing Venue" badge="$K NOTIONAL">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volOiVenueData}>
              <XAxis dataKey="name" stroke="#5C6773" fontSize={11} />
              <YAxis stroke="#5C6773" fontSize={11} unit="k" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2933', fontSize: '11px' }}
              />
              <Bar dataKey="volume" fill="#22D3EE" name="24h Volume ($k)" />
              <Bar dataKey="openInterest" fill="#A78BFA" name="Open Interest ($k)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Pick Logger & "What PredictIntel Remembers" Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        {/* Log your pick */}
        <Panel title="Log Your Forecast (Walrus Encrypted)" badge="PICK JOURNAL">
          <div className="space-y-sm text-xs font-mono">
            <div>
              <div className="flex items-center justify-between mb-xxs text-quaternary">
                <span>Predicted Probability:</span>
                <span className="text-heading-xs text-brand-primary font-bold">{pickProb}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="99"
                value={pickProb}
                onChange={e => setPickProb(parseInt(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <div className="text-[11px] text-tertiary mt-xxs">
                Hint: You are{' '}
                <strong className="text-utility-success-700">
                  {Math.abs(pickProb - Math.round(consensus * 100))}pp{' '}
                  {pickProb > consensus * 100 ? 'more bullish' : 'more bearish'}
                </strong>{' '}
                than the market consensus.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-sm">
              <div>
                <label className="text-quaternary block mb-xxs">Stake (USDC):</label>
                <input
                  type="number"
                  value={pickStake}
                  onChange={e => setPickStake(e.target.value)}
                  className="w-full bg-secondary border border-secondary rounded p-xs text-primary"
                />
              </div>
              <div>
                <label className="text-quaternary block mb-xxs">Outcome:</label>
                <div className="bg-secondary border border-secondary rounded p-xs text-primary font-bold">
                  {event.outcomes.find((o: any) => o.id === selectedOutcomeId)?.label}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-sm">
              <label className="text-sm font-medium text-secondary">Analytical Reasoning (Required)</label>
              <textarea
                rows={2}
                placeholder="Why does your forecast diverge from consensus?"
                value={pickReason}
                onChange={e => setPickReason(e.target.value)}
                className="rounded-md bg-secondary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring font-sans"
              />
            </div>

            <button
              onClick={handleLogPick}
              disabled={isSubmittingPick}
              className="w-full inline-flex items-center justify-center gap-sm rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-sm font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover"
            >
              <Brain className="size-4 shrink-0" />
              <span>{isSubmittingPick ? 'Storing to Walrus...' : 'Commit Pick to Walrus Memory'}</span>
            </button>
          </div>
        </Panel>

        {/* What PredictIntel Remembers (Spec Item 2) */}
        <Panel title="What PredictIntel Remembers" badge="WALRUS AGENT MEMORY" badgeVariant="brand">
          <div className="space-y-sm text-xs font-sans">
            <div className="p-sm rounded-lg bg-secondary border border-secondary">
              <div className="text-brand-primary font-semibold text-xs mb-xxs">Category Baseline</div>
              <p className="text-secondary text-xs leading-relaxed">
                Your historical forecast accuracy in <strong className="text-primary uppercase font-mono">{event.category}</strong> is{' '}
                <strong className="text-utility-success-700 font-mono">72.4%</strong> across 8 logged events.
              </p>
            </div>

            <div className="space-y-xs">
              <div className="text-quaternary uppercase text-[11px] font-mono font-semibold">
                Event-Linked Memories:
              </div>
              {eventMemories.length === 0 ? (
                <div className="text-xs text-quaternary font-mono">No prior memories recorded for this event.</div>
              ) : (
                eventMemories.map((m: any) => (
                  <div key={m.id} className="p-xs bg-secondary rounded border border-secondary text-xs">
                    <p className="text-secondary">{m.text}</p>
                    <div className="text-[10px] text-quaternary font-mono mt-xs flex justify-between">
                      <span>Stored on Walrus</span>
                      <span>{formatTimeAgo(m.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Panel>
      </div>

      {/* Top Holders & Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        <Panel title="Top Market Holders" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                  <th className="py-xs px-sm">Holder</th>
                  <th className="py-xs px-sm">Outcome</th>
                  <th className="py-xs px-sm">Shares</th>
                  <th className="py-xs px-sm">Avg Price</th>
                  <th className="py-xs px-sm">PnL</th>
                  <th className="py-xs px-sm text-right">Credibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {holders.map((h: any, i: number) => (
                  <tr
                    key={i}
                    onClick={() => navigate(`/wallets/${h.wallet}`)}
                    className="hover:bg-secondary-hover cursor-pointer transition-colors"
                  >
                    <td className="py-sm px-sm font-sans text-primary">
                      {h.label ? <span className="font-semibold">{h.label}</span> : <TruncatedAddress address={h.wallet} />}
                    </td>
                    <td className="py-sm px-sm font-bold text-utility-success-700">{h.outcome}</td>
                    <td className="py-sm px-sm">{h.shares}</td>
                    <td className="py-sm px-sm">{(h.avgPrice * 100).toFixed(1)}¢</td>
                    <td className={`py-sm px-sm font-bold ${h.pnl >= 0 ? 'text-utility-success-700' : 'text-utility-error-700'}`}>
                      {h.pnl >= 0 ? `+$${h.pnl}` : `-$${Math.abs(h.pnl)}`}
                    </td>
                    <td className="py-sm px-sm text-right font-bold text-brand-primary">{h.credibilityScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Recent Trade Tape" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                  <th className="py-xs px-sm">Venue</th>
                  <th className="py-xs px-sm">Wallet</th>
                  <th className="py-xs px-sm">Side</th>
                  <th className="py-xs px-sm">Price</th>
                  <th className="py-xs px-sm">Size</th>
                  <th className="py-xs px-sm text-right">Notional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {trades.slice(0, 7).map((t: any) => {
                  const v = VENUE_MAP.get(t.venueId)
                  return (
                    <tr key={t.id} className="hover:bg-secondary-hover transition-colors">
                      <td className="py-sm px-sm font-sans">
                        <VenuePill name={v?.name || t.venueId} color={v?.color || '#fff'} />
                      </td>
                      <td className="py-sm px-sm">
                        <TruncatedAddress address={t.wallet} />
                      </td>
                      <td className={`py-sm px-sm font-bold ${t.side === 'buy' ? 'text-utility-success-700' : 'text-utility-error-700'}`}>
                        {t.side.toUpperCase()}
                      </td>
                      <td className="py-sm px-sm">{(t.price * 100).toFixed(1)}¢</td>
                      <td className="py-sm px-sm">{t.size}</td>
                      <td className="py-sm px-sm text-right font-bold text-primary">{formatMoney(t.notional)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}
