// Paper trading: Sui sign-in sessions, server-priced paper fills, and live marks / settlement.
// The journal itself lives in the user's browser; the server only proves wallet ownership and prices.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { SuiGraphQLClient } from '@mysten/sui/graphql'
import { getConfig } from '@mysten/deepbook-v3/predict'
import { MOCK_QUOTES } from '../mock/quotes.mjs'
import { computeTradeQuote, findEvent, suiListingVenues, TradeError, MAX_ORDER_USDC } from './trading.mjs'
import { getLiveMarket, isLiveMarketId } from './livePredict.mjs'

const SESSION_TTL_MS = 24 * 60 * 60 * 1000
const CHALLENGE_TTL_MS = 5 * 60 * 1000
// Sessions survive restarts only when a secret is configured; otherwise users simply sign in again.
const SECRET = process.env.PAPER_SESSION_SECRET || randomBytes(32).toString('hex')

const challenges = new Map()

export function createChallenge(address) {
  const nonce = randomBytes(12).toString('hex')
  const message = [
    'PredictIntel paper journal sign-in',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued: ${new Date().toISOString()}`,
    'Signing proves you own this wallet. It does not move funds or cost gas.'
  ].join('\n')
  challenges.set(address, { message, expiresAt: Date.now() + CHALLENGE_TTL_MS })
  return message
}

export function takeChallenge(address) {
  const c = challenges.get(address)
  challenges.delete(address)
  if (!c || c.expiresAt < Date.now()) return null
  return c.message
}

const sign = payload => createHmac('sha256', SECRET).update(payload).digest('base64url')

export function issueSession(address) {
  const expiresAt = Date.now() + SESSION_TTL_MS
  const payload = Buffer.from(JSON.stringify({ a: address, e: expiresAt })).toString('base64url')
  return { token: `${payload}.${sign(payload)}`, address, expiresAt: new Date(expiresAt).toISOString() }
}

export function readSession(header) {
  const token = typeof header === 'string' ? header.replace(/^Bearer\s+/i, '') : ''
  const [payload, mac] = token.split('.')
  if (!payload || !mac) return null
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const { a, e } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return e > Date.now() ? { address: a, expiresAt: e } : null
  } catch {
    return null
  }
}

// A paper buy priced exactly like a real order: live ask on WaterX / DeepBook Predict, book walk on demo markets.
export function paperFill(input) {
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
        // A DeepBook window in its last seconds drops off the board before it settles.
        return { ...base, status: p.market?.startsWith('dbp:') ? 'awaiting' : 'unknown', mark: null }
      }
    })
  )
}
