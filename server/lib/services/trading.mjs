import { MOCK_QUOTES } from '../mock/quotes.mjs'
import { MOCK_ORDERBOOKS } from '../mock/orderbooks.mjs'
import { VENUE_MAP } from '../venues.mjs'

export function computeTradeQuote({
  eventId,
  outcomeId = 'yes',
  side = 'buy',
  amount = 100,
  type = 'market',
  limitPrice,
  split = false
}) {
  const parsedAmt = parseFloat(amount) || 100
  const quotes = MOCK_QUOTES.filter(q => q.eventId === eventId && q.outcomeId === outcomeId)

  if (quotes.length === 0) {
    throw new Error('No quotes available for this market and outcome.')
  }

  // Calculate venue options
  const routes = quotes.map(q => {
    const venue = VENUE_MAP.get(q.venueId)
    const key = `${eventId}_${q.venueId}_${outcomeId}`
    const ob = MOCK_ORDERBOOKS[key]

    let venuePrice = side === 'buy' ? q.bestAsk : q.bestBid
    if (type === 'limit' && limitPrice) {
      venuePrice = parseFloat(limitPrice)
    }

    // Book level depth walk
    const levels = side === 'buy' ? (ob ? ob.asks : []) : (ob ? ob.bids : [])
    const availableDepth = levels.slice(0, 3).reduce((sum, l) => sum + l.size, 0) || 5000

    const feeRate = venue.chain === 'Sui' ? 0.0015 : 0.003
    const fee = Math.round(parsedAmt * feeRate * 100) / 100
    const netAmount = side === 'buy' ? parsedAmt - fee : parsedAmt
    const estimatedShares = Math.round(netAmount / venuePrice)

    return {
      venueId: q.venueId,
      venueName: venue.name,
      chain: venue.chain,
      venueColor: venue.color,
      price: venuePrice,
      availableSize: availableDepth,
      fee,
      estimatedShares,
      isSui: venue.chain === 'Sui'
    }
  })

  // Sort: cheapest price for buy, highest for sell
  routes.sort((a, b) => side === 'buy' ? a.price - b.price : b.price - a.price)
  const bestRoute = routes[0]

  // Consensus comparison
  let totalVol = 0
  let weightedSum = 0
  quotes.forEach(q => {
    totalVol += q.volume24h
    weightedSum += q.lastPrice * q.volume24h
  })
  const consensus = totalVol > 0 ? weightedSum / totalVol : 0.5
  const gapPp = Math.round((bestRoute.price - consensus) * 100 * 10) / 10

  let avgFillPrice = bestRoute.price
  let totalShares = bestRoute.estimatedShares
  let totalFees = bestRoute.fee
  let splitRoutes = null

  if (split && routes.length > 1) {
    const splitCount = Math.min(3, routes.length)
    const portionAmt = parsedAmt / splitCount
    splitRoutes = routes.slice(0, splitCount).map(r => {
      const pShares = Math.round((portionAmt - r.fee / splitCount) / r.price)
      return {
        ...r,
        allocatedAmount: Math.round(portionAmt * 100) / 100,
        allocatedShares: pShares
      }
    })
    totalShares = splitRoutes.reduce((acc, r) => acc + r.allocatedShares, 0)
    avgFillPrice = Math.round((parsedAmt / totalShares) * 1000) / 1000
    totalFees = Math.round(splitRoutes.reduce((acc, r) => acc + r.fee, 0) * 100) / 100
  }

  const maxPayout = totalShares * 1.00 // $1.00 per share if resolves YES
  const potentialProfit = Math.round((maxPayout - parsedAmt) * 100) / 100
  const slippagePct = Math.round((parsedAmt > 5000 ? 0.8 : 0.2) * 10) / 10

  return {
    routes,
    bestRoute,
    splitRoutes,
    avgFillPrice,
    totalShares,
    totalFees,
    maxPayout,
    potentialProfit,
    slippagePct,
    consensusPrice: Math.round(consensus * 1000) / 1000,
    consensusGapPp: gapPp
  }
}
