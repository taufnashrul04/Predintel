// Live cross-venue divergence: WaterX binary markets matched to the same Polymarket market.
// WaterX mirrors Polymarket questions verbatim, so markets pair up by normalized question text.
// Polymarket prices come from its public CLOB API (sampling-markets: active, order-book markets).
import { LiveDataError } from './suiLive.mjs'
import { getWaterxFeedItems, listWaterxEvents } from './livePredict.mjs'

const CLOB_SAMPLING = 'https://clob.polymarket.com/sampling-markets'
const PM_TTL_MS = 60_000
const MAX_PAGES = 40
const TIMEOUT_MS = 15_000

const norm = s =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9$.%' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

let pmCache = null
let pmInflight = null

// question → { slug, yes } for every active Polymarket market (about 12k, paged by 1,000).
function polymarketByQuestion() {
  if (pmCache && Date.now() - pmCache.at < PM_TTL_MS) return Promise.resolve(pmCache.map)
  pmInflight ??= (async () => {
    const map = new Map()
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
        const yes = m.tokens?.find(t => /^yes$/i.test(t.outcome))
        if (yes?.price == null) continue
        map.set(norm(m.question), { slug: m.market_slug, yes: yes.price })
      }
      if (!body.next_cursor || body.next_cursor === 'LTE=' || body.data.length === 0) break
      cursor = body.next_cursor
    }
    pmCache = { at: Date.now(), map }
    return map
  })().finally(() => {
    pmInflight = null
  })
  return pmInflight
}

const pp = n => Math.round(n * 1000) / 10

export async function getLiveDivergence({ minGapPp = 0.5 } = {}) {
  const [pm, items, events] = await Promise.all([
    polymarketByQuestion(),
    getWaterxFeedItems(),
    listWaterxEvents().catch(() => [])
  ])
  // WaterX market → its event slug, so a row can open the in-app Trade tab on that event.
  const eventSlugById = new Map(events.map(e => [e.eventId, e.id]))

  let matched = 0
  const rows = []
  for (const item of items) {
    const m = item.market
    const r = item.round
    if (m?.type !== 'prediction-binary' || !m.display?.question || r?.phase !== 'open') continue
    const up = r.sides?.find(s => s.key === 'up')
    const down = r.sides?.find(s => s.key === 'down')
    if (up?.oddsCents == null || down?.oddsCents == null || up.probabilityCents == null) continue
    const poly = pm.get(norm(m.display.question))
    if (!poly) continue
    matched++

    const wxMid = up.probabilityCents / 100
    const wxAsk = up.oddsCents / 100
    const wxBid = Math.max(0, 1 - down.oddsCents / 100)
    const gap = wxMid - poly.yes
    if (Math.abs(gap) * 100 < minGapPp) continue

    // Executable only when Polymarket sits outside WaterX's own bid/ask.
    const edge = poly.yes > wxAsk ? poly.yes - wxAsk : poly.yes < wxBid ? wxBid - poly.yes : 0
    const lowIsWaterx = wxMid < poly.yes
    const waterx = {
      venueId: 'waterx',
      name: 'WaterX',
      price: wxMid,
      ask: wxAsk,
      bid: wxBid,
      url: `https://waterx.app/en/predict/market/prediction/${m.slug}`,
      tradeId: eventSlugById.get(m.eventId) ?? null,
      outcomeId: m.display.option?.code ?? null
    }
    const polymarket = { venueId: 'polymarket', name: 'Polymarket', price: poly.yes, url: `https://polymarket.com/market/${poly.slug}` }
    rows.push({
      id: m.id,
      question: m.display.question,
      category: m.category,
      volumeUsd: Math.round(r.volumeUsd ?? 0),
      closesAt: new Date(r.endsAt * 1000).toISOString(),
      consensus: (wxMid + poly.yes) / 2,
      gapPp: pp(Math.abs(gap)),
      edgePp: pp(edge),
      low: lowIsWaterx ? waterx : polymarket,
      high: lowIsWaterx ? polymarket : waterx
    })
  }

  rows.sort((a, b) => b.gapPp - a.gapPp)
  return {
    fetchedAt: new Date().toISOString(),
    source: 'WaterX predict feed × Polymarket CLOB',
    matched,
    minGapPp,
    rows
  }
}
