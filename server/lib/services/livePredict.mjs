// Live prediction markets on the two Sui venues.
// - WaterX: its public predict API (the same one waterx.app reads; undocumented, read-only use).
// - DeepBook Predict: on-chain BTC up/down windows, read through @mysten/deepbook-v3/predict.
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { predict } from '@mysten/deepbook-v3/predict'
import { LiveDataError } from './suiLive.mjs'

const WATERX_API = 'https://api.waterx.app'
const TIMEOUT_MS = 12_000
const LIST_TTL_MS = 60_000
const DETAIL_TTL_MS = 20_000
const DEEPBOOK_TTL_MS = 8_000
// Leave room to quote, sign and land before a DeepBook Predict window closes.
const DEEPBOOK_MIN_LEFT_MS = 20_000

const cache = new Map()
const inflight = new Map()

async function cached(key, ttl, load) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.value
  if (inflight.has(key)) return inflight.get(key)
  const p = load()
    .then(value => {
      cache.set(key, { at: Date.now(), value })
      return value
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

const round4 = n => Math.round(n * 10000) / 10000

async function waterx(path) {
  let body
  try {
    const res = await fetch(`${WATERX_API}${path}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    body = await res.json()
    if (!res.ok || !body.success) throw new Error(body?.error?.message || `HTTP ${res.status}`)
  } catch (err) {
    throw new LiveDataError(`WaterX API unavailable: ${err.message}`)
  }
  return body.data
}

const WATERX_CATEGORY = { finance: 'macro', tech: 'culture', crypto: 'crypto', sports: 'sports' }

// Event list: the top two options of each event, enough for a market board.
export function listWaterxEvents() {
  return cached('wx:list', LIST_TTL_MS, async () => {
    const { events } = await waterx('/predict/events?limit=100')
    return events
      .filter(e => e.settlesAt * 1000 > Date.now())
      .map(e => ({
        id: `wx:${e.slug}`,
        slug: `wx:${e.slug}`,
        venueId: 'waterx',
        title: e.title,
        category: WATERX_CATEGORY[e.category] ?? e.category,
        volumeUsd: Math.round(e.volumeUsd),
        settlesAt: new Date(e.settlesAt * 1000).toISOString(),
        url: 'https://waterx.app/en/predict',
        preview: e.preview.map(p => ({ id: p.code, label: p.name, price: round4(p.yesCents / 100) }))
      }))
  })
}

// Full event: every option with its YES ask and NO ask (the YES bid is 1 − NO ask).
function getWaterxEvent(slug) {
  return cached(`wx:${slug}`, DETAIL_TTL_MS, async () => {
    const data = await waterx(`/predict/events/${encodeURIComponent(slug)}`)
    const summary = (await listWaterxEvents().catch(() => [])).find(e => e.id === `wx:${slug}`)
    const outcomes = data.items
      .map(item => {
        const up = item.nextRound?.sides?.find(s => s.key === 'up')
        const down = item.nextRound?.sides?.find(s => s.key === 'down')
        if (item.nextRound?.phase !== 'open' || up?.oddsCents == null || down?.oddsCents == null) return null
        const ask = round4(up.oddsCents / 100)
        const bid = round4(Math.max(0, 1 - down.oddsCents / 100))
        return {
          // Binary options carry `option`; sport awards carry `candidate`.
          id: (item.market.display?.option ?? item.market.display?.candidate)?.code ?? item.market.slug,
          label: (item.market.display?.option ?? item.market.display?.candidate)?.name ?? item.market.title ?? item.market.slug,
          ask,
          bid,
          mid: round4((ask + bid) / 2),
          volumeUsd: Math.round(item.nextRound.volumeUsd ?? 0),
          onchainId: up.trade?.marketId ?? null
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mid - a.mid)
    if (outcomes.length === 0) throw new LiveDataError('This WaterX event has no open options right now.', 409)
    return {
      id: `wx:${slug}`,
      slug: `wx:${slug}`,
      venueId: 'waterx',
      title: data.event.title,
      category: summary?.category ?? 'live',
      volumeUsd: summary?.volumeUsd ?? null,
      settlesAt: summary?.settlesAt ?? null,
      url: 'https://waterx.app/en/predict',
      outcomes,
      fetchedAt: new Date().toISOString()
    }
  })
}

let predictClient
const getPredictClient = () =>
  (predictClient ??= new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' }).$extend(
    predict({ network: 'mainnet' })
  ))

const usd = n => n.toLocaleString('en-US', { maximumFractionDigits: 2 })
const hhmm = ms => new Date(ms).toISOString().slice(11, 16)

// Open BTC up/down windows with their on-chain prices at the reference strike.
export function listDeepbookMarkets() {
  return cached('dbp:list', DEEPBOOK_TTL_MS, async () => {
    try {
      const client = getPredictClient()
      const markets = await client.predict.read.markets()
      const open = markets
        .filter(m => Number(m.expiryMs) > Date.now() + DEEPBOOK_MIN_LEFT_MS && !m.mintPaused && m.referencePrice != null)
        .sort((a, b) => Number(a.expiryMs) - Number(b.expiryMs))
      return await Promise.all(
        open.map(async m => {
          const { up, down } = await client.predict.read.price({
            underlying: 'BTC',
            expiryMs: m.expiryMs,
            strike: 'reference',
            side: 'up'
          })
          const expiryMs = Number(m.expiryMs)
          return {
            id: `dbp:${m.id}`,
            slug: `dbp:${m.id}`,
            venueId: 'deepbook',
            title: `BTC above $${usd(m.referencePrice)} at ${hhmm(expiryMs)} UTC?`,
            category: 'crypto',
            underlying: 'BTC',
            referencePrice: m.referencePrice,
            settlesAt: new Date(expiryMs).toISOString(),
            url: 'https://docs.sui.io/onchain-finance/deepbook-predict/',
            outcomes: [
              { id: 'up', label: 'Up', ask: round4(up), bid: round4(1 - down), mid: round4(up) },
              { id: 'down', label: 'Down', ask: round4(down), bid: round4(1 - up), mid: round4(down) }
            ],
            fetchedAt: new Date().toISOString()
          }
        })
      )
    } catch (err) {
      if (err instanceof LiveDataError) throw err
      throw new LiveDataError(`DeepBook Predict unavailable: ${err.message}`)
    }
  })
}

export async function getLiveMarket(id) {
  if (id.startsWith('wx:')) return getWaterxEvent(id.slice(3))
  if (id.startsWith('dbp:')) {
    const market = (await listDeepbookMarkets()).find(m => m.id === id)
    if (!market) throw new LiveDataError('This DeepBook Predict window has closed. Pick a newer one.', 410)
    return market
  }
  return null
}

export const isLiveMarketId = id => typeof id === 'string' && (id.startsWith('wx:') || id.startsWith('dbp:'))
