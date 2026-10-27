import { Router } from 'express'
import { serverStore } from '../lib/store.mjs'
import { MOCK_EVENTS } from '../lib/mock/events.mjs'
import { computeTradeQuote } from '../lib/services/trading.mjs'
import { validateSuiExecution } from '../lib/services/payments.mjs'

const router = Router()

// Routing Quote
router.get('/quote', (req, res) => {
  try {
    const { market, outcome = 'yes', side = 'buy', amount = 100, type = 'market', limitPrice, split } = req.query
    const event = MOCK_EVENTS.find(e => e.id === market || e.slug === market)
    if (!event) return res.status(404).json({ error: 'Market not found' })

    const quote = computeTradeQuote({
      eventId: event.id,
      outcomeId: outcome,
      side,
      amount: parseFloat(amount) || 100,
      type,
      limitPrice,
      split: split === 'true'
    })
    res.json(quote)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Direct Mode - Build Unsigned Transaction (Mock Sui Move call)
router.post('/build', (req, res) => {
  const { marketId, venueId, outcomeId, side, amount, userAddress } = req.body
  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than 0.' })
  }

  try {
    validateSuiExecution(venueId)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  // TODO: build real Move call for WaterX / DeepBook
  const txBytes = `0x000102030405060708090a0b0c0d0e0f${Date.now().toString(16)}`
  res.json({
    txBytes,
    gasEstimate: 0.0018,
    marketId,
    venueId,
    side,
    amount: parseFloat(amount)
  })
})

// Direct Mode - Submit Signed Transaction
router.post('/submit', (req, res) => {
  const { marketTitle, outcomeId, venueId, side, amount, price, shares, signature, txBytes } = req.body

  const txDigest = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
  const newTrade = {
    id: `uth-${Date.now()}`,
    marketTitle: marketTitle || 'Prediction Market Trade',
    outcomeId: outcomeId || 'yes',
    side: side || 'buy',
    mode: 'Direct',
    venueId: venueId || 'waterx',
    shares: parseInt(shares) || 100,
    price: parseFloat(price) || 0.5,
    amount: parseFloat(amount) || 50,
    fee: Math.round((parseFloat(amount) || 50) * 0.0015 * 100) / 100,
    status: 'confirmed',
    txDigest,
    t: new Date().toISOString()
  }

  serverStore.userTradesHistory.unshift(newTrade)

  // Add position
  serverStore.userPositions.unshift({
    id: `pos-${Date.now()}`,
    marketSlug: 'direct-trade',
    marketTitle: newTrade.marketTitle,
    outcomeId: newTrade.outcomeId,
    outcomeLabel: newTrade.outcomeId.toUpperCase(),
    venueId: newTrade.venueId,
    shares: newTrade.shares,
    avgPrice: newTrade.price,
    currentPrice: newTrade.price,
    pnl: 0,
    returnPct: 0
  })

  // Walrus memory hook
  serverStore.memories.unshift({
    id: `mem-${Date.now()}`,
    kind: 'insight',
    text: `Direct trade executed on ${venueId}: ${side.toUpperCase()} ${shares} shares of ${newTrade.marketTitle} @ ${(price * 100).toFixed(1)}¢.`,
    createdAt: new Date().toISOString(),
    status: 'stored',
    blobId: `walrus_blob_${Date.now().toString(16)}`
  })

  res.json({ success: true, trade: newTrade, txDigest })
})

// Open orders
router.get('/orders', (_req, res) => {
  res.json(serverStore.openOrders)
})

router.delete('/orders/:id', (req, res) => {
  const { id } = req.params
  const index = serverStore.openOrders.findIndex(o => o.id === id)
  if (index === -1) return res.status(404).json({ error: 'Order not found' })
  const removed = serverStore.openOrders.splice(index, 1)[0]
  res.json({ success: true, removed })
})

// Positions
router.get('/positions', (_req, res) => {
  res.json(serverStore.userPositions)
})

// User trade history
router.get('/history', (_req, res) => {
  res.json(serverStore.userTradesHistory)
})

export default router
