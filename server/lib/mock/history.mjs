import { MOCK_EVENTS } from './events.mjs'
import { EVENT_LISTING_VENUES } from './quotes.mjs'
import { createPRNG } from './seed.mjs'

export function generateMockHistory() {
  const rng = createPRNG(987654)
  const historyMap = {}

  const now = new Date('2026-10-27T18:00:00Z').getTime()
  const oneHour = 3600 * 1000

  for (const event of MOCK_EVENTS) {
    const listingVenues = EVENT_LISTING_VENUES[event.id] || []
    historyMap[event.id] = {}

    for (const outcome of event.outcomes) {
      const basePrice = outcome.id === 'no' ? 0.45 : outcome.id === 'yes' ? 0.55 : 1 / event.outcomes.length
      const points = []

      for (const venue of listingVenues) {
        let currentPrice = basePrice + (rng() - 0.5) * 0.05
        for (let h = 720; h >= 0; h--) {
          const time = new Date(now - h * oneHour).toISOString()
          const shock = (rng() - 0.495) * 0.015
          currentPrice = Math.max(0.01, Math.min(0.99, currentPrice + shock))
          points.push({
            t: time,
            venueId: venue.id,
            outcomeId: outcome.id,
            price: Math.round(currentPrice * 1000) / 1000
          })
        }
      }
      historyMap[event.id][outcome.id] = points
    }
  }

  return historyMap
}

export const MOCK_HISTORY = generateMockHistory()
