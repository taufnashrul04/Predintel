import { MOCK_EVENTS } from './events.mjs'
import { EVENT_LISTING_VENUES, MOCK_QUOTES } from './quotes.mjs'
import { createPRNG } from './seed.mjs'

export function generateMockOrderBooks() {
  const rng = createPRNG(837192)
  const orderBookMap = {}

  for (const event of MOCK_EVENTS) {
    const listingVenues = EVENT_LISTING_VENUES[event.id] || []

    for (const outcome of event.outcomes) {
      for (const venue of listingVenues) {
        // Find venue quote to guarantee mid price matches quote.lastPrice
        const quote = MOCK_QUOTES.find(
          q => q.eventId === event.id && q.venueId === venue.id && q.outcomeId === outcome.id
        )
        const mid = quote ? quote.lastPrice : 0.5
        const spread = quote ? Math.round((quote.bestAsk - quote.bestBid) * 1000) / 1000 : 0.008

        const bids = []
        let bidCum = 0
        for (let i = 0; i < 15; i++) {
          const price = Math.max(0.01, Math.round((mid - spread / 2 - i * 0.005) * 1000) / 1000)
          const size = Math.round(500 + rng() * 12500)
          bidCum += size
          bids.push({ price, size, total: bidCum })
        }

        const asks = []
        let askCum = 0
        for (let i = 0; i < 15; i++) {
          const price = Math.min(0.99, Math.round((mid + spread / 2 + i * 0.005) * 1000) / 1000)
          const size = Math.round(500 + rng() * 12500)
          askCum += size
          asks.push({ price, size, total: askCum })
        }

        const key = `${event.id}_${venue.id}_${outcome.id}`
        orderBookMap[key] = {
          eventId: event.id,
          venueId: venue.id,
          outcomeId: outcome.id,
          bids,
          asks,
          spread: Math.round(spread * 1000) / 1000,
          midPrice: Math.round(mid * 1000) / 1000
        }
      }
    }
  }

  return orderBookMap
}

export const MOCK_ORDERBOOKS = generateMockOrderBooks()
