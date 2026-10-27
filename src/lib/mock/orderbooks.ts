import { OrderBook, OrderBookLevel } from '../types'
import { MOCK_EVENTS } from './events'
import { VENUES } from '../config/venues'
import { createPRNG } from './seed'

export function generateMockOrderBooks(): Record<string, OrderBook> {
  const rng = createPRNG(837192)
  const orderBookMap: Record<string, OrderBook> = {}

  for (const event of MOCK_EVENTS) {
    for (const venue of VENUES) {
      const outcomeId = event.outcomes[0].id
      const mid = 0.2 + rng() * 0.6
      const spread = 0.004 + rng() * 0.015

      const bids: OrderBookLevel[] = []
      let bidCum = 0
      for (let i = 0; i < 15; i++) {
        const price = Math.max(0.01, Math.round((mid - spread / 2 - i * 0.005) * 1000) / 1000)
        const size = Math.round(500 + rng() * 12500)
        bidCum += size
        bids.push({ price, size, total: bidCum })
      }

      const asks: OrderBookLevel[] = []
      let askCum = 0
      for (let i = 0; i < 15; i++) {
        const price = Math.min(0.99, Math.round((mid + spread / 2 + i * 0.005) * 1000) / 1000)
        const size = Math.round(500 + rng() * 12500)
        askCum += size
        asks.push({ price, size, total: askCum })
      }

      const key = `${event.id}_${venue.id}_${outcomeId}`
      orderBookMap[key] = {
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

  return orderBookMap
}

export const MOCK_ORDERBOOKS = generateMockOrderBooks()
