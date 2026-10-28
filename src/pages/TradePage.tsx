import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Activity } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'
import { Panel } from '../components/SharedUI'
import AgentVault from '../components/trade/AgentVault'
import OrderTicket from '../components/trade/OrderTicket'
import TradeTables from '../components/trade/TradeTables'
import LiveOddsPanel, { LiveMarketDetail } from '../components/trade/LiveOddsPanel'
import {
  AgentWallet,
  OpenOrder,
  Position,
  TicketState,
  TradeRecord,
  apiJson,
  cents
} from '../components/trade/types'
import { VENUE_MAP } from '../lib/config/venues'
import SuiWalletScope from '../components/SuiWalletScope'

interface MarketSummary {
  id: string
  slug: string
  title: string
  category: string
  outcomes: { id: string; label: string }[]
  venues: { id: string; name: string }[]
  outcomePrices: Record<string, number | null>
  underlying: string | null
  live?: boolean
}

interface LiveList {
  waterx: { id: string; slug: string; title: string; category: string; volumeUsd: number; preview: { id: string; label: string; price: number }[] }[]
  deepbook: LiveMarketDetail[]
  errors: { waterx: string | null; deepbook: string | null }
}

const isLiveId = (id: string | null) => Boolean(id && (id.startsWith('wx:') || id.startsWith('dbp:')))

function liveSummary(m: LiveMarketDetail | LiveList['waterx'][number], venueId: 'waterx' | 'deepbook'): MarketSummary {
  const outcomes = 'outcomes' in m ? m.outcomes.map(o => ({ id: o.id, label: o.label })) : m.preview.map(o => ({ id: o.id, label: o.label }))
  const prices = 'outcomes' in m
    ? Object.fromEntries(m.outcomes.map(o => [o.id, o.ask]))
    : Object.fromEntries(m.preview.map(o => [o.id, o.price]))
  return {
    id: m.id,
    slug: m.slug,
    title: m.title,
    category: m.category,
    outcomes,
    venues: [{ id: venueId, name: venueId === 'deepbook' ? 'DeepBook Predict' : 'WaterX' }],
    outcomePrices: prices,
    underlying: venueId === 'deepbook' ? 'BTC' : null,
    live: true
  }
}

interface LivePrices {
  fetchedAt: string
  prices: Record<string, { price: number; pool: string }>
}

const CATEGORIES = ['all', 'crypto', 'sports', 'politics', 'macro', 'culture']

function TradeWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const marketParam = searchParams.get('market')
  const outcomeParam = searchParams.get('outcome')
  const isLive = isLiveId(marketParam)

  const [markets, setMarkets] = useState<MarketSummary[]>([])
  const [listSource, setListSource] = useState<'live' | 'demo'>(marketParam && !isLive ? 'demo' : 'live')
  const [liveList, setLiveList] = useState<LiveList | null>(null)
  const [liveDetail, setLiveDetail] = useState<LiveMarketDetail | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [livePrices, setLivePrices] = useState<LivePrices | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [historyPoints, setHistoryPoints] = useState<Record<string, any>[]>([])
  const [bookVenue, setBookVenue] = useState<string | null>(null)
  const [orderBook, setOrderBook] = useState<any>(null)

  const [agentWallet, setAgentWallet] = useState<AgentWallet | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [orders, setOrders] = useState<OpenOrder[]>([])
  const [history, setHistory] = useState<TradeRecord[]>([])

  const [ticket, setTicket] = useState<TicketState>({
    side: 'buy',
    type: 'market',
    amount: '100',
    limitPrice: '0.50',
    split: false,
    mode: 'direct'
  })
  const ticketRef = useRef<HTMLDivElement>(null)

  const liveListItem = isLive
    ? liveList?.deepbook.find(m => m.id === marketParam) ?? liveList?.waterx.find(m => m.id === marketParam)
    : null
  const market = isLive
    ? liveDetail?.id === marketParam
      ? liveSummary(liveDetail, liveDetail.venueId)
      : liveListItem
      ? liveSummary(liveListItem, marketParam!.startsWith('dbp:') ? 'deepbook' : 'waterx')
      : undefined
    : markets.find(m => m.slug === marketParam || m.id === marketParam)
  const outcomeId = market?.outcomes.some(o => o.id === outcomeParam) ? outcomeParam! : market?.outcomes[0]?.id
  const outcome = market?.outcomes.find(o => o.id === outcomeId)

  const selectMarket = (slug: string, outcome?: string) =>
    setSearchParams(outcome ? { market: slug, outcome } : { market: slug }, { replace: true })

  useEffect(() => {
    apiJson<MarketSummary[]>('/api/trade/markets').then(setMarkets).catch(() => setMarkets([]))
  }, [])

  // DeepBook Predict windows roll every few minutes, so the live board refreshes often.
  useEffect(() => {
    const load = () => apiJson<LiveList>('/api/trade/live-markets').then(setLiveList).catch(() => {})
    load()
    const timer = window.setInterval(load, 20_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (marketParam) return
    if (listSource === 'demo' && markets.length) selectMarket(markets[0].slug)
    if (listSource === 'live' && liveList) {
      const first = liveList.waterx[0] ?? liveList.deepbook[liveList.deepbook.length - 1]
      if (first) selectMarket(first.id)
      else if (markets.length) setListSource('demo')
    }
  }, [marketParam, listSource, liveList, markets])

  useEffect(() => {
    if (!isLive || !marketParam) {
      setLiveDetail(null)
      setLiveError(null)
      return
    }
    let cancelled = false
    const load = () =>
      apiJson<LiveMarketDetail>(`/api/trade/live-markets/${encodeURIComponent(marketParam)}`)
        .then(d => {
          if (cancelled) return
          setLiveDetail(d)
          setLiveError(null)
        })
        .catch(err => {
          if (cancelled) return
          setLiveError(err.message)
          // A closed DeepBook window never reopens; stop polling it.
          if (marketParam.startsWith('dbp:')) window.clearInterval(timer)
        })
    setLiveDetail(null)
    setLiveError(null)
    const timer = window.setInterval(load, marketParam.startsWith('dbp:') ? 10_000 : 30_000)
    load()
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isLive, marketParam])

  useEffect(() => {
    const load = () => apiJson<LivePrices>('/api/live/prices').then(setLivePrices).catch(() => {})
    load()
    const timer = window.setInterval(load, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const reloadUserData = useCallback(() => {
    apiJson<AgentWallet>('/api/agent').then(setAgentWallet).catch(() => {})
    apiJson<OpenOrder[]>('/api/trade/orders').then(setOrders).catch(() => {})
    apiJson<Position[]>('/api/trade/positions').then(setPositions).catch(() => {})
    apiJson<TradeRecord[]>('/api/trade/history').then(setHistory).catch(() => {})
  }, [])

  useEffect(reloadUserData, [reloadUserData])

  const listingVenues = market?.venues ?? []

  useEffect(() => {
    if (!listingVenues.length) return
    if (!bookVenue || !listingVenues.some(v => v.id === bookVenue)) setBookVenue(listingVenues[0].id)
  }, [listingVenues, bookVenue])

  useEffect(() => {
    if (!market || !outcomeId || market.live) return
    apiJson<Record<string, any>[]>(`/api/markets/${market.id}/history?outcomeId=${outcomeId}&range=24H`)
      .then(pts => setHistoryPoints(Array.isArray(pts) ? pts : []))
      .catch(() => setHistoryPoints([]))
  }, [market?.id, outcomeId])

  useEffect(() => {
    if (!market || !outcomeId || !bookVenue || market.live) return
    apiJson<any>(`/api/markets/${market.id}/orderbook?outcomeId=${outcomeId}&venueId=${bookVenue}`)
      .then(res => setOrderBook(res.orderBook))
      .catch(() => setOrderBook(null))
  }, [market?.id, outcomeId, bookVenue])

  const outcomePrices = market?.outcomePrices ?? {}
  const underlying = market?.underlying ? livePrices?.prices[market.underlying] : null

  const chartVenues = useMemo(
    () => Object.keys(historyPoints[0] ?? {}).filter(k => listingVenues.some(v => v.id === k)),
    [historyPoints, listingVenues]
  )

  const matchesFilter = (m: { title: string; category: string }) =>
    (category === 'all' || m.category === category) && m.title.toLowerCase().includes(search.trim().toLowerCase())
  const filteredMarkets = markets.filter(matchesFilter)
  const liveGroups = [
    { key: 'deepbook', label: 'DeepBook Predict · BTC up/down', items: (liveList?.deepbook ?? []).filter(matchesFilter).map(m => liveSummary(m, 'deepbook')), error: liveList?.errors.deepbook },
    { key: 'waterx', label: 'WaterX', items: (liveList?.waterx ?? []).filter(matchesFilter).map(m => liveSummary(m, 'waterx')), error: liveList?.errors.waterx }
  ]
  const nextDeepbookWindow = () => {
    // Windows are sorted soonest-first; the last one leaves the most time to trade.
    const others = (liveList?.deepbook ?? []).filter(m => m.id !== marketParam)
    const next = others[others.length - 1]
    if (next) selectMarket(next.id)
  }

  const renderMarketRow = (m: MarketSummary) => {
    const selected = m.id === market?.id
    const lead = m.outcomes[0]
    return (
      <button
        key={m.id}
        onClick={() => selectMarket(m.slug)}
        aria-current={selected}
        className={`w-full text-left p-sm transition-colors ${selected ? 'bg-secondary' : 'hover:bg-secondary-hover'}`}
      >
        <div className="flex items-center justify-between gap-sm text-[10px] text-quaternary uppercase mb-xxs">
          <span className="truncate">{m.live && lead ? lead.label : m.category}</span>
          <span className="font-mono text-primary font-bold">{cents(lead ? m.outcomePrices[lead.id] : null)}</span>
        </div>
        <div className={`text-xs text-primary leading-snug line-clamp-2 ${selected ? 'font-semibold' : ''}`}>{m.title}</div>
        {!m.live && <div className="mt-xxs text-[10px] text-quaternary font-mono">{m.venues.map(v => v.name).join(' · ')}</div>}
      </button>
    )
  }

  const closePosition = (p: Position) => {
    selectMarket(p.marketSlug, p.outcomeId)
    setTicket(t => ({
      ...t,
      side: 'sell',
      type: 'market',
      amount: String(Math.max(1, Math.floor(p.shares * p.currentPrice)))
    }))
    ticketRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-md pb-24 lg:pb-0">
      <AgentVault wallet={agentWallet} onChange={reloadUserData} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        <div className="lg:col-span-3 space-y-md">
          <Panel title="Sui markets" badge="WaterX · DeepBook" noPadding>
            <div className="p-sm space-y-xs border-b border-secondary">
              <div className="grid grid-cols-2 gap-xxs bg-secondary p-xxs rounded-lg border border-secondary" role="tablist" aria-label="Market source">
                {(['live', 'demo'] as const).map(src => (
                  <button
                    key={src}
                    role="tab"
                    aria-selected={listSource === src}
                    onClick={() => setListSource(src)}
                    className={`py-xxs rounded text-[11px] font-bold ${
                      listSource === src ? 'bg-brand-solid text-primary-on-brand' : 'text-quaternary hover:text-primary'
                    }`}
                  >
                    {src === 'live' ? `Live (${(liveList?.deepbook.length ?? 0) + (liveList?.waterx.length ?? 0)})` : `Demo (${markets.length})`}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-xs rounded-md border border-primary bg-primary px-sm py-xxs">
                <Search className="size-3.5 text-quaternary" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search markets"
                  aria-label="Search markets"
                  className="w-full bg-transparent text-xs text-primary py-xxs focus:outline-none"
                />
              </label>
              <div className="flex flex-wrap gap-xxs">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-sm py-xxs rounded text-[11px] capitalize ${
                      category === c ? 'bg-brand-solid text-primary-on-brand font-bold' : 'bg-secondary text-quaternary hover:text-primary'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-secondary max-h-64 lg:max-h-[460px] overflow-y-auto">
              {listSource === 'demo' ? (
                <>
                  {filteredMarkets.length === 0 && <p className="p-md text-xs text-tertiary">No markets match that search.</p>}
                  {filteredMarkets.map(renderMarketRow)}
                </>
              ) : !liveList ? (
                <div className="p-sm space-y-xs">
                  {[0, 1, 2, 3].map(i => <div key={i} className="h-12 rounded bg-secondary animate-pulse" />)}
                </div>
              ) : (
                liveGroups.map(g => (
                  <div key={g.key}>
                    <div className="sticky top-0 z-10 px-sm py-xxs bg-secondary text-[10px] uppercase font-semibold text-quaternary flex items-center justify-between">
                      <span>{g.label}</span>
                      <span className="font-mono">{g.items.length}</span>
                    </div>
                    {g.error && <p className="p-sm text-[11px] text-utility-warning-700">{g.error}</p>}
                    {!g.error && g.items.length === 0 && (
                      <p className="p-sm text-[11px] text-tertiary">
                        {g.key === 'deepbook' ? 'No window open right now. A new one opens every few minutes.' : 'No markets match that search.'}
                      </p>
                    )}
                    <div className="divide-y divide-secondary">{g.items.map(renderMarketRow)}</div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          {market && !market.live && (
            <Panel title="Outcome" badge={market.outcomes.length > 2 ? 'Multi' : 'Binary'}>
              <div className="space-y-xs">
                {market.outcomes.map(o => (
                  <button
                    key={o.id}
                    onClick={() => selectMarket(market.slug, o.id)}
                    aria-pressed={o.id === outcomeId}
                    className={`w-full flex items-center justify-between p-sm rounded-lg border text-xs font-mono transition-colors ${
                      o.id === outcomeId
                        ? 'border-brand bg-utility-brand-50 text-utility-brand-700 font-bold'
                        : 'border-secondary bg-secondary text-primary hover:bg-secondary-hover'
                    }`}
                  >
                    <span>{o.label}</span>
                    <span>{cents(outcomePrices[o.id])}</span>
                  </button>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="lg:col-span-5 space-y-md">
          {market?.live ? (
            <LiveOddsPanel
              detail={liveDetail}
              error={liveError}
              selectedOutcomeId={outcomeId}
              onSelectOutcome={id => selectMarket(market.slug, id)}
              btcPrice={livePrices?.prices.BTC?.price ?? null}
              onNextWindow={nextDeepbookWindow}
            />
          ) : (
            <>
          <Panel
            title={market ? `${market.title} — ${outcome?.label ?? ''}` : 'Odds'}
            badge="24H"
            actions={<span className="font-mono text-xs font-bold text-brand-primary">{cents(outcomeId ? outcomePrices[outcomeId] : null)}</span>}
          >
            {market?.underlying && (
              <div className="mb-sm flex flex-wrap items-center gap-xs text-[11px] font-mono text-quaternary">
                <Activity className="size-3.5 text-utility-success-700" />
                <span>Live {market.underlying}/USDC</span>
                <span className="text-primary font-bold">
                  {underlying ? `$${underlying.price.toLocaleString('en-US', { maximumFractionDigits: 4 })}` : '—'}
                </span>
                <span>· DeepBook {underlying?.pool ?? ''}</span>
              </div>
            )}
            <div className="h-60 w-full">
              {historyPoints.length === 0 ? (
                <div className="h-full rounded bg-secondary animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyPoints}>
                    <XAxis dataKey="t" stroke="#5C6773" fontSize={10} tickFormatter={t => String(t).substring(11, 16)} />
                    <YAxis domain={['auto', 'auto']} stroke="#5C6773" fontSize={10} width={40} tickFormatter={v => `${Math.round(v * 100)}¢`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2933', fontSize: '11px' }}
                      labelFormatter={t => String(t).replace('T', ' ').slice(0, 16)}
                      formatter={(v, name) => [cents(Number(v)), String(name)]}
                    />
                    {chartVenues.map(id => (
                      <Line
                        key={id}
                        type="monotone"
                        dataKey={id}
                        name={VENUE_MAP.get(id)?.name ?? id}
                        stroke={VENUE_MAP.get(id)?.color ?? '#888'}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    ))}
                    <Line type="monotone" dataKey="consensus" name="All-venue consensus" stroke="#22D3EE" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          <Panel
            title="Order book"
            actions={
              <select
                value={bookVenue ?? ''}
                onChange={e => setBookVenue(e.target.value)}
                aria-label="Order book venue"
                className="bg-secondary border border-secondary rounded px-sm py-xxs text-xs font-mono text-primary focus:outline-none"
              >
                {listingVenues.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            }
            noPadding
          >
            <div className="p-sm text-[11px] font-mono space-y-xs">
              <div className="grid grid-cols-3 text-quaternary uppercase px-xs">
                <span>Price</span>
                <span className="text-right">Size</span>
                <span className="text-right">Total</span>
              </div>
              {(orderBook?.asks ?? []).slice(0, 5).reverse().map((a: any, i: number) => (
                <div key={`a${i}`} className="grid grid-cols-3 text-utility-error-700 px-xs">
                  <span>{cents(a.price)}</span>
                  <span className="text-right text-quaternary">{a.size.toLocaleString('en-US')}</span>
                  <span className="text-right text-secondary">{a.total.toLocaleString('en-US')}</span>
                </div>
              ))}
              <div className="py-xxs px-xs bg-secondary border-y border-secondary text-center text-primary font-bold">
                Mid {cents(orderBook?.midPrice)} · spread {orderBook ? `${(orderBook.spread * 100).toFixed(1)}¢` : '—'}
              </div>
              {(orderBook?.bids ?? []).slice(0, 5).map((b: any, i: number) => (
                <div key={`b${i}`} className="grid grid-cols-3 text-utility-success-700 px-xs">
                  <span>{cents(b.price)}</span>
                  <span className="text-right text-quaternary">{b.size.toLocaleString('en-US')}</span>
                  <span className="text-right text-secondary">{b.total.toLocaleString('en-US')}</span>
                </div>
              ))}
            </div>
          </Panel>
            </>
          )}
        </div>

        <div className="lg:col-span-4 scroll-mt-md" ref={ticketRef}>
          {market && outcomeId && outcome ? (
            <OrderTicket
              market={market}
              outcomeId={outcomeId}
              outcomeLabel={outcome.label}
              ticket={ticket}
              setTicket={setTicket}
              agentWallet={agentWallet}
              onExecuted={reloadUserData}
              live={Boolean(market.live)}
              priceVersion={liveError ?? liveDetail?.fetchedAt}
            />
          ) : (
            <div className="h-96 rounded-xl border border-secondary bg-secondary animate-pulse" />
          )}
        </div>
      </div>

      <TradeTables positions={positions} orders={orders} history={history} onClosePosition={closePosition} onChange={reloadUserData} />

      {market && outcome && (
        <div className="lg:hidden fixed left-0 right-0 bottom-14 md:bottom-0 z-30 border-t border-secondary bg-primary px-md py-sm flex items-center justify-between gap-sm">
          <div className="min-w-0 flex-1 text-xs">
            <div className="truncate text-primary font-semibold">{market.title}</div>
            <div className="font-mono text-quaternary">
              {outcome.label} · {cents(outcomePrices[outcome.id])}
            </div>
          </div>
          <button
            onClick={() => ticketRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="shrink-0 max-w-[45%] truncate rounded-lg bg-brand-solid px-lg py-sm text-sm font-semibold text-primary-on-brand"
          >
            {ticket.side === 'buy' ? 'Buy' : 'Sell'} {outcome.label}
          </button>
        </div>
      )}
    </div>
  )
}

export default function TradePage() {
  return (
    <SuiWalletScope>
      <TradeWorkspace />
    </SuiWalletScope>
  )
}
