import { Router } from 'express'
import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils'
import { verifyPersonalMessageSignature } from '@mysten/sui/verify'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import { serverStore } from '../lib/store.mjs'
import {
  TradeError,
  agentState,
  closeAgentPosition,
  computeTradeQuote,
  createDirectIntent,
  listPositions,
  registerLiveEvent,
  settleDirectIntent,
  suiListingVenues
} from '../lib/services/trading.mjs'
import { LiveDataError } from '../lib/services/suiLive.mjs'
import { getLiveMarket, isLiveMarketId, listDeepbookMarkets, listWaterxEvents, listWaterxFeedMarkets } from '../lib/services/livePredict.mjs'
import { MOCK_EVENTS } from '../lib/mock/events.mjs'
import { MOCK_QUOTES } from '../lib/mock/quotes.mjs'

const router = Router()

let suiClient
// zkLogin signatures (e.g. Slush) need a client to resolve the signer during verification.
const getSuiClient = () =>
  (suiClient ??= new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' }))

// Live markets are priced from a fresh venue read before every quote, intent or agent order.
export async function loadLiveMarket(input) {
  const id = input?.market ?? input?.eventId
  if (!isLiveMarketId(id)) return null
  const market = await getLiveMarket(id)
  registerLiveEvent(market)
  return market
}

function sendError(res, err) {
  if (err instanceof TradeError || err instanceof LiveDataError) return res.status(err.status).json({ error: err.message })
  console.error('[trade]', err)
  return res.status(500).json({ error: 'Unexpected trade error.' })
}

// Markets tradable in-app: only those listed on WaterX or DeepBook.
const UNDERLYING = { 'evt-sui-5': 'SUI', 'evt-btc-150k': 'BTC' }

router.get('/markets', (_req, res) => {
  const markets = MOCK_EVENTS.flatMap(event => {
    const venues = suiListingVenues(event.id, event.outcomes[0].id)
    if (venues.length === 0) return []
    const quotes = MOCK_QUOTES.filter(q => q.eventId === event.id && venues.some(v => v.id === q.venueId))
    const outcomePrices = Object.fromEntries(
      event.outcomes.map(o => {
        const qs = quotes.filter(q => q.outcomeId === o.id)
        const vol = qs.reduce((s, q) => s + q.volume24h, 0)
        return [o.id, vol > 0 ? Math.round((qs.reduce((s, q) => s + q.lastPrice * q.volume24h, 0) / vol) * 1000) / 1000 : null]
      })
    )
    return [{
      id: event.id,
      slug: event.slug,
      title: event.title,
      category: event.category,
      outcomes: event.outcomes.map(o => ({ id: o.id, label: o.label })),
      venues: venues.map(v => ({ id: v.id, name: v.name })),
      outcomePrices,
      underlying: UNDERLYING[event.id] ?? null
    }]
  })
  res.json(markets)
})

router.get('/live-markets', async (_req, res) => {
  const [waterx, feed, deepbook] = await Promise.allSettled([listWaterxEvents(), listWaterxFeedMarkets(), listDeepbookMarkets()])
  const rounds = feed.status === 'fulfilled' ? feed.value : []
  res.json({
    waterx: waterx.status === 'fulfilled' ? waterx.value : [],
    // Feed markets carry full outcomes; `preview` keeps them in the same shape as events for boards.
    waterxMatches: rounds.filter(m => m.kind === 'sport-match').map(m => ({ ...m, preview: m.outcomes.map(o => ({ id: o.id, label: o.label, price: o.ask })) })),
    waterxUpdown: rounds.filter(m => m.kind === 'crypto-updown').map(m => ({ ...m, preview: m.outcomes.map(o => ({ id: o.id, label: o.label, price: o.ask })) })),
    deepbook: deepbook.status === 'fulfilled' ? deepbook.value : [],
    errors: {
      waterx: waterx.status === 'rejected' ? waterx.reason.message : feed.status === 'rejected' ? feed.reason.message : null,
      deepbook: deepbook.status === 'rejected' ? deepbook.reason.message : null
    }
  })
})

router.get('/live-markets/:id', async (req, res) => {
  try {
    const market = await loadLiveMarket({ market: req.params.id })
    if (!market) return res.status(404).json({ error: 'Not a live market id.' })
    res.json(market)
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/quote', async (req, res) => {
  try {
    await loadLiveMarket(req.query)
    res.json(computeTradeQuote(req.query))
  } catch (err) {
    sendError(res, err)
  }
})

// Direct mode step 1: the server prices the order and returns an intent for the user's wallet to sign.
// TODO: return real Move-call tx bytes for WaterX / DeepBook instead of a signed intent.
router.post('/build', async (req, res) => {
  try {
    const { address, ...order } = req.body ?? {}
    await loadLiveMarket(order)
    if (typeof address !== 'string' || !isValidSuiAddress(normalizeSuiAddress(address))) {
      throw new TradeError('Connect a Sui wallet to trade in Direct mode.')
    }
    const intent = createDirectIntent(order, normalizeSuiAddress(address))
    res.json({ intentId: intent.id, message: intent.message, expiresAt: intent.expiresAt, quote: intent.quote })
  } catch (err) {
    sendError(res, err)
  }
})

// Direct mode step 2: verify the wallet signature over the exact intent, then settle.
router.post('/submit', async (req, res) => {
  try {
    const { intentId, signature } = req.body ?? {}
    const intent = serverStore.directIntents.get(intentId)
    if (!intent) throw new TradeError('Order intent not found. Rebuild the order.', 404)
    if (intent.used) throw new TradeError('This order intent was already submitted.', 409)
    if (Date.parse(intent.expiresAt) < Date.now()) throw new TradeError('Order intent expired. Review the order and sign again.', 410)
    if (typeof signature !== 'string' || !signature) throw new TradeError('Missing wallet signature.')

    try {
      await verifyPersonalMessageSignature(new TextEncoder().encode(intent.message), signature, {
        address: intent.address,
        client: getSuiClient()
      })
    } catch {
      throw new TradeError('Wallet signature does not match this order.', 401)
    }

    const result = settleDirectIntent(intent)
    serverStore.directIntents.delete(intentId)
    res.json({ success: true, simulated: true, ref: result.ref, trades: result.trades, realizedPnl: result.realizedPnl })
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/orders', (_req, res) => {
  res.json(serverStore.openOrders)
})

router.delete('/orders/:id', (req, res) => {
  const index = serverStore.openOrders.findIndex(o => o.id === req.params.id)
  if (index === -1) return res.status(404).json({ error: 'Order not found' })
  const [removed] = serverStore.openOrders.splice(index, 1)
  if (removed.mode?.startsWith('Agent') && removed.side === 'buy') {
    const wallet = agentState()
    wallet.balanceUSDC = Math.round((wallet.balanceUSDC + removed.amount) * 100) / 100
  }
  res.json({ success: true, removed })
})

router.post('/positions/:id/close', async (req, res) => {
  try {
    const position = serverStore.userPositions.find(p => p.id === req.params.id)
    if (position) await loadLiveMarket({ market: position.eventId })
    res.json(closeAgentPosition(req.params.id))
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/positions', (_req, res) => {
  res.json(listPositions())
})

router.get('/history', (_req, res) => {
  res.json(serverStore.userTradesHistory)
})

export default router
