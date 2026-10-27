import { PricePoint } from '../types'
import { MOCK_EVENTS } from './events'
import { VENUES } from '../config/venues'
import { createPRNG } from './seed'

// Generate 30 days of hourly price history (720 points per venue per event)
export function generateMockHistory(): Record<string, PricePoint[]> {
  const rng = createPRNG(987654)
  const historyMap: Record<string, PricePoint[]> = {}

  const now = new Date('2026-10-27T18:00:00Z').getTime()
  const oneHour = 3600 * 1000

  for (const event of MOCK_EVENTS) {
    const basePrice = 0.35 + rng() * 0.35
    const points: PricePoint[] = []

    for (const venue of VENUES) {
      let currentPrice = basePrice + (rng() - 0.5) * 0.05

      // Step back 720 hours (30 days)
      const venuePoints: PricePoint[] = []
      for (let h = 720; h >= 0; h--) {
        const time = new Date(now - h * oneHour).toISOString()
        const shock = (rng() - 0.495) * 0.015
        currentPrice = Math.max(0.02, Math.min(0.98, currentPrice + shock))
        venuePoints.push({
          t: time,
          venueId: venue.id,
          price: Math.round(currentPrice * 1000) / 1000
        })
      }
      points.push(...venuePoints)
    }

    historyMap[event.id] = points
  }

  return historyMap
}

export const MOCK_HISTORY = generateMockHistory()
