// Real order flow on DeepBook Predict (Sui mainnet): who traded which BTC window, which side, how much.
// Events come from Sui GraphQL because Tatum's gateway blocks LedgerService/ListEvents.
import { SuiGraphQLClient } from '@mysten/sui/graphql'
import { getConfig } from '@mysten/deepbook-v3/predict'
import { LiveDataError } from './suiLive.mjs'

const cfg = getConfig('mainnet')
const ORDERS_PKG = cfg.packages.predictOrders
const ACCOUNT_PKG = cfg.packages.account
const ENQUEUED = `${ORDERS_PKG}::queue_events::OrderEnqueued`
const FILLED = `${ORDERS_PKG}::queue_events::QueuedOrderFilled`
const ACCOUNT_CREATED = `${ACCOUNT_PKG}::account_events::AccountCreated`

const FLOW_TTL_MS = 30_000
const PAGES = 2 // 2 × 50 most recent events per type
const OWNER_SCAN_PAGES = 200 // cap on the one-time AccountCreated scan that maps accounts to owner wallets

// Strikes are tick × $0.01; the upper bound of an UP range is the +inf sentinel tick.
const TICK_USD = 0.01
const POS_INF_TICK = 2 ** 30 - 1
const MINT_KINDS = new Set([0, 1, 2])
const USD = 1e6

const client = new SuiGraphQLClient({ network: 'mainnet', url: 'https://graphql.mainnet.sui.io/graphql' })

async function recentEvents(eventType, pages = PAGES) {
  const events = []
  let before = null
  for (let i = 0; i < pages; i++) {
    const page = await client.listEvents({ filter: { eventType }, limit: 50, order: 'descending', ...(before ? { before } : {}) })
    events.push(...page.events)
    if (!page.hasNextPage || !page.endCursor) break
    before = page.endCursor
  }
  return events
}

const owners = new Map()
let ownerScan = null
let ownerCursor = null
let ownerScanDone = false
let ownerPagesRead = 0

// Walks AccountCreated newest-first in the background until every wanted account is mapped
// (or the history or page cap runs out); a later call resumes where the last one stopped.
function scanOwners(wanted) {
  if (ownerScanDone || [...wanted].every(id => owners.has(id))) return ownerScan
  ownerScan ??= (async () => {
    let before = ownerCursor
    while (ownerPagesRead < OWNER_SCAN_PAGES && [...wanted].some(id => !owners.has(id))) {
      ownerPagesRead++
      const page = await client.listEvents({
        filter: { eventType: ACCOUNT_CREATED },
        limit: 50,
        order: 'descending',
        ...(before ? { before } : {})
      })
      for (const e of page.events) if (e.json?.account_id) owners.set(e.json.account_id, e.json.owner)
      if (!page.hasNextPage || !page.endCursor) {
        ownerScanDone = true
        break
      }
      before = ownerCursor = page.endCursor
    }
  })()
    .catch(err => console.warn('[predict-flow] owner scan stopped:', err.message))
    .finally(() => {
      ownerScan = null
    })
  return ownerScan
}

function describeRequest(request) {
  const lower = Number(request?.lower_tick ?? 0)
  const higher = Number(request?.higher_tick ?? 0)
  if (higher >= POS_INF_TICK && lower > 0) return { side: 'up', strike: lower * TICK_USD }
  if (lower === 0 && higher > 0 && higher < POS_INF_TICK) return { side: 'down', strike: higher * TICK_USD }
  if (lower > 0 && higher > lower) return { side: 'range', strike: lower * TICK_USD, upper: higher * TICK_USD }
  return { side: null, strike: null }
}

let cache = null
let inflight = null

// Owners can arrive after the flow was cached (the scan runs in the background).
function withOwners(flow) {
  const owner = id => owners.get(id) ?? null
  return {
    ...flow,
    ownersResolved: owners.size,
    fills: flow.fills.map(f => ({ ...f, owner: owner(f.accountId) })),
    traders: flow.traders.map(t => ({ ...t, owner: owner(t.accountId) })),
    crowds: flow.crowds.map(c => ({ ...c, owners: c.accountIds.map(owner) }))
  }
}

export async function getPredictFlow() {
  return withOwners(await loadCached())
}

function loadCached() {
  if (cache && Date.now() - cache.at < FLOW_TTL_MS) return Promise.resolve(cache.value)
  inflight ??= load()
    .then(value => {
      cache = { at: Date.now(), value }
      return value
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

async function load() {
  let enqueued, filled
  try {
    ;[enqueued, filled] = await Promise.all([recentEvents(ENQUEUED), recentEvents(FILLED)])
  } catch (err) {
    throw new LiveDataError(`DeepBook Predict events unavailable: ${err.message}`)
  }
  scanOwners(new Set(filled.map(e => e.json.account_id)))

  const key = j => `${j.account_id}:${j.expiry_market_id}:${j.record_id}`
  const orders = new Map(enqueued.map(e => [key(e.json), e]))

  const fills = filled.map(e => {
    const j = e.json
    const order = orders.get(key(j))
    const mint = MINT_KINDS.has(Number(j.kind))
    const { side, strike, upper } = order ? describeRequest(order.json.request) : { side: null, strike: null }
    const cost = Number(j.amount) / USD
    const payout = Number(j.quantity) / USD
    return {
      digest: e.transactionDigest,
      at: new Date(Number(j.onchain_timestamp_ms)).toISOString(),
      accountId: j.account_id,
      owner: null,
      signer: order?.sender ?? null,
      marketId: j.expiry_market_id,
      closesAt: order ? new Date(Number(order.json.timing.cutoff_ms)).toISOString() : null,
      action: mint ? 'buy' : 'sell',
      side: mint ? side : 'sell',
      strike,
      upper: upper ?? null,
      cost: Math.round(cost * 100) / 100,
      payout: Math.round(payout * 100) / 100,
      probability: payout > 0 ? Math.round((cost / payout) * 1000) / 1000 : null,
      fee: Math.round(((Number(j.trading_fee) + Number(j.order_fee)) / USD) * 100) / 100
    }
  })

  const traders = new Map()
  for (const f of fills) {
    const t = traders.get(f.accountId) ?? {
      accountId: f.accountId, owner: f.owner, signer: f.signer, fills: 0, buys: 0, sells: 0,
      volume: 0, payout: 0, up: 0, down: 0, markets: new Set(), lastAt: f.at
    }
    t.fills++
    t[f.action === 'buy' ? 'buys' : 'sells']++
    t.volume += f.cost
    if (f.action === 'buy') t.payout += f.payout
    if (f.side === 'up') t.up++
    if (f.side === 'down') t.down++
    t.markets.add(f.marketId)
    t.signer ??= f.signer
    if (f.at > t.lastAt) t.lastAt = f.at
    traders.set(f.accountId, t)
  }

  // Crowds: distinct accounts buying the same direction (up / down / range) in the same window.
  const crowds = new Map()
  for (const f of fills) {
    if (f.action !== 'buy' || !f.side) continue
    const k = `${f.marketId}:${f.side}`
    const c = crowds.get(k) ?? {
      marketId: f.marketId, side: f.side, strike: f.strike, upper: f.upper, closesAt: f.closesAt,
      accounts: new Set(), fills: 0, volume: 0, payout: 0, lastAt: f.at
    }
    c.accounts.add(f.accountId)
    c.fills++
    c.volume += f.cost
    c.payout += f.payout
    if (f.at > c.lastAt) c.lastAt = f.at
    crowds.set(k, c)
  }

  const round2 = n => Math.round(n * 100) / 100
  const times = fills.map(f => f.at).sort()
  const sideVolume = side => round2(fills.filter(f => f.action === 'buy' && f.side === side).reduce((s, f) => s + f.cost, 0))
  const sideAccounts = side => new Set(fills.filter(f => f.action === 'buy' && f.side === side).map(f => f.accountId)).size
  return {
    source: 'DeepBook Predict events · Sui GraphQL (mainnet)',
    fetchedAt: new Date().toISOString(),
    window: { from: times[0] ?? null, to: times[times.length - 1] ?? null },
    totals: {
      fills: fills.length,
      traders: traders.size,
      volume: round2(fills.reduce((s, f) => s + f.cost, 0)),
      up: { volume: sideVolume('up'), accounts: sideAccounts('up') },
      down: { volume: sideVolume('down'), accounts: sideAccounts('down') },
      range: { volume: sideVolume('range'), accounts: sideAccounts('range') }
    },
    fills: fills.slice(0, 50),
    traders: [...traders.values()]
      .map(t => ({ ...t, markets: t.markets.size, volume: round2(t.volume), payout: round2(t.payout) }))
      .sort((a, b) => b.volume - a.volume),
    crowds: [...crowds.values()]
      .map(c => ({
        ...c,
        accounts: c.accounts.size,
        accountIds: [...c.accounts].slice(0, 5),
        volume: round2(c.volume),
        payout: round2(c.payout),
        avgProbability: c.payout > 0 ? Math.round((c.volume / c.payout) * 1000) / 1000 : null
      }))
      .sort((a, b) => b.accounts - a.accounts || b.volume - a.volume)
  }
}
