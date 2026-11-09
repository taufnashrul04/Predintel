import { randomBytes } from 'node:crypto'
import { MOCK_EVENTS } from '../mock/events.mjs'
import { MOCK_QUOTES, EVENT_LISTING_VENUES } from '../mock/quotes.mjs'
import { MOCK_ORDERBOOKS } from '../mock/orderbooks.mjs'
import { VENUE_MAP } from '../venues.mjs'
import { serverStore } from '../store.mjs'
import { rememberEntry } from './memory.mjs'

export const MAX_ORDER_USDC = 100000
const SUI_FEE_RATE = 0.0015

export class TradeError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const feeRateFor = () => SUI_FEE_RATE
// Simulated settlement reference; replaced by the real Sui tx digest once Move calls are wired.
const simRef = () => `sim_${randomBytes(8).toString('hex')}`

export const isSuiVenue = venueId => VENUE_MAP.get(venueId)?.chain === 'Sui'

// Live markets (WaterX / DeepBook Predict) the routes have fetched, keyed by id; prices refresh on each fetch.
const liveEvents = new Map()

export function registerLiveEvent(market) {
  liveEvents.set(market.id, { ...market, live: true })
}

export function findEvent(idOrSlug) {
  return MOCK_EVENTS.find(e => e.id === idOrSlug || e.slug === idOrSlug) ?? liveEvents.get(idOrSlug)
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function agentState() {
  const wallet = serverStore.agentWallet
  if (wallet.spentDate !== todayKey()) {
    wallet.spentDate = todayKey()
    wallet.spentToday = 0
  }
  wallet.dailyBudget = wallet.rules.dailyBudget
  return wallet
}

function parseOrder(input) {
  const event = findEvent(input.market ?? input.eventId)
  if (!event) throw new TradeError('Market not found.', 404)

  const outcomeId = input.outcome ?? input.outcomeId ?? event.outcomes[0].id
  const outcome = event.outcomes.find(o => o.id === outcomeId)
  if (!outcome) throw new TradeError(`Outcome '${outcomeId}' does not exist on this market.`)

  const side = input.side ?? 'buy'
  if (side !== 'buy' && side !== 'sell') throw new TradeError("Side must be 'buy' or 'sell'.")

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new TradeError('Amount must be greater than 0.')
  if (amount > MAX_ORDER_USDC) throw new TradeError(`Amount cannot exceed $${MAX_ORDER_USDC.toLocaleString('en-US')}.`)

  const type = input.type ?? 'market'
  if (type !== 'market' && type !== 'limit') throw new TradeError("Order type must be 'market' or 'limit'.")

  let limitPrice = null
  if (type === 'limit') {
    limitPrice = Number(input.limitPrice)
    if (!Number.isFinite(limitPrice) || limitPrice < 0.01 || limitPrice > 0.99) {
      throw new TradeError('Limit price must be between 0.01 and 0.99.')
    }
  }

  const mode = input.mode === 'agent' ? 'agent' : 'direct'
  const split = input.split === true || input.split === 'true'
  const venueId = input.venue ?? input.venueId ?? null
  // Clients that keep positions themselves (the browser-held agent vault) pass the shares they hold
  // and the venues they allow, since a serverless backend keeps no positions between requests.
  let held = null
  if (input.held != null && input.held !== '') {
    held = Number(input.held)
    if (!Number.isFinite(held) || held < 0) throw new TradeError('Held shares must be a positive number.')
  }
  const allowed = input.allowed ? String(input.allowed).split(',').filter(Boolean) : null
  if (venueId && !VENUE_MAP.has(venueId)) throw new TradeError(`Venue '${venueId}' is not recognized.`)

  return { event, outcome, side, amount, type, limitPrice, mode, split, venueId, held, allowed }
}

function positionMatches(p, event, outcomeId, venueId) {
  const sameEvent = p.eventId === event.id || p.marketSlug === event.slug
  return sameEvent && p.outcomeId === outcomeId && (!venueId || p.venueId === venueId)
}

// Shares available to sell on a venue: the client's own count when it sent one, else the server store.
function heldFor(order, venueId) {
  if (order.held != null) return !order.venueId || order.venueId === venueId ? order.held : 0
  return heldShares(order.event, order.outcome.id, venueId)
}

const allowedFor = order => order.allowed ?? agentState().rules.allowedVenues

function heldShares(event, outcomeId, venueId) {
  return serverStore.userPositions
    .filter(p => positionMatches(p, event, outcomeId, venueId))
    .reduce((sum, p) => sum + p.shares, 0)
}

// Trading is Sui-only: orders route to WaterX and DeepBook, never to other chains.
export function suiListingVenues(eventId, outcomeId) {
  return (EVENT_LISTING_VENUES[eventId] || []).filter(
    v => v.chain === 'Sui' && MOCK_ORDERBOOKS[`${eventId}_${v.id}_${outcomeId}`]
  )
}

function candidateVenues(order) {
  const { event, outcome, side, mode, venueId } = order
  let venues = suiListingVenues(event.id, outcome.id)
  if (venues.length === 0) throw new TradeError("This market isn't listed on WaterX or DeepBook yet.")
  if (venueId) {
    venues = venues.filter(v => v.id === venueId)
    if (venues.length === 0) throw new TradeError('Orders can only be placed on WaterX or DeepBook.')
  }
  if (mode === 'agent') {
    const allowed = allowedFor(order)
    venues = venues.filter(v => allowed.includes(v.id))
    if (venues.length === 0) throw new TradeError("The agent rules don't allow any Sui venue that lists this market.")
  }
  if (side === 'sell') venues = venues.filter(v => heldFor(order, v.id) > 0)
  if (venues.length === 0) throw new TradeError(`You don't hold ${outcome.label} shares on WaterX or DeepBook for this market.`)
  return venues
}

// Walk book levels (best first). Buy spends `budget` USDC; sell collects up to `budget` USDC of proceeds.
function walkLevels(levels, { side, budget, limitPrice, maxShares }) {
  let shares = 0
  let notional = 0
  let worstPrice = null
  for (const level of levels) {
    if (limitPrice != null && (side === 'buy' ? level.price > limitPrice : level.price < limitPrice)) break
    const remaining = budget - notional
    let levelShares = level.size
    if (maxShares != null) levelShares = Math.min(levelShares, maxShares - shares)
    if (remaining <= 1e-9 || levelShares <= 0) break
    const take = Math.min(levelShares, remaining / level.price)
    shares += take
    notional += take * level.price
    worstPrice = level.price
  }
  return { shares, notional, worstPrice }
}

function bookSide(eventId, venueId, outcomeId, side) {
  const book = MOCK_ORDERBOOKS[`${eventId}_${venueId}_${outcomeId}`]
  return side === 'buy' ? book.asks : book.bids
}

function quoteVenue(order, venue) {
  const { event, outcome, side, amount, limitPrice } = order
  const rate = feeRateFor(venue)
  const levels = bookSide(event.id, venue.id, outcome.id, side)
  const budget = side === 'buy' ? amount / (1 + rate) : amount
  const maxShares = side === 'sell' ? heldFor(order, venue.id) : null
  const fill = walkLevels(levels, { side, budget, limitPrice, maxShares })
  const topPrice = levels[0]?.price ?? null
  const avgPrice = fill.shares > 0 ? fill.notional / fill.shares : topPrice
  const quote = MOCK_QUOTES.find(q => q.eventId === event.id && q.venueId === venue.id && q.outcomeId === outcome.id)

  return {
    venueId: venue.id,
    venueName: venue.name,
    chain: venue.chain,
    venueColor: venue.color,
    marketUrl: quote?.marketUrl ?? venue.url,
    isSui: venue.chain === 'Sui',
    executable: venue.chain === 'Sui',
    feeRate: rate,
    topPrice,
    price: round(avgPrice ?? 0, 4),
    estimatedShares: round(fill.shares),
    notional: round(fill.notional),
    fee: round(fill.notional * rate),
    filledPct: round((fill.notional / budget) * 100, 1),
    slippagePct: topPrice && fill.shares > 0 ? round((Math.abs(avgPrice - topPrice) / topPrice) * 100) : 0,
    availableSize: Math.round(levels.reduce((s, l) => s + l.size, 0))
  }
}

function splitFill(order, venues) {
  const { event, outcome, side, amount, limitPrice } = order
  const merged = venues
    .flatMap(v =>
      bookSide(event.id, v.id, outcome.id, side).map(l => ({ ...l, venue: v, rate: feeRateFor(v) }))
    )
    .sort((a, b) => (side === 'buy' ? a.price - b.price : b.price - a.price))

  const held = side === 'sell' ? Object.fromEntries(venues.map(v => [v.id, heldFor(order, v.id)])) : null
  const alloc = new Map()
  let spent = 0
  for (const level of merged) {
    if (limitPrice != null && (side === 'buy' ? level.price > limitPrice : level.price < limitPrice)) break
    const effective = side === 'buy' ? level.price * (1 + level.rate) : level.price
    const remaining = amount - spent
    if (remaining <= 1e-9) break
    const a = alloc.get(level.venue.id) ?? { venue: level.venue, shares: 0, notional: 0, fee: 0 }
    let levelShares = level.size
    if (held) levelShares = Math.min(levelShares, held[level.venue.id] - a.shares)
    if (levelShares <= 0) continue
    const take = Math.min(levelShares, remaining / effective)
    a.shares += take
    a.notional += take * level.price
    a.fee += take * level.price * level.rate
    spent += take * effective
    alloc.set(level.venue.id, a)
  }
  return [...alloc.values()].map(a => ({
    venueId: a.venue.id,
    venueName: a.venue.name,
    chain: a.venue.chain,
    venueColor: a.venue.color,
    allocatedAmount: round(side === 'buy' ? a.notional + a.fee : a.notional),
    allocatedShares: round(a.shares),
    notional: round(a.notional),
    fee: round(a.fee),
    price: round(a.notional / a.shares, 4)
  }))
}

const DEEPBOOK_PREDICT_ORDER_FEE = 0.02

// Live markets have no public depth, so orders price at the venue's live ask (buy) or bid (sell).
function computeLiveQuote(order) {
  const { event, outcome, side, amount, type, limitPrice, mode } = order
  const venue = VENUE_MAP.get(event.venueId)
  if (order.venueId && order.venueId !== venue.id) throw new TradeError(`This market only trades on ${venue.name}.`)
  if (mode === 'agent' && !allowedFor(order).includes(venue.id)) {
    throw new TradeError(`The agent rules don't allow ${venue.name}.`)
  }
  if (event.settlesAt && Date.parse(event.settlesAt) < Date.now()) throw new TradeError('This market has closed.')

  const price = side === 'buy' ? outcome.ask : outcome.bid
  if (!(price > 0 && price < 1)) throw new TradeError(`${outcome.label} has no live ${side === 'buy' ? 'ask' : 'bid'} right now.`)
  const held = side === 'sell' ? heldFor(order, venue.id) : null
  if (side === 'sell' && !held) throw new TradeError(`You don't hold ${outcome.label} shares on ${venue.name} for this market.`)

  const crosses = type === 'market' || (side === 'buy' ? limitPrice >= price : limitPrice <= price)
  const flatFee = venue.id === 'deepbook' ? DEEPBOOK_PREDICT_ORDER_FEE : 0
  const rate = venue.id === 'deepbook' ? 0 : feeRateFor(venue)
  let shares = 0
  let notional = 0
  if (crosses) {
    const budget = side === 'buy' ? Math.max(0, amount - flatFee) / (1 + rate) : amount
    shares = budget / price
    if (held != null) shares = Math.min(shares, held)
    notional = shares * price
  }
  const fee = shares > 0 ? notional * rate + flatFee : 0
  const leg = {
    venueId: venue.id, venueName: venue.name, chain: venue.chain, venueColor: venue.color,
    allocatedAmount: round(side === 'buy' ? notional + fee : notional),
    allocatedShares: round(shares), notional: round(notional), fee: round(fee), price
  }
  const route = {
    venueId: venue.id, venueName: venue.name, chain: venue.chain, venueColor: venue.color,
    marketUrl: event.url ?? venue.url, isSui: true, executable: true, feeRate: rate,
    topPrice: price, price, estimatedShares: leg.allocatedShares, notional: leg.notional, fee: leg.fee,
    filledPct: crosses ? 100 : 0, slippagePct: 0, availableSize: null
  }
  const totalShares = leg.allocatedShares
  const usedAmount = shares > 0 ? leg.allocatedAmount : 0

  return {
    eventId: event.id,
    marketTitle: event.title,
    outcomeId: outcome.id,
    outcomeLabel: outcome.label,
    side,
    type,
    limitPrice,
    amount,
    mode,
    live: true,
    routes: [route],
    bestRoute: route,
    bestExecutableRoute: route,
    legs: totalShares > 0 ? [leg] : [],
    splitRoutes: null,
    avgFillPrice: price,
    totalShares,
    totalFees: totalShares > 0 ? leg.fee : 0,
    totalCost: side === 'buy' ? (totalShares > 0 ? leg.allocatedAmount : 0) : null,
    proceeds: side === 'sell' ? round(leg.notional - leg.fee) : null,
    maxPayout: side === 'buy' ? totalShares : null,
    potentialProfit: side === 'buy' ? round(totalShares - leg.allocatedAmount) : null,
    slippagePct: 0,
    unfilledAmount: crosses ? round(Math.max(0, amount - (side === 'buy' ? usedAmount : leg.notional))) : 0,
    restingAmount: type === 'limit' && !crosses ? amount : 0,
    consensusPrice: outcome.mid,
    consensusGapPp: round((price - outcome.mid) * 100, 1),
    heldShares: side === 'sell' ? round(held) : null,
    executable: totalShares > 0 || (type === 'limit' && !crosses),
    notExecutableReason: totalShares > 0 || type === 'limit' ? null : 'Amount is too small to cover the order fee.',
    priceFetchedAt: event.fetchedAt ?? null
  }
}

export function computeTradeQuote(input) {
  const order = parseOrder(input)
  if (order.event.live) return computeLiveQuote(order)
  const { event, outcome, side, amount, mode, split } = order
  const venues = candidateVenues(order)

  const routes = venues
    .map(v => quoteVenue(order, v))
    .sort((a, b) => {
      if ((a.estimatedShares > 0) !== (b.estimatedShares > 0)) return a.estimatedShares > 0 ? -1 : 1
      return side === 'buy' ? a.price - b.price : b.price - a.price
    })
  const bestRoute = routes[0]
  const executableRoutes = routes.filter(r => r.executable)
  const bestExecutableRoute = executableRoutes[0] ?? null

  let legs
  if (split && executableRoutes.length > 1) {
    legs = splitFill(order, executableRoutes.map(r => VENUE_MAP.get(r.venueId)))
  } else if (bestExecutableRoute) {
    const r = bestExecutableRoute
    legs = [{
      venueId: r.venueId, venueName: r.venueName, chain: r.chain, venueColor: r.venueColor,
      allocatedAmount: round(side === 'buy' ? r.notional + r.fee : r.notional),
      allocatedShares: r.estimatedShares, notional: r.notional, fee: r.fee, price: r.price
    }]
  } else {
    legs = []
  }

  const totalShares = round(legs.reduce((s, l) => s + l.allocatedShares, 0))
  const notional = legs.reduce((s, l) => s + l.notional, 0)
  const totalFees = round(legs.reduce((s, l) => s + l.fee, 0))
  const usedAmount = legs.reduce((s, l) => s + l.allocatedAmount, 0)
  const avgFillPrice = totalShares > 0 ? round(notional / totalShares, 4) : bestRoute.price
  const topPrice = legs.length
    ? Math.min(...legs.map(l => routes.find(r => r.venueId === l.venueId)?.topPrice ?? l.price))
    : bestRoute.topPrice
  const slippagePct = totalShares > 0 && topPrice ? round((Math.abs(avgFillPrice - topPrice) / topPrice) * 100) : 0
  const unfilledAmount = round(Math.max(0, amount - usedAmount))

  const outcomeQuotes = MOCK_QUOTES.filter(q => q.eventId === event.id && q.outcomeId === outcome.id)
  const vol = outcomeQuotes.reduce((s, q) => s + q.volume24h, 0)
  const consensus = vol > 0 ? outcomeQuotes.reduce((s, q) => s + q.lastPrice * q.volume24h, 0) / vol : 0.5

  let notExecutableReason = null
  if (!bestExecutableRoute) {
    notExecutableReason = `${bestRoute.venueName} runs on ${bestRoute.chain}. In-app execution is Sui-only for now — open the order on ${bestRoute.venueName}.`
  } else if (totalShares === 0) {
    notExecutableReason = order.type === 'limit'
      ? 'Nothing fills at this limit price yet — the full amount will rest as an open order.'
      : 'Not enough liquidity on the book to fill this order.'
  }

  return {
    eventId: event.id,
    marketTitle: event.title,
    outcomeId: outcome.id,
    outcomeLabel: outcome.label,
    side,
    type: order.type,
    limitPrice: order.limitPrice,
    amount,
    mode,
    routes,
    bestRoute,
    bestExecutableRoute,
    legs,
    splitRoutes: split && legs.length > 1 ? legs : null,
    avgFillPrice,
    totalShares,
    totalFees,
    totalCost: side === 'buy' ? round(notional + totalFees) : null,
    proceeds: side === 'sell' ? round(notional - totalFees) : null,
    maxPayout: side === 'buy' ? totalShares : null,
    potentialProfit: side === 'buy' ? round(totalShares - (notional + totalFees)) : null,
    slippagePct,
    unfilledAmount,
    restingAmount: order.type === 'limit' && bestExecutableRoute ? unfilledAmount : 0,
    consensusPrice: round(consensus, 4),
    consensusGapPp: round((avgFillPrice - consensus) * 100, 1),
    heldShares: side === 'sell' ? round(order.held ?? heldShares(event, outcome.id)) : null,
    executable: Boolean(bestExecutableRoute) && (totalShares > 0 || order.type === 'limit'),
    notExecutableReason
  }
}

export function checkAgentRules(quote) {
  const wallet = agentState()
  const { rules } = wallet
  if (quote.amount > rules.maxPerTrade) {
    throw new TradeError(`Amount exceeds the agent's max per trade ($${rules.maxPerTrade.toLocaleString('en-US')}).`)
  }
  if (quote.side === 'buy') {
    if (quote.amount > wallet.balanceUSDC) {
      throw new TradeError(`Agent vault has $${wallet.balanceUSDC.toFixed(2)} USDC — deposit more or lower the amount.`)
    }
    if (wallet.spentToday + quote.amount > rules.dailyBudget) {
      const left = Math.max(0, rules.dailyBudget - wallet.spentToday)
      throw new TradeError(`Daily budget reached: $${left.toFixed(2)} of $${rules.dailyBudget.toLocaleString('en-US')} left today.`)
    }
  }
  if (quote.slippagePct > rules.maxSlippagePct) {
    throw new TradeError(`Slippage ${quote.slippagePct}% is above the agent limit of ${rules.maxSlippagePct}%. Lower the amount.`)
  }
}

function markPrice(eventId, venueId, outcomeId) {
  const q = MOCK_QUOTES.find(x => x.eventId === eventId && x.venueId === venueId && x.outcomeId === outcomeId)
  return q ? q.bestBid : null
}

export function listPositions() {
  return serverStore.userPositions.map(p => {
    const event = findEvent(p.eventId ?? p.marketSlug)
    const liveBid = event?.live ? event.outcomes.find(o => o.id === p.outcomeId)?.bid : null
    const mark = liveBid ?? (event ? markPrice(event.id, p.venueId, p.outcomeId) ?? p.currentPrice : p.currentPrice)
    const pnl = round((mark - p.avgPrice) * p.shares)
    return {
      ...p,
      eventId: event?.id ?? p.eventId,
      marketSlug: event?.slug ?? p.marketSlug,
      currentPrice: mark,
      pnl,
      returnPct: round(((mark - p.avgPrice) / p.avgPrice) * 100, 1)
    }
  })
}

function applyLegToPositions(quote, leg) {
  const event = findEvent(quote.eventId)
  const existing = serverStore.userPositions.find(p => positionMatches(p, event, quote.outcomeId, leg.venueId))
  if (quote.side === 'buy') {
    if (existing) {
      const cost = existing.avgPrice * existing.shares + leg.notional
      existing.shares = round(existing.shares + leg.allocatedShares)
      existing.avgPrice = round(cost / existing.shares, 4)
      existing.eventId = event.id
    } else {
      serverStore.userPositions.unshift({
        id: `pos-${Date.now()}-${leg.venueId}`,
        eventId: event.id,
        marketSlug: event.slug,
        marketTitle: event.title,
        outcomeId: quote.outcomeId,
        outcomeLabel: quote.outcomeLabel,
        venueId: leg.venueId,
        shares: leg.allocatedShares,
        avgPrice: leg.price,
        currentPrice: leg.price,
        pnl: 0,
        returnPct: 0
      })
    }
    return 0
  }
  existing.shares = round(existing.shares - leg.allocatedShares)
  const realized = round((leg.price - existing.avgPrice) * leg.allocatedShares - leg.fee)
  if (existing.shares <= 0.01) {
    serverStore.userPositions.splice(serverStore.userPositions.indexOf(existing), 1)
  }
  return realized
}

function settle(quote, { mode, signer }) {
  const ref = simRef()
  const now = new Date().toISOString()
  const modeLabel = mode === 'agent' ? 'Agent (x402 · Sui)' : 'Direct'
  let realizedPnl = 0

  const trades = quote.legs
    .filter(l => l.allocatedShares > 0)
    .map(leg => {
      realizedPnl += applyLegToPositions(quote, leg)
      const trade = {
        id: `uth-${Date.now()}-${leg.venueId}`,
        eventId: quote.eventId,
        marketTitle: quote.marketTitle,
        outcomeId: quote.outcomeId,
        outcomeLabel: quote.outcomeLabel,
        side: quote.side,
        mode: modeLabel,
        venueId: leg.venueId,
        shares: leg.allocatedShares,
        price: leg.price,
        amount: leg.allocatedAmount,
        fee: leg.fee,
        status: 'filled',
        simulated: true,
        txDigest: null,
        ref,
        signer: signer ?? null,
        t: now
      }
      serverStore.userTradesHistory.unshift(trade)
      return trade
    })

  if (quote.restingAmount > 0) {
    serverStore.openOrders.unshift({
      id: `ord-${Date.now()}`,
      eventId: quote.eventId,
      marketSlug: findEvent(quote.eventId).slug,
      marketTitle: quote.marketTitle,
      outcomeId: quote.outcomeId,
      outcomeLabel: quote.outcomeLabel,
      venueId: quote.bestExecutableRoute.venueId,
      type: 'limit',
      side: quote.side,
      price: quote.limitPrice,
      amount: quote.restingAmount,
      filled: 0,
      mode: modeLabel,
      status: 'open',
      createdAt: now
    })
  }

  const venues = [...new Set(quote.legs.map(l => l.venueName))].join(' + ') || quote.bestExecutableRoute?.venueName
  const verb = quote.side === 'buy' ? 'Bought' : 'Sold'
  const filledText = quote.totalShares > 0
    ? `${verb} ${quote.totalShares} ${quote.outcomeLabel} shares of "${quote.marketTitle}" at ${(quote.avgFillPrice * 100).toFixed(1)}¢ avg on ${venues}`
    : `Placed ${quote.side} limit for ${quote.outcomeLabel} on "${quote.marketTitle}" at ${(quote.limitPrice * 100).toFixed(1)}¢ on ${venues}`
  const gap = quote.consensusGapPp
  rememberEntry({
    kind: 'trade',
    eventId: quote.eventId,
    wallet: signer ?? undefined,
    text: `${filledText} via ${modeLabel}; ${gap <= 0 ? `${Math.abs(gap)}pp under` : `${gap}pp over`} consensus.`
  })

  return { ref, trades, realizedPnl: round(realizedPnl) }
}

// Closes a vault position outright: sells every held share into the book on its venue. Reduce-only,
// so the agent's per-trade, budget and slippage limits (which guard new risk) don't apply.
export function closeAgentPosition(id) {
  const position = serverStore.userPositions.find(p => p.id === id)
  if (!position) throw new TradeError('Position not found.', 404)
  const event = findEvent(position.eventId ?? position.marketSlug)
  if (!event) throw new TradeError('This market is no longer available.', 410)
  const quote = computeTradeQuote({
    market: event.id,
    outcome: position.outcomeId,
    side: 'sell',
    amount: position.shares,
    venue: position.venueId,
    mode: 'direct'
  })
  if (!quote.totalShares) throw new TradeError('No bids to close against right now. Try again shortly.')
  const result = settle(quote, { mode: 'agent' })
  const wallet = agentState()
  wallet.balanceUSDC = round(wallet.balanceUSDC + quote.proceeds)
  return { ...result, shares: quote.totalShares, proceeds: quote.proceeds, avgPrice: quote.avgFillPrice }
}

export function executeAgentOrder(input) {
  const quote = computeTradeQuote({ ...input, mode: 'agent' })
  if (!quote.executable) throw new TradeError(quote.notExecutableReason)
  checkAgentRules(quote)

  const wallet = agentState()
  const filledCost = quote.side === 'buy' ? quote.totalCost : 0
  const reserved = quote.side === 'buy' ? round(filledCost + quote.restingAmount) : 0
  wallet.balanceUSDC = round(wallet.balanceUSDC - reserved)
  wallet.spentToday = round(wallet.spentToday + reserved)

  const execution = {
    id: `exec-${Date.now()}`,
    eventId: quote.eventId,
    outcomeId: quote.outcomeId,
    side: quote.side,
    amount: quote.amount,
    price: quote.avgFillPrice,
    shares: quote.totalShares,
    fee: quote.totalFees,
    venues: quote.legs.map(l => l.venueId),
    venueId: quote.legs[0]?.venueId ?? quote.bestExecutableRoute.venueId,
    chain: 'sui',
    status: 'pending',
    simulated: true,
    txDigest: null,
    ref: null,
    createdAt: new Date().toISOString()
  }
  serverStore.executions.unshift(execution)

  setTimeout(() => {
    const result = settle(quote, { mode: 'agent' })
    if (quote.side === 'sell') wallet.balanceUSDC = round(wallet.balanceUSDC + quote.proceeds)
    execution.status = 'confirmed'
    execution.ref = result.ref
    wallet.activityLog.unshift({
      id: `act-${Date.now()}`,
      type: 'trade',
      amount: quote.side === 'buy' ? reserved : quote.proceeds,
      venue: execution.venues.join('+'),
      status: 'confirmed',
      simulated: true,
      txDigest: null,
      ref: result.ref,
      time: new Date().toISOString(),
      details: `${quote.side.toUpperCase()} ${quote.outcomeLabel} · ${quote.marketTitle}`
    })
  }, 2500)

  return { execution, quote }
}

const INTENT_TTL_MS = 2 * 60 * 1000

export function createDirectIntent(input, address) {
  const quote = computeTradeQuote({ ...input, mode: 'direct' })
  if (!quote.executable) throw new TradeError(quote.notExecutableReason)

  const nonce = randomBytes(8).toString('hex')
  const expiresAt = new Date(Date.now() + INTENT_TTL_MS).toISOString()
  const route = quote.legs.map(l => `${l.venueName} ${l.allocatedShares} sh @ ${(l.price * 100).toFixed(1)}¢`).join(', ')
  const message = [
    'PredictIntel order intent',
    `Market: ${quote.marketTitle}`,
    `Outcome: ${quote.outcomeLabel}`,
    `Side: ${quote.side.toUpperCase()} (${quote.type})`,
    `Amount: ${quote.amount.toFixed(2)} USDC`,
    `Route: ${route || 'resting limit order'}`,
    `Avg price: ${(quote.avgFillPrice * 100).toFixed(1)}¢`,
    `Signer: ${address}`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt}`
  ].join('\n')

  const intent = { id: `intent-${nonce}`, address, message, quote, expiresAt, used: false }
  serverStore.directIntents.set(intent.id, intent)
  return intent
}

export function settleDirectIntent(intent) {
  intent.used = true
  return settle(intent.quote, { mode: 'direct', signer: intent.address })
}
