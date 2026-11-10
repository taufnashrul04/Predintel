// Every active Polymarket market (public CLOB API), with the same market on WaterX when it exists.
// Polymarket is read-only here: paper trades go to the WaterX mirror on Sui.
import { LiveDataError } from './suiLive.mjs'
import { buildWaterxIndex, mirrorOf, norm } from './copyTraders.mjs'

const CLOB_SAMPLING = 'https://clob.polymarket.com/sampling-markets'
const TTL_MS = 60_000
const MAX_PAGES = 40
const TIMEOUT_MS = 15_000

let cache = null
let inflight = null

// About 12k active order-book markets, paged by 1,000; shared with the divergence scanner.
export function allPolymarketMarkets() {
  if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.list)
  inflight ??= (async () => {
    const list = []
    let cursor = ''
    for (let page = 0; page < MAX_PAGES; page++) {
      let body
      try {
        const res = await fetch(`${CLOB_SAMPLING}?next_cursor=${encodeURIComponent(cursor)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
        body = await res.json()
        if (!res.ok || !Array.isArray(body.data)) throw new Error(body.error || `HTTP ${res.status}`)
      } catch (err) {
        throw new LiveDataError(`Polymarket markets unavailable: ${err.message}`)
      }
      for (const m of body.data) {
        if (!m.active || m.closed || !m.accepting_orders) continue
        const tokens = (m.tokens ?? []).filter(t => t.price != null).map(t => ({ outcome: t.outcome, price: t.price }))
        if (tokens.length < 2) continue
        list.push({ question: m.question, slug: m.market_slug, endsAt: m.end_date_iso || null, tags: m.tags ?? [], tokens })
      }
      if (!body.next_cursor || body.next_cursor === 'LTE=' || body.data.length === 0) break
      cursor = body.next_cursor
    }
    cache = { at: Date.now(), list }
    return list
  })().finally(() => {
    inflight = null
  })
  return inflight
}

export function categoryOf(tags) {
  const t = tags.map(x => String(x).toLowerCase())
  if (t.some(x => x.includes('crypto') || x.includes('bitcoin') || x.includes('ethereum'))) return 'crypto'
  if (t.some(x => x.includes('sport') || ['nba', 'nfl', 'soccer', 'mlb', 'nhl', 'esports', 'tennis'].includes(x))) return 'sports'
  if (t.some(x => ['politics', 'economy', 'finance', 'business', 'fed', 'elections', 'geopolitics', 'world'].some(k => x.includes(k)))) return 'macro'
  return 'culture'
}

// Searchable board rows: Polymarket price, the WaterX mirror's price, and the gap between them.
export async function getPolymarketBoard({ q = '', category = 'all', limit = 300 } = {}) {
  const [markets, index] = await Promise.all([allPolymarketMarkets(), buildWaterxIndex()])
  const needle = norm(q)
  const rows = []
  for (const m of markets) {
    if (needle && !norm(m.question).includes(needle)) continue
    const cat = categoryOf(m.tags)
    if (category !== 'all' && cat !== category) continue
    // Binary markets quote YES; matches and up/down quote their first outcome.
    const lead = m.tokens.find(t => /^yes$/i.test(t.outcome)) ?? m.tokens[0]
    const mirror = mirrorOf({ slug: m.slug, eventSlug: m.slug, title: m.question, outcome: lead.outcome }, index)
    const wx = mirror.market && mirror.price != null ? mirror : null
    rows.push({
      id: `pm:${m.slug}`,
      title: m.question,
      category: cat,
      lead: lead.outcome,
      price: lead.price,
      closesAt: m.endsAt,
      url: `https://polymarket.com/market/${m.slug}`,
      waterx: wx ? { market: wx.market, outcome: wx.outcome, label: wx.label, price: wx.price } : null,
      gapPp: wx ? Math.round(Math.abs(lead.price - wx.price) * 1000) / 10 : null
    })
  }
  // Markets WaterX also lists first (biggest gap on top), then the rest by closing date.
  rows.sort((a, b) =>
    a.waterx && b.waterx
      ? b.gapPp - a.gapPp
      : a.waterx
        ? -1
        : b.waterx
          ? 1
          : (a.closesAt ? Date.parse(a.closesAt) : Infinity) - (b.closesAt ? Date.parse(b.closesAt) : Infinity)
  )
  return {
    fetchedAt: new Date().toISOString(),
    total: rows.length,
    mirrored: rows.filter(r => r.waterx).length,
    rows: rows.slice(0, Math.max(1, Math.min(1000, limit)))
  }
}
