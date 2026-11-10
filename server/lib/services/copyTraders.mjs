// Copy trading from Polymarket wallets, executed (as paper trades) on the matching WaterX market on Sui.
// WaterX mirrors Polymarket: crypto up/down rounds share the start time, sport matches share the event
// slug (WaterX prefixes `sport-`), and binary questions are copied verbatim.
import { LiveDataError } from './suiLive.mjs'
import { getWaterxFeedItems, listWaterxEvents } from './livePredict.mjs'

const TRADES = 'https://data-api.polymarket.com/v2/trades'
const TIMEOUT_MS = 12_000
const TRADERS_TTL_MS = 60_000
const SIGNALS_TTL_MS = 20_000
const MIN_TRADER_USD = 1_000
const MAX_WALLETS = 15

const cache = new Map()
async function cached(key, ttl, load) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.value
  const value = await load()
  cache.set(key, { at: Date.now(), value })
  return value
}

export const norm = s =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9$.%' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const isPolygonAddress = a => /^0x[0-9a-fA-F]{40}$/.test(String(a ?? ''))

async function polymarketTrades(query) {
  let body
  try {
    const res = await fetch(`${TRADES}?${query}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    body = await res.json()
    if (!res.ok || !Array.isArray(body.data)) throw new Error(body.error || `HTTP ${res.status}`)
  } catch (err) {
    throw new LiveDataError(`Polymarket trades unavailable: ${err.message}`)
  }
  return body.data
}

// Lookup tables from the WaterX feed: up/down rounds by slug+start, sport matches by slug, binaries by question.
export function buildWaterxIndex() {
  return cached('copy:index', 30_000, async () => {
    const [items, events] = await Promise.all([getWaterxFeedItems(), listWaterxEvents().catch(() => [])])
    const eventSlugById = new Map(events.map(e => [e.eventId, e.id]))
    const rounds = new Map()
    const matches = new Map()
    const questions = new Map()
    for (const item of items) {
      const m = item.market
      const r = item.round
      if (!m || !r) continue
      if (m.type === 'crypto-updown') rounds.set(`${m.slug}@${r.startsAt}`, { m, r })
      else if (m.type === 'sport-match') matches.set(m.slug, { m, r })
      else if (m.type === 'prediction-binary' && m.display?.question) {
        const eventSlug = eventSlugById.get(m.eventId)
        if (eventSlug) questions.set(norm(m.display.question), { m, r, eventSlug })
      }
    }
    return { rounds, matches, questions }
  })
}

// Mid (probability), ask and bid of one side; the bid is 1 − the other side's ask.
const sideQuote = (r, key) => {
  const side = r?.sides?.find(s => s.key === key)
  const other = r?.sides?.find(s => s.key !== key)
  const cents = side?.probabilityCents ?? side?.oddsCents
  if (cents == null) return { price: null, ask: null, bid: null }
  return {
    price: Math.round(cents * 100) / 10000,
    ask: side.oddsCents == null ? null : side.oddsCents / 100,
    bid: other?.oddsCents == null ? null : Math.max(0, 1 - other.oddsCents / 100)
  }
}

// The WaterX market that mirrors a Polymarket market/outcome, with WaterX's current price, or why none does.
// `t` is { slug, eventSlug, title, outcome } on the Polymarket side.
export function mirrorOf(t, index) {
  const updown = /^([a-z]+)-updown-(\w+)-(\d+)$/.exec(t.slug ?? '')
  if (updown) {
    const hit = index.rounds.get(`crypto-${updown[1]}-updown-${updown[2]}@${updown[3]}`)
    if (!hit) return { reason: 'Round not on WaterX' }
    const side = /^up$/i.test(t.outcome) ? 'up' : /^down$/i.test(t.outcome) ? 'down' : null
    if (!side) return { reason: 'Outcome not on WaterX' }
    return { market: `wxm:${hit.m.slug}~${hit.r.id}`, outcome: side, label: side === 'up' ? 'Up' : 'Down', ...sideQuote(hit.r, side), closesAt: hit.r.endsAt, volumeUsd: Math.round(hit.r.volumeUsd ?? 0) }
  }

  const match = t.slug === t.eventSlug ? index.matches.get(`sport-${t.eventSlug}`) : null
  if (match) {
    const d = match.m.display ?? {}
    const pick = norm(t.outcome)
    const team = [
      { key: 'teamA', name: d.teamA?.name },
      { key: 'teamB', name: d.teamB?.name }
    ].find(x => x.name && pick && (norm(x.name) === pick || norm(x.name).includes(pick) || pick.includes(norm(x.name))))
    if (!team) return { reason: 'Team not matched' }
    return { market: `wxm:${match.m.slug}~${match.r.id}`, outcome: team.key, label: team.name, ...sideQuote(match.r, team.key), closesAt: match.r.endsAt, volumeUsd: Math.round(match.r.volumeUsd ?? 0) }
  }

  const binary = index.questions.get(norm(t.title))
  if (binary) {
    if (!/^yes$/i.test(t.outcome)) return { reason: 'WaterX lists YES only' }
    const option = binary.m.display.option
    return {
      market: binary.eventSlug,
      outcome: option?.code ?? binary.m.slug,
      label: `${option?.name ?? 'Yes'} · YES`,
      ...sideQuote(binary.r, 'up'),
      closesAt: binary.r.endsAt,
      volumeUsd: Math.round(binary.r.volumeUsd ?? 0)
    }
  }
  return { reason: 'Not on WaterX' }
}

const mapTrade = (t, index) => ({
  id: `pm:${t.transaction_hash}:${t.token_id}`,
  wallet: t.proxy_wallet,
  trader: t.pseudonym || null,
  side: String(t.side).toLowerCase(),
  outcome: t.outcome,
  price: t.price,
  notional: Math.round(t.size * t.price * 100) / 100,
  market: t.title,
  url: `https://polymarket.com/event/${t.event_slug}`,
  at: new Date(t.timestamp * 1000).toISOString(),
  sui: mirrorOf({ slug: t.slug, eventSlug: t.event_slug, title: t.title, outcome: t.outcome }, index)
})

// Most active large Polymarket takers right now, with how many of their trades WaterX can mirror.
export function getPolymarketTraders() {
  return cached('copy:traders', TRADERS_TTL_MS, async () => {
    const [raw, index] = await Promise.all([
      polymarketTrades(`limit=500&filterType=CASH&filterAmount=${MIN_TRADER_USD}&takerOnly=true`),
      buildWaterxIndex()
    ])
    const byWallet = new Map()
    for (const t of raw) {
      const trade = mapTrade(t, index)
      const w = byWallet.get(trade.wallet) ?? {
        wallet: trade.wallet,
        trader: trade.trader,
        volume: 0,
        trades: 0,
        buys: 0,
        copyable: 0,
        lastAt: trade.at,
        lastMarket: trade.market
      }
      w.volume += trade.notional
      w.trades++
      if (trade.side === 'buy') w.buys++
      if (trade.side === 'buy' && trade.sui.market) w.copyable++
      if (trade.at > w.lastAt) {
        w.lastAt = trade.at
        w.lastMarket = trade.market
      }
      byWallet.set(trade.wallet, w)
    }
    const traders = [...byWallet.values()]
      .map(w => ({ ...w, volume: Math.round(w.volume) }))
      // Wallets whose trades WaterX can mirror first, then by size.
      .sort((a, b) => Number(b.copyable > 0) - Number(a.copyable > 0) || b.volume - a.volume)
      .slice(0, 40)
    return { fetchedAt: new Date().toISOString(), minUsd: MIN_TRADER_USD, traders }
  })
}

// Recent buys by the given Polymarket wallets, each with its WaterX copy target.
export async function getPolymarketSignals(wallets) {
  const list = [...new Set(wallets.filter(isPolygonAddress).map(w => w.toLowerCase()))].slice(0, MAX_WALLETS)
  if (list.length === 0) return { fetchedAt: new Date().toISOString(), signals: [] }
  const index = await buildWaterxIndex()
  const per = await Promise.allSettled(
    list.map(w => cached(`copy:w:${w}`, SIGNALS_TTL_MS, () => polymarketTrades(`user=${w}&limit=25&takerOnly=false`)))
  )
  const dayAgo = Date.now() - 86_400_000
  const signals = per
    .flatMap(p => (p.status === 'fulfilled' ? p.value : []))
    .map(t => mapTrade(t, index))
    .filter(t => t.side === 'buy' && Date.parse(t.at) >= dayAgo)
    .sort((a, b) => b.at.localeCompare(a.at))
  return { fetchedAt: new Date().toISOString(), signals }
}
