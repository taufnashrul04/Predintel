import { Router } from 'express'
import { serverStore } from '../lib/store.mjs'
import { MOCK_EVENTS } from '../lib/mock/events.mjs'
import { MOCK_QUOTES } from '../lib/mock/quotes.mjs'
import { MOCK_TRADES, MOCK_WALLETS } from '../lib/mock/wallets.mjs'
import { VENUES } from '../lib/venues.mjs'
import { detectDivergences, topMovers, consensusProbability, detectCrowdedTrades } from '../lib/services/analytics.mjs'
import { TradeError, executeAgentOrder } from '../lib/services/trading.mjs'
import { LiveDataError, getLivePrices } from '../lib/services/suiLive.mjs'
import { loadLiveMarket } from './trade.mjs'
import { getPredictFlow } from '../lib/services/predictFlow.mjs'
import { WHALE_MIN_USD, getWhaleTape } from '../lib/services/whaleFeed.mjs'
import { getLiveDivergence } from '../lib/services/liveDivergence.mjs'
import { getPolymarketSignals, getPolymarketTraders } from '../lib/services/copyTraders.mjs'
import { getPolymarketBoard } from '../lib/services/polymarketMarkets.mjs'

const router = Router()

// Live divergence: WaterX vs the same market on Polymarket.
router.get('/divergence/live', async (req, res) => {
  const minGapPp = Math.max(0, Math.min(50, Number(req.query.min) || 0.5))
  try {
    res.json(await getLiveDivergence({ minGapPp }))
  } catch (err) {
    if (err instanceof LiveDataError) return res.status(err.status).json({ error: err.message })
    console.error('[divergence/live]', err)
    res.status(500).json({ error: 'Unexpected error loading live divergence.' })
  }
})

// Divergence
router.get('/divergence', (req, res) => {
  const threshold = parseFloat(req.query.threshold || '5.0')
  const list = detectDivergences(MOCK_EVENTS, MOCK_QUOTES, threshold)
  res.json(list)
})

// Movers (Top Movers 24h)
router.get('/movers', (_req, res) => {
  const movers = topMovers(MOCK_QUOTES, 10)
  const enriched = movers.map(q => ({
    quote: q,
    event: MOCK_EVENTS.find(e => e.id === q.eventId)
  }))
  res.json(enriched)
})

// Whale Trades
router.get('/whales', async (req, res) => {
  const minUsd = Math.max(1000, Math.min(1_000_000, Number(req.query.min) || WHALE_MIN_USD))
  try {
    res.json(await getWhaleTape({ minUsd }))
  } catch (err) {
    if (err instanceof LiveDataError) return res.status(err.status).json({ error: err.message })
    console.error('[whales]', err)
    res.status(500).json({ error: 'Unexpected error loading the whale tape.' })
  }
})

// Crowded trades: many tracked wallets on the same side of the same outcome.
router.get('/crowded', (req, res) => {
  const minWallets = Math.max(2, Math.min(10, parseInt(req.query.min, 10) || 3))
  res.json(
    detectCrowdedTrades(MOCK_TRADES, MOCK_WALLETS, MOCK_EVENTS, {
      minWallets,
      followed: serverStore.followedWallets
    })
  )
})

// Real order flow and traders on DeepBook Predict (Sui mainnet).
router.get('/predict-flow', async (_req, res) => {
  try {
    res.json(await getPredictFlow())
  } catch (err) {
    if (err instanceof LiveDataError) return res.status(err.status).json({ error: err.message })
    console.error('[predict-flow]', err)
    res.status(500).json({ error: 'Unexpected error loading DeepBook Predict flow.' })
  }
})

// Polymarket markets (read-only), each with its WaterX mirror and the price gap.
router.get('/polymarket/markets', async (req, res) => {
  try {
    res.json(
      await getPolymarketBoard({
        q: String(req.query.q ?? '').slice(0, 100),
        category: String(req.query.category ?? 'all'),
        limit: Number(req.query.limit) || 300
      })
    )
  } catch (err) {
    if (err instanceof LiveDataError) return res.status(err.status).json({ error: err.message })
    console.error('[polymarket/markets]', err)
    res.status(500).json({ error: 'Unexpected error loading Polymarket markets.' })
  }
})

// Polymarket traders worth copying, and recent buys by the wallets a journal copies (mirrored on WaterX).
router.get('/copy/polymarket/traders', async (_req, res) => {
  try {
    res.json(await getPolymarketTraders())
  } catch (err) {
    if (err instanceof LiveDataError) return res.status(err.status).json({ error: err.message })
    console.error('[copy/traders]', err)
    res.status(500).json({ error: 'Unexpected error loading Polymarket traders.' })
  }
})

router.get('/copy/polymarket/signals', async (req, res) => {
  const wallets = String(req.query.wallets ?? '').split(',').filter(Boolean)
  try {
    res.json(await getPolymarketSignals(wallets))
  } catch (err) {
    if (err instanceof LiveDataError) return res.status(err.status).json({ error: err.message })
    console.error('[copy/signals]', err)
    res.status(500).json({ error: 'Unexpected error loading copy signals.' })
  }
})

// Platform Stats
router.get('/stats', (_req, res) => {
  const totalVolume = MOCK_QUOTES.reduce((acc, q) => acc + q.volume24h, 0)
  const totalOI = MOCK_QUOTES.reduce((acc, q) => acc + q.openInterest, 0)
  const divergences = detectDivergences(MOCK_EVENTS, MOCK_QUOTES, 5.0)
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

// Leaderboard with Culture and time ranges (Bug fix 2)
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

// Picks
router.get('/picks', (_req, res) => {
  res.json(serverStore.picks)
})

// POST picks: bug fix f (stores market consensus at that moment)
router.post('/picks', (req, res) => {
  const { eventId, outcomeId = 'yes', probability, stake, reasoning } = req.body
  if (!eventId || probability === undefined) {
    return res.status(400).json({ error: 'Missing required pick fields' })
  }

  // Look up real consensus at pick from quotes (Bug fix f)
  const quotes = MOCK_QUOTES.filter(q => q.eventId === eventId && q.outcomeId === outcomeId)
  const realConsensus = quotes.length > 0 ? consensusProbability(quotes) : 0.5

  const newPick = {
    id: `pick-${Date.now()}`,
    eventId,
    outcomeId,
    probability: parseFloat(probability),
    consensusAtPick: realConsensus,
    stake: stake ? parseFloat(stake) : 100,
    reasoning: reasoning || 'Algorithmic model consensus divergence',
    createdAt: new Date().toISOString(),
    result: 'pending'
  }
  serverStore.picks.unshift(newPick)

  // Auto Walrus Memory
  const memEntry = {
    id: `mem-${Date.now()}`,
    kind: 'pick',
    text: `Logged ${outcomeId.toUpperCase()} pick at ${(parseFloat(probability) * 100).toFixed(1)}% (consensus was ${(realConsensus * 100).toFixed(1)}%). Reasoning: ${reasoning || 'Model edge'}`,
    eventId,
    createdAt: new Date().toISOString(),
    status: 'queued'
  }
  serverStore.memories.unshift(memEntry)
  setTimeout(() => {
    memEntry.status = 'stored'
    memEntry.blobId = `walrus_blob_${Date.now().toString(16)}`
  }, 4500)

  res.json(newPick)
})

// Live spot prices from DeepBook (SUI, BTC, WAL, DEEP in USDC).
router.get('/live/prices', async (_req, res) => {
  try {
    res.json(await getLivePrices())
  } catch (err) {
    if (err instanceof LiveDataError) return res.status(err.status).json({ error: err.message })
    res.status(500).json({ error: 'Unexpected error loading live prices.' })
  }
})

// Venues Status
router.get('/venues/status', (_req, res) => {
  res.json(VENUES)
})

// Agent mode: the server prices the order from the books and enforces the agent's risk rules.
router.post('/execute', async (req, res) => {
  try {
    await loadLiveMarket(req.body)
    const { execution } = executeAgentOrder(req.body ?? {})
    res.json(execution)
  } catch (err) {
    if (err instanceof TradeError || err instanceof LiveDataError) return res.status(err.status).json({ error: err.message })
    console.error('[execute]', err)
    res.status(500).json({ error: 'Unexpected execution error.' })
  }
})

router.get('/execute/:id', (req, res) => {
  const { id } = req.params
  const exec = serverStore.executions.find(e => e.id === id)
  if (!exec) return res.status(404).json({ error: 'Execution not found' })
  res.json(exec)
})

export default router
