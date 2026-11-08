// Paper trading: server-priced paper fills and live marks / settlement. No wallet needed;
// the journal itself lives in the user's browser, the server only prices.
import { randomBytes } from 'node:crypto'
import { SuiGraphQLClient } from '@mysten/sui/graphql'
import { getConfig } from '@mysten/deepbook-v3/predict'
import { MOCK_QUOTES } from '../mock/quotes.mjs'
import { computeTradeQuote, findEvent, suiListingVenues, TradeError, MAX_ORDER_USDC } from './trading.mjs'
import { getLiveMarket, isLiveMarketId } from './livePredict.mjs'

// A paper buy priced exactly like a real order, at the live ask on WaterX / DeepBook Predict.
export function paperFill(input) {
  if (!isLiveMarketId(input.market)) throw new TradeError('Paper trading uses live WaterX and DeepBook Predict markets only.')
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new TradeError('Amount must be greater than 0.')
  if (amount > MAX_ORDER_USDC) throw new TradeError(`Amount cannot exceed $${MAX_ORDER_USDC.toLocaleString('en-US')}.`)

  const quote = computeTradeQuote({ market: input.market, outcome: input.outcome, side: 'buy', amount, type: 'market', mode: 'direct' })
  if (!quote.executable || quote.totalShares <= 0) throw new TradeError(quote.notExecutableReason || 'Nothing fills at this size right now.')

  const event = findEvent(quote.eventId)
  return {
    id: `paper-${Date.now()}-${randomBytes(3).toString('hex')}`,
    market: event.live ? event.id : event.slug,
    marketTitle: quote.marketTitle,
    outcomeId: quote.outcomeId,
    outcomeLabel: quote.outcomeLabel,
    venueId: quote.legs[0]?.venueId ?? quote.bestRoute.venueId,
    live: Boolean(event.live),
    strike: event.referencePrice ?? null,
    expiresAt: event.settlesAt ?? null,
    entryPrice: quote.avgFillPrice,
    shares: quote.totalShares,
    cost: quote.totalCost,
    fee: quote.totalFees,
    consensusAtEntry: quote.consensusPrice,
    openedAt: new Date().toISOString()
  }
}

const predictCfg = getConfig('mainnet')
const SETTLED_TYPE = `${predictCfg.packages.predictV1}::config_events::MarketSettled`
const graphql = new SuiGraphQLClient({ network: 'mainnet', url: 'https://graphql.mainnet.sui.io/graphql' })
let settledCache = { at: 0, map: new Map() }

// Settlement prices of recent DeepBook Predict windows, keyed by market id (prices are ×1e9).
async function recentSettlements() {
  if (Date.now() - settledCache.at < 20_000) return settledCache.map
  const map = new Map(settledCache.map)
  let before = null
  for (let i = 0; i < 4; i++) {
    const page = await graphql.listEvents({ filter: { eventType: SETTLED_TYPE }, limit: 50, order: 'descending', ...(before ? { before } : {}) })
    for (const e of page.events) map.set(e.json.expiry_market_id, Number(e.json.settlement_price) / 1e9)
    if (!page.hasNextPage || !page.endCursor) break
    before = page.endCursor
  }
  settledCache = { at: Date.now(), map }
  return map
}

function demoBid(market, outcomeId) {
  const event = findEvent(market)
  if (!event) return null
  const venues = suiListingVenues(event.id, outcomeId).map(v => v.id)
  const bids = MOCK_QUOTES.filter(q => q.eventId === event.id && q.outcomeId === outcomeId && venues.includes(q.venueId)).map(q => q.bestBid)
  return bids.length ? Math.max(...bids) : null
}

// Current value per share of each paper position: live bid, or 1 / 0 once a DeepBook window settles.
export async function markPositions(positions) {
  const settlements = positions.some(p => p.market?.startsWith('dbp:'))
    ? await recentSettlements().catch(() => settledCache.map)
    : new Map()

  return Promise.all(
    positions.slice(0, 100).map(async p => {
      const base = { id: p.id }
      try {
        if (p.market?.startsWith('dbp:')) {
          const marketId = p.market.slice(4)
          const settle = settlements.get(marketId)
          if (settle != null && p.strike != null) {
            const won = p.outcomeId === 'up' ? settle > p.strike : settle <= p.strike
            return { ...base, status: 'settled', mark: won ? 1 : 0, settlementPrice: settle }
          }
          if (p.expiresAt && Date.parse(p.expiresAt) <= Date.now()) return { ...base, status: 'awaiting', mark: null }
        }
        if (isLiveMarketId(p.market)) {
          const market = await getLiveMarket(p.market)
          const outcome = market.outcomes.find(o => o.id === p.outcomeId)
          if (!outcome) return { ...base, status: 'awaiting', mark: null }
          return { ...base, status: 'open', mark: outcome.bid }
        }
        const bid = demoBid(p.market, p.outcomeId)
        return { ...base, status: bid == null ? 'unknown' : 'open', mark: bid, demo: true }
      } catch {
        // A DeepBook window or WaterX round in its last seconds drops off the board before it settles.
        return { ...base, status: /^(dbp|wxm):/.test(p.market ?? '') ? 'awaiting' : 'unknown', mark: null }
      }
    })
  )
}
