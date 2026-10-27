import { VenueQuote } from '../types'
import { MOCK_EVENTS } from './events'
import { VENUES } from '../config/venues'
import { createPRNG } from './seed'

// Seeded generator for quotes
export function generateMockQuotes(): VenueQuote[] {
  const rng = createPRNG(424299)
  const quotes: VenueQuote[] = []

  // Base probabilities for events
  const baseProbMap: Record<string, number> = {
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

  // Pre-configured venue subsets per event (3-6 venues)
  for (const event of MOCK_EVENTS) {
    const baseProb = baseProbMap[event.id] ?? 0.5
    // Select venues
    const venueCount = 3 + Math.floor(rng() * 4) // 3 to 6
    const shuffledVenues = [...VENUES].sort(() => rng() - 0.5).slice(0, venueCount)

    // Force high divergence for 4 specific events:
    const forceHighDivergence = ['evt-btc-150k', 'evt-sui-5', 'evt-fed-dec-cut', 'evt-lakers-celtics'].includes(event.id)

    shuffledVenues.forEach((venue, idx) => {
      let offset = (rng() - 0.5) * 0.04
      if (forceHighDivergence) {
        if (idx === 0) offset = -0.045 - rng() * 0.02 // very low
        if (idx === 1) offset = +0.040 + rng() * 0.02 // very high
      }

      let price = Math.max(0.02, Math.min(0.98, baseProb + offset))
      price = Math.round(price * 1000) / 1000

      const spread = 0.006 + rng() * 0.012
      const bestBid = Math.max(0.01, Math.round((price - spread / 2) * 1000) / 1000)
      const bestAsk = Math.min(0.99, Math.round((price + spread / 2) * 1000) / 1000)

      const change24h = Math.round(((rng() - 0.48) * 12) * 10) / 10
      const volume24h = Math.round(50000 + rng() * 850000)
      const totalVolume = Math.round(volume24h * (2.5 + rng() * 6))
      const openInterest = Math.round(volume24h * (0.8 + rng() * 1.8))
      const liquidity = Math.round(openInterest * (0.15 + rng() * 0.3))
      const traders = Math.round(250 + rng() * 4200)

      quotes.push({
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
        updatedAt: new Date(Date.now() - Math.floor(rng() * 120000)).toISOString()
      })
    })
  }

  return quotes
}

export const MOCK_QUOTES = generateMockQuotes()
