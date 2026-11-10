// Read-only market feeds from other prediction venues, for comparing prices against WaterX.
// Paper trades never go to these venues: a row WaterX also lists links to the WaterX ticket on Sui.
//   Opinion (BNB Chain): public OpenAPI; price = order-book mid, else the last trade.
//   Limitless (Base): public markets API; price = the venue's current YES price.
import { LiveDataError } from './suiLive.mjs'
import { buildWaterxIndex, mirrorOf, norm } from './copyTraders.mjs'
import { getPolymarketBoard } from './polymarketMarkets.mjs'

const TTL_MS = 120_000
const TIMEOUT_MS = 12_000
const cache = new Map()
const inflight = new Map()

function cached(key, load) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.value)
  if (!inflight.has(key)) {
    inflight.set(
      key,
      load()
        .then(value => {
          cache.set(key, { at: Date.now(), value })
          return value
        })
        .finally(() => inflight.delete(key))
    )
  }
  return inflight.get(key)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// Retries rate-limited calls with backoff; Opinion's public API allows only a few requests a second.
async function getJson(url, venue) {
  let lastError
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
      const body = await res.json().catch(() => ({}))
      const message = body?.message || body?.errmsg || `HTTP ${res.status}`
      if (res.status === 429 || /rate limit/i.test(String(message))) {
        lastError = new Error(message)
        await sleep(800 * 2 ** attempt)
        continue
      }
      if (!res.ok || (body?.errno != null && body.errno !== 0)) throw new Error(message)
      return body
    } catch (err) {
      lastError = err
      break
    }
  }
  throw new LiveDataError(`${venue} unavailable: ${lastError.message}`)
}

// Runs `fn` over `items` with at most `n` requests in flight.
async function pool(items, n, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++
        out[k] = await fn(items[k]).catch(() => null)
      }
    })
  )
  return out
}

const categoryFrom = words => {
  const t = words.map(w => String(w).toLowerCase())
  if (t.some(w => /crypto|bitcoin|btc|eth|solana|minutely|hourly|daily/.test(w))) return 'crypto'
  if (t.some(w => /sport|football|basketball|nba|nfl|soccer|esports|cs2|tennis|mlb|nhl/.test(w))) return 'sports'
  if (t.some(w => /politic|econom|finance|fed|election|macro|world|business/.test(w))) return 'macro'
  return 'culture'
}

// ---- Opinion ----
const OPINION = 'https://openapi.opinion.trade/openapi'
const OPINION_MAX_LEGS = 40

async function opinionPrice(tokenId) {
  const book = await getJson(`${OPINION}/token/orderbook?token_id=${tokenId}`, 'Opinion')
  const bid = Math.max(0, ...(book.result?.bids ?? []).map(b => Number(b.price)))
  const asks = (book.result?.asks ?? []).map(a => Number(a.price)).filter(p => p > 0)
  const ask = asks.length ? Math.min(...asks) : 0
  if (bid > 0 && ask > 0) return Math.round(((bid + ask) / 2) * 10000) / 10000
  const last = await getJson(`${OPINION}/token/latest-price?token_id=${tokenId}`, 'Opinion')
  const p = Number(last.result?.price)
  return p > 0 ? Math.round(p * 10000) / 10000 : null
}

function opinionMarkets() {
  return cached('opinion', async () => {
    const markets = []
    for (let page = 1; page <= 10; page++) {
      const body = await getJson(`${OPINION}/market?limit=20&page=${page}&status=activated`, 'Opinion')
      const list = body.result?.list ?? []
      markets.push(...list)
      if (list.length < 20 || markets.length >= (body.result?.total ?? 0)) break
    }
    // Binary markets quote YES; categorical ones become one row per option.
    const legs = markets.flatMap(m =>
      m.childMarkets?.length
        ? m.childMarkets.map(c => ({
            id: `op:${c.marketId}`,
            title: `${m.marketTitle} · ${c.marketTitle}`,
            question: c.marketTitle,
            lead: 'Yes',
            tokenId: c.yesTokenId,
            parentId: m.marketId,
            volume: Number(m.volume) || null,
            closesAt: c.cutoffAt || m.cutoffAt,
            labels: m.labels ?? []
          }))
        : [
            {
              id: `op:${m.marketId}`,
              title: m.marketTitle,
              question: m.marketTitle,
              lead: m.yesLabel && !/^yes$/i.test(m.yesLabel) ? m.yesLabel : 'Yes',
              tokenId: m.yesTokenId,
              parentId: m.marketId,
              volume: Number(m.volume) || null,
              closesAt: m.cutoffAt,
              labels: m.labels ?? []
            }
          ]
    )
    // The API prices one token per call under a tight rate limit, so price only the busiest options.
    legs.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    legs.length = Math.min(legs.length, OPINION_MAX_LEGS)
    const prices = await pool(legs, 4, leg => opinionPrice(leg.tokenId))
    return legs
      .map((leg, k) => ({
        id: leg.id,
        title: leg.title,
        question: leg.question,
        category: categoryFrom(leg.labels),
        lead: leg.lead,
        price: prices[k],
        volume: leg.volume,
        closesAt: leg.closesAt ? new Date(leg.closesAt * 1000).toISOString() : null,
        url: `https://app.opinion.trade/detail?topicId=${leg.parentId}`,
        mirrorKey: { slug: null, eventSlug: undefined, title: leg.question, outcome: leg.lead }
      }))
      .filter(r => r.price != null)
  })
}

// ---- Limitless ----
const LIMITLESS = 'https://api.limitless.exchange'
const REC = { min: 'm', hour: 'h', day: 'd' }

function limitlessMarkets() {
  return cached('limitless', async () => {
    const markets = []
    for (let page = 1; page <= 20; page++) {
      const body = await getJson(`${LIMITLESS}/markets/active?limit=25&page=${page}`, 'Limitless')
      const list = body.data ?? []
      markets.push(...list.flatMap(m => (Array.isArray(m.markets) && m.markets.length ? m.markets.map(c => ({ ...c, parent: m })) : [m])))
      if (list.length < 25) break
    }
    return markets
      .filter(m => Array.isArray(m.prices) && m.prices.length >= 2 && !m.expired)
      .map(m => {
        // "BTC Up or Down - 5 Min" rounds line up with WaterX's up/down rounds by start time.
        const ud = /^([A-Za-z]+) Up or Down - (\d+) (Min|Hour|Day)/i.exec(m.title ?? '')
        const start = m.startAt ? Math.round(Date.parse(m.startAt) / 1000) : null
        const slug = ud && start ? `${ud[1].toLowerCase()}-updown-${ud[2]}${REC[ud[3].toLowerCase()]}-${start}` : null
        const title = m.parent ? `${m.parent.title} · ${m.title}` : m.title
        const price = Number(m.prices[0]) > 1 ? Number(m.prices[0]) / 100 : Number(m.prices[0])
        return {
          id: `lm:${m.slug ?? m.id}`,
          title,
          question: m.title,
          category: categoryFrom([...(m.categories ?? []), ...(m.tags ?? [])]),
          lead: ud ? 'Up' : 'Yes',
          price,
          volume: Number(m.volumeFormatted) || null,
          closesAt: m.expirationTimestamp ? new Date(m.expirationTimestamp).toISOString() : null,
          url: `https://limitless.exchange/markets/${m.slug ?? m.id}`,
          mirrorKey: slug ? { slug, eventSlug: undefined, title: m.title, outcome: 'Up' } : { slug: null, eventSlug: undefined, title: m.title, outcome: 'Yes' }
        }
      })
      .filter(r => Number.isFinite(r.price) && r.price > 0)
  })
}

const FEEDS = { opinion: opinionMarkets, limitless: limitlessMarkets }
export const COMPARE_VENUES = ['polymarket', ...Object.keys(FEEDS)]

// Board rows for one compare venue, each with its WaterX mirror (if any) and the price gap.
export async function getVenueBoard(venue, { q = '', category = 'all', limit = 300 } = {}) {
  if (venue === 'polymarket') return getPolymarketBoard({ q, category, limit })
  const feed = FEEDS[venue]
  if (!feed) throw new LiveDataError(`Venue '${venue}' has no live feed.`, 404)
  const [markets, index] = await Promise.all([feed(), buildWaterxIndex()])
  const needle = norm(q)
  const rows = markets
    .filter(m => (!needle || norm(m.title).includes(needle)) && (category === 'all' || m.category === category))
    .map(m => {
      const wx = mirrorOf(m.mirrorKey, index)
      const mirror = wx.market && wx.price != null ? { market: wx.market, outcome: wx.outcome, label: wx.label, price: wx.price } : null
      const { mirrorKey, question, ...row } = m
      return { ...row, waterx: mirror, gapPp: mirror ? Math.round(Math.abs(m.price - mirror.price) * 1000) / 10 : null }
    })
    .sort((a, b) => (a.waterx && b.waterx ? b.gapPp - a.gapPp : a.waterx ? -1 : b.waterx ? 1 : (b.volume ?? 0) - (a.volume ?? 0)))
  return {
    fetchedAt: new Date().toISOString(),
    total: rows.length,
    mirrored: rows.filter(r => r.waterx).length,
    rows: rows.slice(0, Math.max(1, Math.min(1000, limit)))
  }
}
