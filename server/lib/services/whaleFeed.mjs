// Live whale tape: large taker trades on Polymarket (many WaterX markets mirror them) plus the biggest
// recent DeepBook Predict fills on Sui. Both are public; Polymarket's Data API v2 needs no key.
import { LiveDataError } from './suiLive.mjs'
import { getPredictFlow } from './predictFlow.mjs'

const POLYMARKET_TRADES = 'https://data-api.polymarket.com/v2/trades'
const TTL_MS = 20_000
const TIMEOUT_MS = 12_000
export const WHALE_MIN_USD = 10_000

const cache = new Map()

async function polymarketWhales(minUsd) {
  const hit = cache.get(minUsd)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  let body
  try {
    const url = `${POLYMARKET_TRADES}?limit=500&filterType=CASH&filterAmount=${minUsd}&takerOnly=true`
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    body = await res.json()
    if (!res.ok || !Array.isArray(body.data)) throw new Error(body.error || `HTTP ${res.status}`)
  } catch (err) {
    throw new LiveDataError(`Polymarket trades unavailable: ${err.message}`)
  }
  const value = body.data.map(t => ({
    id: `pm:${t.transaction_hash}:${t.token_id}:${t.timestamp}`,
    venue: 'polymarket',
    chain: 'Polygon',
    wallet: t.proxy_wallet,
    trader: t.pseudonym || t.name || null,
    side: String(t.side).toLowerCase(),
    outcome: t.outcome,
    shares: t.size,
    price: t.price,
    notional: Math.round(t.size * t.price),
    market: t.title,
    url: `https://polymarket.com/event/${t.event_slug}`,
    txUrl: `https://polygonscan.com/tx/${t.transaction_hash}`,
    at: new Date(t.timestamp * 1000).toISOString()
  }))
  cache.set(minUsd, { at: Date.now(), value })
  return value
}

export async function getWhaleTape({ minUsd = WHALE_MIN_USD } = {}) {
  const [pm, flow] = await Promise.allSettled([polymarketWhales(minUsd), getPredictFlow()])
  if (pm.status === 'rejected' && flow.status === 'rejected') throw pm.reason

  const polymarket = pm.status === 'fulfilled' ? pm.value : []
  // DeepBook Predict is young and its tickets are small, so show its largest recent fills rather than a cutoff.
  const deepbook = flow.status === 'fulfilled'
    ? [...flow.value.fills]
        .filter(f => f.action === 'buy' && f.side)
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5)
        .map(f => ({
          id: `dbp:${f.digest}`,
          venue: 'deepbook',
          chain: 'Sui',
          wallet: f.owner,
          trader: null,
          side: 'buy',
          outcome: f.side === 'range' ? 'Range' : f.side === 'up' ? 'Up' : 'Down',
          shares: f.payout,
          price: f.probability,
          notional: f.cost,
          market: f.strike != null ? `BTC ${f.side === 'down' ? '≤' : '>'} $${Math.round(f.strike).toLocaleString('en-US')} window` : 'BTC window',
          url: f.owner ? `/wallets/${f.owner}` : null,
          txUrl: `https://suiscan.xyz/mainnet/tx/${f.digest}`,
          at: f.at
        }))
    : []

  const dayAgo = Date.now() - 86_400_000
  const lastDay = polymarket.filter(t => Date.parse(t.at) >= dayAgo)
  return {
    fetchedAt: new Date().toISOString(),
    minUsd,
    sources: {
      polymarket: pm.status === 'fulfilled' ? 'Polymarket Data API v2' : pm.reason.message,
      deepbook: flow.status === 'fulfilled' ? 'DeepBook Predict events · Sui GraphQL' : flow.reason.message
    },
    // The API returns at most 500 trades; when all of them fall inside 24h the true count is higher.
    count24h: lastDay.length,
    count24hCapped: polymarket.length === 500 && lastDay.length === polymarket.length,
    volume24h: Math.round(lastDay.reduce((s, t) => s + t.notional, 0)),
    trades: polymarket,
    sui: deepbook
  }
}
