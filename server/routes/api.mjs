import { Router } from 'express'
import { tatumRpc, tatumFetch } from '../tatum-client.mjs'

const router = Router()

// Venues metadata
export const VENUES = [
  { id: 'polymarket', name: 'Polymarket', chain: 'Polygon', type: 'orderbook', color: '#2E5CFF', url: 'https://polymarket.com', status: 'live', latencyMs: 42 },
  { id: 'predictfun', name: 'Predict.fun', chain: 'BNB Chain', type: 'orderbook', color: '#F0B90B', url: 'https://predict.fun', status: 'live', latencyMs: 88 },
  { id: 'waterx', name: 'WaterX', chain: 'Sui', type: 'amm', color: '#38BDF8', url: 'https://waterx.app/en/predict', status: 'live', latencyMs: 34 },
  { id: 'deepbook', name: 'DeepBook', chain: 'Sui', type: 'orderbook', color: '#4ADE80', url: 'https://deepbook.tech', status: 'live', latencyMs: 29 },
  { id: 'opinion', name: 'Opinion', chain: 'BNB Chain', type: 'orderbook', color: '#F472B6', url: 'https://opinion.trade', status: 'live', latencyMs: 95 },
  { id: 'sxbet', name: 'SX Bet', chain: 'SX Network', type: 'orderbook', color: '#FB923C', url: 'https://sx.bet', status: 'live', latencyMs: 110 },
  { id: 'limitless', name: 'Limitless', chain: 'Base', type: 'orderbook', color: '#A3A3A3', url: 'https://limitless.exchange', status: 'live', latencyMs: 52 }
]

// 14 events across 5 categories
export const MOCK_EVENTS = [
  {
    id: 'evt-btc-150k',
    slug: 'btc-above-150k-dec-31',
    title: 'BTC above $150k on Dec 31?',
    description: 'Resolves YES if Bitcoin (BTC) trades at or above $150,000.00 USD on Binance spot before 23:59:59 UTC on December 31, 2026.',
    category: 'crypto',
    tags: ['bitcoin', 'crypto', 'all-time-high'],
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    status: 'open',
    outcomes: [{ id: 'yes', label: 'YES' }, { id: 'no', label: 'NO' }],
    resolutionSource: 'Binance BTC/USDT 1s candle index'
  },
  {
    id: 'evt-sui-5',
    slug: 'sui-above-5-end-q4',
    title: 'SUI above $5 by end of Q4?',
    description: 'Resolves YES if SUI token price reaches or exceeds $5.00 USD on Coinbase or Binance at any point in Q4 2026.',
    category: 'crypto',
    tags: ['sui', 'layer1', 'defi'],
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    status: 'open',
    outcomes: [{ id: 'yes', label: 'YES' }, { id: 'no', label: 'NO' }],
    resolutionSource: 'CoinGecko Aggregated Volume-Weighted Index'
  },
  {
    id: 'evt-fed-dec-cut',
    slug: 'fed-cuts-rates-december-meeting',
    title: 'Fed cuts rates at December meeting?',
    description: 'Resolves YES if the Federal Reserve cuts the target federal funds rate range by at least 25 basis points at the FOMC December meeting.',
    category: 'macro',
    tags: ['fed', 'interest-rates', 'fomc'],
    startDate: '2026-10-15T00:00:00Z',
    endDate: '2026-12-16T19:00:00Z',
    status: 'open',
    outcomes: [{ id: 'yes', label: 'YES' }, { id: 'no', label: 'NO' }],
    resolutionSource: 'Federal Reserve Press Release'
  },
  {
    id: 'evt-us-cpi-3pct',
    slug: 'us-cpi-yoy-above-3pct-november',
    title: 'US CPI YoY above 3% in November?',
    description: 'Resolves YES if US Consumer Price Index YoY headline rate is strictly above 3.0% in the Bureau of Labor Statistics November release.',
    category: 'macro',
    tags: ['cpi', 'inflation', 'economy'],
    startDate: '2026-10-20T00:00:00Z',
    endDate: '2026-12-11T13:30:00Z',
    status: 'open',
    outcomes: [{ id: 'yes', label: 'YES' }, { id: 'no', label: 'NO' }],
    resolutionSource: 'U.S. Bureau of Labor Statistics'
  },
  {
    id: 'evt-lakers-celtics',
    slug: 'lakers-vs-celtics-lakers-win',
    title: 'Lakers vs Celtics — Lakers win?',
    description: 'Resolves YES if the Los Angeles Lakers defeat the Boston Celtics in their upcoming regular season clash.',
    category: 'sports',
    tags: ['nba', 'basketball', 'lakers'],
    startDate: '2026-10-25T00:00:00Z',
    endDate: '2026-11-04T04:30:00Z',
    status: 'open',
    outcomes: [{ id: 'yes', label: 'YES' }, { id: 'no', label: 'NO' }],
    resolutionSource: 'Official NBA.com Box Score'
  },
  {
    id: 'evt-realmadrid-ucl',
    slug: 'real-madrid-wins-champions-league-2026-27',
    title: 'Real Madrid wins Champions League 2026/27?',
    description: 'Resolves YES if Real Madrid CF wins the 2026/27 UEFA Champions League final.',
    category: 'sports',
    tags: ['football', 'ucl', 'real-madrid'],
    startDate: '2026-09-01T00:00:00Z',
    endDate: '2027-05-31T23:59:59Z',
    status: 'open',
    outcomes: [{ id: 'yes', label: 'YES' }, { id: 'no', label: 'NO' }],
    resolutionSource: 'UEFA Official Tournament Results'
  },
  {
    id: 'evt-taylor-album',
    slug: 'taylor-swift-announces-new-album-before-jan-1',
    title: 'Will Taylor Swift announce a new album before Jan 1?',
    description: 'Resolves YES if Taylor Swift officially announces a new studio album before January 1, 2027 00:00 UTC.',
    category: 'culture',
    tags: ['taylor-swift', 'music', 'pop-culture'],
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    status: 'open',
    outcomes: [{ id: 'yes', label: 'YES' }, { id: 'no', label: 'NO' }],
    resolutionSource: 'Taylor Swift official social channels or website'
  },
  {
    id: 'evt-oscar-best-picture',
    slug: 'oscar-best-picture-winner-2027',
    title: 'Oscar Best Picture winner 2027',
    description: 'Multi-outcome market: Which film will win Best Picture at the 99th Academy Awards?',
    category: 'culture',
    tags: ['oscars', 'movies', 'hollywood'],
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2027-03-15T03:00:00Z',
    status: 'open',
    outcomes: [
      { id: 'film-dune3', label: 'Dune: Messiah' },
      { id: 'film-odyssey', label: 'The Odyssey' },
      { id: 'film-solaris', label: 'Solaris Return' },
      { id: 'film-other', label: 'Other / Any other film' }
    ],
    resolutionSource: 'Academy of Motion Picture Arts and Sciences'
  },
  {
    id: 'evt-f1-champion-2026',
    slug: 'f1-drivers-champion-2026',
    title: 'F1 Drivers\' Champion 2026',
    description: 'Multi-outcome market: Which driver will win the 2026 FIA Formula One World Drivers\' Championship?',
    category: 'sports',
    tags: ['f1', 'motorsport', 'grand-prix'],
    startDate: '2026-03-01T00:00:00Z',
    endDate: '2026-11-29T20:00:00Z',
    status: 'open',
    outcomes: [
      { id: 'max-verstappen', label: 'Max Verstappen' },
      { id: 'lando-norris', label: 'Lando Norris' },
      { id: 'charles-leclerc', label: 'Charles Leclerc' },
      { id: 'oscar-piastri', label: 'Oscar Piastri' },
      { id: 'lewis-hamilton', label: 'Lewis Hamilton' }
    ],
    resolutionSource: 'FIA Official Championship Standings'
  },
  {
    id: 'evt-eth-etf-inflows',
    slug: 'eth-etf-net-inflows-positive-this-week',
    title: 'ETH ETF net inflows positive this week?',
    description: 'Resolves YES if aggregate net inflows across all US spot Ethereum ETFs are greater than zero for the current calendar week.',
    category: 'crypto',
    tags: ['ethereum', 'etf', 'institutions'],
    startDate: '2026-10-26T00:00:00Z',
    endDate: '2026-10-30T22:00:00Z',
    status: 'open',
    outcomes: [{ id: 'yes', label: 'YES' }, { id: 'no', label: 'NO' }],
    resolutionSource: 'Farside Investors ETF Flow Data'
  },
  {
    id: 'evt-bank-indonesia-cut',
    slug: 'bank-indonesia-cuts-rates-december',
    title: 'Bank Indonesia cuts rates in December?',
    description: 'Resolves YES if Bank Indonesia (BI) lowers its 7-Day Reverse Repo Rate at the December Board of Governors meeting.',
    category: 'macro',
    tags: ['asia', 'central-banks', 'macro'],
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2026-12-18T10:00:00Z',
    status: 'open',
    outcomes: [{ id: 'yes', label: 'YES' }, { id: 'no', label: 'NO' }],
    resolutionSource: 'Bank Indonesia Official Statement'
  },
  {
    id: 'evt-super-bowl-lxi-chiefs',
    slug: 'super-bowl-lxi-winner-chiefs',
    title: 'Super Bowl LXI winner — Chiefs?',
    description: 'Resolves YES if the Kansas City Chiefs win Super Bowl LXI.',
    category: 'sports',
    tags: ['nfl', 'football', 'super-bowl'],
    startDate: '2026-09-01T00:00:00Z',
    endDate: '2027-02-14T23:59:59Z',
    status: 'open',
    outcomes: [{ id: 'yes', label: 'YES' }, { id: 'no', label: 'NO' }],
    resolutionSource: 'NFL.com Official Game Log'
  },
  {
    id: 'evt-polymarket-volume-5b',
    slug: 'polymarket-volume-exceeds-5b-november',
    title: 'Polymarket volume exceeds $5B in November?',
    description: 'Resolves YES if total monthly trading volume recorded across Polymarket exceeds $5,000,000,000 in November 2026.',
    category: 'politics',
    tags: ['polymarket', 'prediction-markets', 'volume'],
    startDate: '2026-11-01T00:00:00Z',
    endDate: '2026-11-30T23:59:59Z',
    status: 'open',
    outcomes: [{ id: 'yes', label: 'YES' }, { id: 'no', label: 'NO' }],
    resolutionSource: 'Dune Analytics @rchen8 / Polymarket official stats'
  },
  {
    id: 'evt-eu-ai-act-court-challenge',
    slug: 'eu-ai-act-upheld-by-top-court',
    title: 'EU AI Act upheld by European Court of Justice?',
    description: 'Resolves YES if the core provisions of the EU Artificial Intelligence Act are upheld against legal challenge.',
    category: 'politics',
    tags: ['ai', 'regulation', 'europe'],
    startDate: '2026-06-01T00:00:00Z',
    endDate: '2026-10-15T00:00:00Z',
    status: 'resolved',
    resolvedOutcomeId: 'yes',
    outcomes: [{ id: 'yes', label: 'YES' }, { id: 'no', label: 'NO' }],
    resolutionSource: 'Court of Justice of the European Union Judgment'
  }
]

// Mulberry32 deterministic PRNG
function createPRNG(seed) {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Generate Quotes
const rngQ = createPRNG(424299)
const baseProbMap = {
  'evt-btc-150k': 0.485,
  'evt-sui-5': 0.612,
  'evt-fed-dec-cut': 0.742,
  'evt-us-cpi-3pct': 0.365,
  'evt-lakers-celtics': 0.428,
  'evt-realmadrid-ucl': 0.285,
  'evt-taylor-album': 0.535,
  'evt-oscar-best-picture': 0.410,
  'evt-f1-champion-2026': 0.580,
  'evt-eth-etf-inflows': 0.665,
  'evt-bank-indonesia-cut': 0.315,
  'evt-super-bowl-lxi-chiefs': 0.245,
  'evt-polymarket-volume-5b': 0.690,
  'evt-eu-ai-act-court-challenge': 0.920
}

export const MOCK_QUOTES = []
for (const event of MOCK_EVENTS) {
  const baseProb = baseProbMap[event.id] ?? 0.5
  const venueCount = 3 + Math.floor(rngQ() * 4)
  const shuffledVenues = [...VENUES].sort(() => rngQ() - 0.5).slice(0, venueCount)
  const forceHighDivergence = ['evt-btc-150k', 'evt-sui-5', 'evt-fed-dec-cut', 'evt-lakers-celtics'].includes(event.id)

  shuffledVenues.forEach((venue, idx) => {
    let offset = (rngQ() - 0.5) * 0.04
    if (forceHighDivergence) {
      if (idx === 0) offset = -0.045 - rngQ() * 0.02
      if (idx === 1) offset = +0.040 + rngQ() * 0.02
    }

    let price = Math.max(0.02, Math.min(0.98, baseProb + offset))
    price = Math.round(price * 1000) / 1000
    const spread = 0.006 + rngQ() * 0.012
    const bestBid = Math.max(0.01, Math.round((price - spread / 2) * 1000) / 1000)
    const bestAsk = Math.min(0.99, Math.round((price + spread / 2) * 1000) / 1000)
    const change24h = Math.round(((rngQ() - 0.48) * 12) * 10) / 10
    const volume24h = Math.round(50000 + rngQ() * 850000)
    const totalVolume = Math.round(volume24h * (2.5 + rngQ() * 6))
    const openInterest = Math.round(volume24h * (0.8 + rngQ() * 1.8))
    const liquidity = Math.round(openInterest * (0.15 + rngQ() * 0.3))
    const traders = Math.round(250 + rngQ() * 4200)

    MOCK_QUOTES.push({
      eventId: event.id,
      venueId: venue.id,
      outcomeId: event.outcomes[0].id,
      bestBid,
      bestAsk,
      lastPrice: price,
      change24h,
      volume24h,
      totalVolume,
      openInterest,
      liquidity,
      traders,
      marketUrl: `${venue.url}/market/${event.slug}`,
      updatedAt: new Date(Date.now() - Math.floor(rngQ() * 120000)).toISOString()
    })
  })
}

// Order books generator
const rngOB = createPRNG(837192)
export const MOCK_ORDERBOOKS = {}
for (const event of MOCK_EVENTS) {
  for (const venue of VENUES) {
    const outcomeId = event.outcomes[0].id
    const mid = 0.2 + rngOB() * 0.6
    const spread = 0.004 + rngOB() * 0.015

    const bids = []
    let bidCum = 0
    for (let i = 0; i < 15; i++) {
      const price = Math.max(0.01, Math.round((mid - spread / 2 - i * 0.005) * 1000) / 1000)
      const size = Math.round(500 + rngOB() * 12500)
      bidCum += size
      bids.push({ price, size, total: bidCum })
    }

    const asks = []
    let askCum = 0
    for (let i = 0; i < 15; i++) {
      const price = Math.min(0.99, Math.round((mid + spread / 2 + i * 0.005) * 1000) / 1000)
      const size = Math.round(500 + rngOB() * 12500)
      askCum += size
      asks.push({ price, size, total: askCum })
    }

    const key = `${event.id}_${venue.id}_${outcomeId}`
    MOCK_ORDERBOOKS[key] = {
      eventId: event.id,
      venueId: venue.id,
      outcomeId,
      bids,
      asks,
      spread: Math.round(spread * 1000) / 1000,
      midPrice: Math.round(mid * 1000) / 1000
    }
  }
}

// History generator
const rngH = createPRNG(987654)
export const MOCK_HISTORY = {}
const histNow = new Date('2026-10-27T18:00:00Z').getTime()
const oneHour = 3600 * 1000
for (const event of MOCK_EVENTS) {
  const basePrice = 0.35 + rngH() * 0.35
  const points = []
  for (const venue of VENUES) {
    let currentPrice = basePrice + (rngH() - 0.5) * 0.05
    for (let h = 720; h >= 0; h--) {
      const time = new Date(histNow - h * oneHour).toISOString()
      const shock = (rngH() - 0.495) * 0.015
      currentPrice = Math.max(0.02, Math.min(0.98, currentPrice + shock))
      points.push({
        t: time,
        venueId: venue.id,
        price: Math.round(currentPrice * 1000) / 1000
      })
    }
  }
  MOCK_HISTORY[event.id] = points
}

// Wallets & Trades generator
const rngW = createPRNG(192837)
export const MOCK_WALLETS = []
const labels = ['AlphaPredator', 'MacroWhale', 'PolyKing', 'SuiSeer', 'VolatilityArb', 'FedWatcher', 'DeepBookQuant', 'ApexPredictor', 'SiliconOdds', 'ConsensusEdge']
for (let i = 0; i < 40; i++) {
  const isWhale = i < 8
  const hex = (i * 123456789 + 0xabc123).toString(16).padStart(40, '0')
  const address = `0x${hex.slice(0, 40)}`
  const chain = i % 4 === 0 ? 'Sui' : i % 3 === 0 ? 'Polygon' : i % 2 === 0 ? 'BNB Chain' : 'Base'
  const totalVolume = isWhale ? 1500000 + Math.round(rngW() * 4500000) : 45000 + Math.round(rngW() * 350000)
  const realizedPnl = Math.round((rngW() - 0.25) * (totalVolume * 0.25))
  const unrealizedPnl = Math.round((rngW() - 0.3) * 50000)
  const winRate = Math.round((0.48 + rngW() * 0.38) * 100) / 100
  const marketsTraded = Math.round(15 + rngW() * 120)
  const brierScore = Math.round((0.08 + rngW() * 0.16) * 1000) / 1000
  const credibilityScore = Math.min(99, Math.round(60 + (1 - brierScore * 4) * 25 + (winRate * 20)))

  const pnlHistory = []
  let accPnl = 0
  for (let d = 30; d >= 0; d--) {
    accPnl += Math.round((rngW() - 0.42) * (isWhale ? 15000 : 2500))
    pnlHistory.push({
      t: `2026-10-${String(Math.max(1, 28 - d)).padStart(2, '0')}`,
      pnl: accPnl
    })
  }

  MOCK_WALLETS.push({
    address,
    chain,
    label: i < labels.length ? labels[i] : undefined,
    isWhale,
    firstSeen: '2025-08-12T00:00:00Z',
    totalVolume,
    realizedPnl,
    unrealizedPnl,
    winRate,
    marketsTraded,
    credibilityScore,
    brierScore,
    categoryAccuracy: {
      sports: Math.round((0.5 + rngW() * 0.4) * 100) / 100,
      politics: Math.round((0.45 + rngW() * 0.4) * 100) / 100,
      crypto: Math.round((0.55 + rngW() * 0.35) * 100) / 100,
      culture: Math.round((0.4 + rngW() * 0.4) * 100) / 100,
      macro: Math.round((0.52 + rngW() * 0.38) * 100) / 100
    },
    venues: VENUES.slice(0, 2 + Math.floor(rngW() * 4)).map(v => v.id),
    pnlHistory
  })
}

// Trades
const rngT = createPRNG(556677)
export const MOCK_TRADES = []
const tradeNow = new Date('2026-10-27T18:30:00Z').getTime()
for (let i = 0; i < 200; i++) {
  const event = MOCK_EVENTS[Math.floor(rngT() * MOCK_EVENTS.length)]
  const venue = VENUES[Math.floor(rngT() * VENUES.length)]
  const wallet = MOCK_WALLETS[Math.floor(rngT() * MOCK_WALLETS.length)]
  const side = rngT() > 0.48 ? 'buy' : 'sell'
  const outcomeId = event.outcomes[0].id
  const price = Math.round((0.15 + rngT() * 0.7) * 1000) / 1000
  const notional = wallet.isWhale ? Math.round(15000 + rngT() * 85000) : Math.round(500 + rngT() * 8500)
  const size = Math.round(notional / price)
  const timeOffset = Math.floor(rngT() * 86400 * 2) * 1000

  MOCK_TRADES.push({
    id: `trd-${i + 1}`,
    eventId: event.id,
    venueId: venue.id,
    wallet: wallet.address,
    side,
    outcomeId,
    price,
    size,
    notional,
    txHash: `0x${((i + 1) * 987654321).toString(16).padEnd(64, 'a')}`,
    t: new Date(tradeNow - timeOffset).toISOString()
  })
}
MOCK_TRADES.sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime())

// In-Memory store
class ServerStore {
  constructor() {
    this.picks = [
      { id: 'pick-1', eventId: 'evt-btc-150k', outcomeId: 'yes', probability: 0.58, consensusAtPick: 0.48, stake: 500, reasoning: 'Binance orderbook imbalance', createdAt: '2026-10-26T12:00:00Z', result: 'pending' },
      { id: 'pick-2', eventId: 'evt-sui-5', outcomeId: 'yes', probability: 0.68, consensusAtPick: 0.61, stake: 750, reasoning: 'DeepBook liquidity surge', createdAt: '2026-10-25T10:00:00Z', result: 'pending' },
      { id: 'pick-3', eventId: 'evt-eu-ai-act-court-challenge', outcomeId: 'yes', probability: 0.85, consensusAtPick: 0.75, stake: 1000, reasoning: 'Legal precedent firmly established', createdAt: '2026-10-10T08:00:00Z', result: 'won', resolvedAt: '2026-10-15T02:00:00Z' },
      { id: 'pick-4', eventId: 'evt-us-cpi-3pct', outcomeId: 'no', probability: 0.72, consensusAtPick: 0.63, stake: 300, reasoning: 'Energy base effects declining', createdAt: '2026-10-22T14:00:00Z', result: 'lost', resolvedAt: '2026-10-24T18:00:00Z' }
    ]
    this.memories = [
      { id: 'mem-1', kind: 'insight', text: "You're 78% accurate on NBA picks, 41% on politics across 15 tracked predictions.", createdAt: '2026-10-24T12:00:00Z', blobId: 'walrus_blob_9x8e1a7b2c5d4f0a9e8b7c6d5e4f3a2b1c0d9e8f', status: 'stored' },
      { id: 'mem-2', kind: 'insight', text: 'Polymarket led WaterX price moves by ~40 min on 6 of last 8 crypto events.', createdAt: '2026-10-26T08:30:00Z', blobId: 'walrus_blob_4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c', status: 'stored' },
      { id: 'mem-3', kind: 'preference', text: 'You tend to overrate favorites above 70% probability by an average of +6.2pp.', createdAt: '2026-10-27T04:15:00Z', blobId: 'walrus_blob_7f6e5d4c3b2a1098fedcba9876543210abcdef01', status: 'stored' },
      { id: 'mem-4', kind: 'insight', text: 'DeepBook (Sui) and Opinion (BNB) currently show a 7.2pp divergence on SUI Q4 target.', createdAt: '2026-10-27T17:40:00Z', blobId: 'walrus_blob_11223344556677889900aabbccddeeff00112233', status: 'stored' },
      { id: 'mem-5', kind: 'credibility', text: 'Forecaster AlphaPredator achieved a Brier score of 0.082 on Macro rate cuts.', createdAt: '2026-10-25T14:20:00Z', blobId: 'walrus_blob_aaccbbddeeff1122334455667788990011223344', status: 'stored' }
    ]
    this.alerts = [
      { id: 'alt-1', kind: 'divergence', eventId: 'evt-btc-150k', message: 'High cross-venue spread alert: 8.4pp gap between WaterX and Polymarket on BTC $150k.', severity: 'high', createdAt: '2026-10-27T18:15:00Z', read: false },
      { id: 'alt-2', kind: 'whale', eventId: 'evt-btc-150k', message: 'Whale trade detected: $45,000 BUY YES on Polymarket by 0x6e2e...6260.', severity: 'high', createdAt: '2026-10-27T17:45:00Z', read: false },
      { id: 'alt-3', kind: 'divergence', eventId: 'evt-sui-5', message: 'Divergence alert: 7.2pp spread between DeepBook (58¢) and Predict.fun (65.2¢).', severity: 'warn', createdAt: '2026-10-27T16:30:00Z', read: false },
      { id: 'alt-4', kind: 'odds_move', eventId: 'evt-fed-dec-cut', message: 'Fast odds move: Fed cut odds jumped +5.4pp in last 1 hour across all venues.', severity: 'info', createdAt: '2026-10-27T15:20:00Z', read: true },
      { id: 'alt-5', kind: 'resolution', eventId: 'evt-eu-ai-act-court-challenge', message: 'Market resolved: EU AI Act upheld by European Court of Justice resolved YES.', severity: 'info', createdAt: '2026-10-15T02:00:00Z', read: true }
    ]
    this.rules = [
      { id: 'rule-1', kind: 'divergence', threshold: 5.0, enabled: true },
      { id: 'rule-2', kind: 'whale', threshold: 25000, enabled: true },
      { id: 'rule-3', kind: 'odds_move', threshold: 4.0, enabled: true },
      { id: 'rule-4', kind: 'resolution', threshold: 0, enabled: true },
      { id: 'rule-5', kind: 'divergence', threshold: 10.0, enabled: false }
    ]
    this.executions = []
    this.followedWallets = new Set(['0x6e2e411b01248512401824012840128401286260'])
    this.watchlistedEvents = new Set(['evt-btc-150k', 'evt-sui-5'])
  }
}

const serverStore = new ServerStore()

function calcConsensus(quotes) {
  if (!quotes || quotes.length === 0) return 0.5
  let totalVol = 0
  let weighted = 0
  for (const q of quotes) {
    const v = q.volume24h || 1
    totalVol += v
    weighted += q.lastPrice * v
  }
  return totalVol === 0 ? 0.5 : Math.round((weighted / totalVol) * 1000) / 1000
}

function calcDivergences(threshold = 5.0) {
  const items = []
  for (const event of MOCK_EVENTS) {
    const quotes = MOCK_QUOTES.filter(q => q.eventId === event.id)
    if (quotes.length < 2) continue
    let minQ = quotes[0]
    let maxQ = quotes[0]
    for (const q of quotes) {
      if (q.lastPrice < minQ.lastPrice) minQ = q
      if (q.lastPrice > maxQ.lastPrice) maxQ = q
    }
    const spreadPp = Math.round((maxQ.lastPrice - minQ.lastPrice) * 100 * 10) / 10
    if (spreadPp >= threshold) {
      const arbEdge = Math.round((spreadPp * 0.85) * 10) / 10
      items.push({
        event,
        consensus: calcConsensus(quotes),
        minQuote: minQ,
        maxQuote: maxQ,
        spreadPp,
        arbitrageEdge: arbEdge
      })
    }
  }
  return items.sort((a, b) => b.spreadPp - a.spreadPp)
}

// 1. Markets
router.get('/markets', (_req, res) => {
  const watchlist = Array.from(serverStore.watchlistedEvents)
  const enriched = MOCK_EVENTS.map(event => {
    const quotes = MOCK_QUOTES.filter(q => q.eventId === event.id)
    const consensus = calcConsensus(quotes)
    let minPrice = 1
    let maxPrice = 0
    quotes.forEach(q => {
      if (q.lastPrice < minPrice) minPrice = q.lastPrice
      if (q.lastPrice > maxPrice) maxPrice = q.lastPrice
    })
    const spread = quotes.length > 1 ? Math.round((maxPrice - minPrice) * 100 * 10) / 10 : 0
    const totalVolume = quotes.reduce((acc, q) => acc + q.totalVolume, 0)
    const totalOI = quotes.reduce((acc, q) => acc + q.openInterest, 0)

    return {
      ...event,
      consensus,
      quotes,
      spread,
      totalVolume,
      totalOI,
      isWatchlisted: watchlist.includes(event.id)
    }
  })
  res.json(enriched)
})

router.get('/markets/:id', (req, res) => {
  const { id } = req.params
  const event = MOCK_EVENTS.find(e => e.id === id || e.slug === id)
  if (!event) return res.status(404).json({ error: 'Market not found' })

  const quotes = MOCK_QUOTES.filter(q => q.eventId === event.id)
  const consensus = calcConsensus(quotes)
  const isWatchlisted = serverStore.watchlistedEvents.has(event.id)

  res.json({
    event,
    quotes,
    consensus,
    isWatchlisted
  })
})

router.post('/markets/:id/watchlist', (req, res) => {
  const { id } = req.params
  let watchlisted = false
  if (serverStore.watchlistedEvents.has(id)) {
    serverStore.watchlistedEvents.delete(id)
  } else {
    serverStore.watchlistedEvents.add(id)
    watchlisted = true
    serverStore.memories.unshift({
      id: `mem-${Date.now()}`,
      kind: 'preference',
      text: `User watchlisted event ${id} for real-time arbitrage tracking.`,
      eventId: id,
      createdAt: new Date().toISOString(),
      status: 'stored',
      blobId: `walrus_blob_${Date.now().toString(16)}`
    })
  }
  res.json({ eventId: id, watchlisted })
})

router.get('/markets/:id/orderbook', (req, res) => {
  const { id } = req.params
  const venueId = req.query.venueId || 'polymarket'
  const outcomeId = req.query.outcomeId || 'yes'
  const key = `${id}_${venueId}_${outcomeId}`
  const ob = MOCK_ORDERBOOKS[key] || MOCK_ORDERBOOKS[`evt-btc-150k_${venueId}_yes`]
  res.json(ob)
})

router.get('/markets/:id/history', (req, res) => {
  const { id } = req.params
  const history = MOCK_HISTORY[id] || MOCK_HISTORY['evt-btc-150k'] || []
  res.json(history)
})

router.get('/markets/:id/trades', (req, res) => {
  const { id } = req.params
  const trades = MOCK_TRADES.filter(t => t.eventId === id)
  res.json(trades.slice(0, 50))
})

router.get('/markets/:id/holders', (req, res) => {
  const holders = MOCK_WALLETS.slice(0, 10).map((w, idx) => ({
    wallet: w.address,
    label: w.label,
    outcome: idx % 3 === 0 ? 'NO' : 'YES',
    shares: Math.round(5000 + (10 - idx) * 3500),
    avgPrice: Math.round((0.35 + (idx * 0.03)) * 1000) / 1000,
    pnl: Math.round((idx % 2 === 0 ? 1 : -1) * (1500 + idx * 800)),
    credibilityScore: w.credibilityScore
  }))
  res.json(holders)
})

// 2. Divergence & Stats
router.get('/divergence', (req, res) => {
  const threshold = parseFloat(req.query.threshold || '5.0')
  const divergences = calcDivergences(threshold)
  res.json(divergences)
})

router.get('/movers', (_req, res) => {
  const movers = [...MOCK_QUOTES]
    .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
    .slice(0, 10)
  const enriched = movers.map(q => ({
    quote: q,
    event: MOCK_EVENTS.find(e => e.id === q.eventId)
  }))
  res.json(enriched)
})

router.get('/whales', (_req, res) => {
  const whaleTrades = MOCK_TRADES.filter(t => t.notional >= 15000).slice(0, 25)
  res.json(whaleTrades)
})

router.get('/stats', (_req, res) => {
  const totalVolume = MOCK_QUOTES.reduce((acc, q) => acc + q.volume24h, 0)
  const totalOI = MOCK_QUOTES.reduce((acc, q) => acc + q.openInterest, 0)
  const divergences = calcDivergences(5.0)
  const whaleTrades = MOCK_TRADES.filter(t => t.notional >= 15000)

  res.json({
    totalVolume24h: totalVolume,
    totalOpenInterest: totalOI,
    activeMarketsCount: MOCK_EVENTS.length,
    liveDivergencesCount: divergences.length,
    whaleTradesCount: whaleTrades.length,
    storedMemoriesCount: serverStore.memories.filter(m => m.status === 'stored').length,
    venuesCount: VENUES.length
  })
})

// 3. Wallets & Leaderboard
router.get('/wallets', (_req, res) => {
  const followed = Array.from(serverStore.followedWallets)
  const enriched = MOCK_WALLETS.map(w => ({
    ...w,
    isFollowed: followed.includes(w.address.toLowerCase())
  }))
  res.json(enriched)
})

router.get('/wallets/:address', (req, res) => {
  const { address } = req.params
  const wallet = MOCK_WALLETS.find(w => w.address.toLowerCase() === address.toLowerCase())
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' })

  const isFollowed = serverStore.followedWallets.has(address.toLowerCase())
  const trades = MOCK_TRADES.filter(t => t.wallet.toLowerCase() === address.toLowerCase()).slice(0, 20)

  res.json({
    wallet,
    isFollowed,
    trades
  })
})

router.post('/wallets/:address/follow', (req, res) => {
  const { address } = req.params
  const key = address.toLowerCase()
  let followed = false
  if (serverStore.followedWallets.has(key)) {
    serverStore.followedWallets.delete(key)
  } else {
    serverStore.followedWallets.add(key)
    followed = true
    serverStore.memories.unshift({
      id: `mem-${Date.now()}`,
      kind: 'watchlist',
      text: `Followed wallet ${address.slice(0, 6)}...${address.slice(-4)} added to radar.`,
      wallet: address,
      createdAt: new Date().toISOString(),
      status: 'stored',
      blobId: `walrus_blob_${Date.now().toString(16)}`
    })
  }
  res.json({ address, followed })
})

router.get('/leaderboard', (req, res) => {
  const category = req.query.category || 'all'
  const followed = Array.from(serverStore.followedWallets)

  let sorted = [...MOCK_WALLETS].sort((a, b) => b.credibilityScore - a.credibilityScore)
  if (category !== 'all' && ['sports', 'politics', 'crypto', 'culture', 'macro'].includes(category)) {
    sorted = [...MOCK_WALLETS].sort((a, b) => {
      const accA = a.categoryAccuracy[category] || 0
      const accB = b.categoryAccuracy[category] || 0
      return accB - accA
    })
  }

  const enriched = sorted.map((w, index) => ({
    rank: index + 1,
    ...w,
    isFollowed: followed.includes(w.address.toLowerCase())
  }))

  res.json(enriched)
})

// 4. Picks
router.get('/picks', (_req, res) => {
  res.json(serverStore.picks)
})

router.post('/picks', (req, res) => {
  const { eventId, outcomeId, probability, consensusAtPick, stake, reasoning } = req.body
  if (!eventId || !outcomeId || probability === undefined) {
    return res.status(400).json({ error: 'Missing required pick fields' })
  }

  const newPick = {
    id: `pick-${Date.now()}`,
    eventId,
    outcomeId,
    probability: parseFloat(probability),
    consensusAtPick: parseFloat(consensusAtPick || probability),
    stake: stake ? parseFloat(stake) : undefined,
    reasoning: reasoning || 'Algorithmic model consensus divergence',
    createdAt: new Date().toISOString(),
    result: 'pending'
  }
  serverStore.picks.unshift(newPick)

  // Auto Walrus Memory
  const memEntry = {
    id: `mem-${Date.now()}`,
    kind: 'pick',
    text: `Logged ${outcomeId.toUpperCase()} pick at ${(parseFloat(probability) * 100).toFixed(1)}% (consensus was ${(parseFloat(consensusAtPick || probability) * 100).toFixed(1)}%). Reasoning: ${reasoning || 'Model edge'}`,
    eventId,
    createdAt: new Date().toISOString(),
    status: 'queued'
  }
  serverStore.memories.unshift(memEntry)
  setTimeout(() => {
    memEntry.status = 'stored'
    memEntry.blobId = `walrus_blob_${Date.now().toString(16)}`
  }, 4000)

  res.json(newPick)
})

// 5. Memory (Walrus)
router.get('/memory', (req, res) => {
  const q = req.query.q
  if (q && q.trim()) {
    const kw = q.toLowerCase()
    const filtered = serverStore.memories.filter(m =>
      m.text.toLowerCase().includes(kw) || m.kind.toLowerCase().includes(kw)
    )
    return res.json(filtered)
  }
  res.json(serverStore.memories)
})

// 6. Alerts & Rules
router.get('/alerts', (_req, res) => {
  res.json(serverStore.alerts)
})

router.post('/alerts/:id/read', (req, res) => {
  const { id } = req.params
  const a = serverStore.alerts.find(item => item.id === id)
  if (a) a.read = true
  res.json({ success: true, id })
})

router.post('/alerts/read-all', (_req, res) => {
  serverStore.alerts.forEach(a => (a.read = true))
  res.json({ success: true })
})

router.get('/alerts/rules', (_req, res) => {
  res.json(serverStore.rules)
})

router.post('/alerts/rules', (req, res) => {
  const { kind, threshold, enabled, category } = req.body
  const rule = {
    id: `rule-${Date.now()}`,
    kind,
    threshold: parseFloat(threshold),
    enabled: enabled ?? true,
    category
  }
  serverStore.rules.push(rule)
  res.json(rule)
})

router.patch('/alerts/rules/:id', (req, res) => {
  const { id } = req.params
  const rule = serverStore.rules.find(r => r.id === id)
  if (!rule) return res.status(404).json({ error: 'Rule not found' })
  Object.assign(rule, req.body)
  res.json(rule)
})

// 7. Venue Status
router.get('/venues/status', (_req, res) => {
  res.json(VENUES)
})

// 8. Execution (Sui Agent)
router.post('/execute', (req, res) => {
  const { eventId, venueId, outcomeId, side, amount } = req.body
  const amt = parseFloat(amount) || 100
  const isWaterX = venueId === 'waterx'
  const price = isWaterX ? 0.615 : 0.608
  const feeRate = isWaterX ? 0.003 : 0.0015
  const fee = Math.round(amt * feeRate * 100) / 100
  const shares = Math.round((amt - fee) / price)

  const execution = {
    id: `exec-${Date.now()}`,
    venueId,
    chain: 'sui',
    eventId,
    outcomeId,
    side,
    amount: amt,
    price,
    shares,
    fee,
    status: 'pending',
    txDigest: '',
    createdAt: new Date().toISOString()
  }

  serverStore.executions.unshift(execution)

  // Flip to confirmed after 3 seconds
  setTimeout(() => {
    execution.status = 'confirmed'
    execution.txDigest = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
  }, 3000)

  res.json(execution)
})

router.get('/execute/:id', (req, res) => {
  const { id } = req.params
  const exec = serverStore.executions.find(e => e.id === id)
  if (!exec) return res.status(404).json({ error: 'Execution not found' })
  res.json(exec)
})

export default router
