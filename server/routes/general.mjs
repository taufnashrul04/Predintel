import { Router } from 'express'
import { serverStore } from '../lib/store.mjs'
import { MOCK_EVENTS } from '../lib/mock/events.mjs'
import { MOCK_QUOTES } from '../lib/mock/quotes.mjs'
import { MOCK_TRADES, MOCK_WALLETS } from '../lib/mock/wallets.mjs'
import { VENUES } from '../lib/venues.mjs'
import { detectDivergences, topMovers, consensusProbability } from '../lib/services/analytics.mjs'
import { validateSuiExecution } from '../lib/services/payments.mjs'

const router = Router()

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
router.get('/whales', (_req, res) => {
  const whaleTrades = MOCK_TRADES.filter(t => t.notional >= 15000).slice(0, 30)
  res.json(whaleTrades)
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

// Venues Status
router.get('/venues/status', (_req, res) => {
  res.json(VENUES)
})

// Agent Execution (Bug fix g - Sui only validation)
router.post('/execute', (req, res) => {
  const { eventId, venueId, outcomeId = 'yes', side = 'buy', amount = 100 } = req.body
  if (!eventId || !venueId) {
    return res.status(400).json({ error: 'Missing eventId or venueId' })
  }

  try {
    const venue = validateSuiExecution(venueId)
    const amt = parseFloat(amount) || 100
    const price = venueId === 'waterx' ? 0.615 : 0.608
    const feeRate = venueId === 'waterx' ? 0.003 : 0.0015
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

    // Add to user trade history and deduct from agent wallet
    serverStore.agentWallet.spentToday += amt

    setTimeout(() => {
      execution.status = 'confirmed'
      execution.txDigest = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`

      serverStore.userTradesHistory.unshift({
        id: `uth-${Date.now()}`,
        marketTitle: eventId,
        outcomeId,
        side,
        mode: 'Agent (x402 · Sui)',
        venueId,
        shares,
        price,
        amount: amt,
        fee,
        status: 'confirmed',
        txDigest: execution.txDigest,
        t: new Date().toISOString()
      })

      // Add position
      serverStore.userPositions.unshift({
        id: `pos-${Date.now()}`,
        marketSlug: eventId,
        marketTitle: eventId,
        outcomeId,
        outcomeLabel: outcomeId.toUpperCase(),
        venueId,
        shares,
        avgPrice: price,
        currentPrice: price,
        pnl: 0,
        returnPct: 0
      })
    }, 2800)

    res.json(execution)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.get('/execute/:id', (req, res) => {
  const { id } = req.params
  const exec = serverStore.executions.find(e => e.id === id)
  if (!exec) return res.status(404).json({ error: 'Execution not found' })
  res.json(exec)
})

export default router
