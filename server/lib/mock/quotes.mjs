import { MOCK_EVENTS } from './events.mjs'
import { VENUES } from '../venues.mjs'
import { createPRNG } from './seed.mjs'

// Deterministic generator with support for multi-outcome events
export function generateMockQuotes() {
  const rng = createPRNG(424299)
  const quotes = []

  // Base probabilities per event and outcome
  const baseProbMap = {
    'evt-btc-150k': { yes: 0.485, no: 0.515 },
    'evt-sui-5': { yes: 0.612, no: 0.388 },
    'evt-fed-dec-cut': { yes: 0.742, no: 0.258 },
    'evt-us-cpi-3pct': { yes: 0.365, no: 0.635 },
    'evt-lakers-celtics': { yes: 0.428, no: 0.572 },
    'evt-realmadrid-ucl': { yes: 0.285, no: 0.715 },
    'evt-taylor-album': { yes: 0.535, no: 0.465 },
    'evt-oscar-best-picture': {
      'film-dune3': 0.410,
      'film-odyssey': 0.270,
      'film-solaris': 0.190,
      'film-other': 0.130
    },
    'evt-f1-champion-2026': {
      'max-verstappen': 0.520,
      'lando-norris': 0.240,
      'charles-leclerc': 0.130,
      'oscar-piastri': 0.070,
      'lewis-hamilton': 0.040
    },
    'evt-eth-etf-inflows': { yes: 0.665, no: 0.335 },
    'evt-bank-indonesia-cut': { yes: 0.315, no: 0.685 },
    'evt-super-bowl-lxi-chiefs': { yes: 0.245, no: 0.755 },
    'evt-polymarket-volume-5b': { yes: 0.690, no: 0.310 },
    'evt-eu-ai-act-court-challenge': { yes: 0.920, no: 0.080 }
  }

  // Pre-assign listing venues per event (3 to 6 venues)
  // Sui-native markets must be tradable on Sui venues; seeded positions and orders rely on these.
  const PINNED_VENUES = { 'evt-sui-5': ['waterx', 'deepbook'], 'evt-fed-dec-cut': ['waterx'] }
  const eventVenuesMap = {}
  for (const event of MOCK_EVENTS) {
    const venueCount = 3 + Math.floor(rng() * 4)
    const listing = [...VENUES].sort(() => rng() - 0.5).slice(0, venueCount)
    for (const id of PINNED_VENUES[event.id] ?? []) {
      if (!listing.some(v => v.id === id)) listing.push(VENUES.find(v => v.id === id))
    }
    eventVenuesMap[event.id] = listing
  }

  for (const event of MOCK_EVENTS) {
    const eventProbMap = baseProbMap[event.id] || { yes: 0.5, no: 0.5 }
    const listingVenues = eventVenuesMap[event.id]
    const forceHighDivergence = ['evt-btc-150k', 'evt-sui-5', 'evt-fed-dec-cut', 'evt-lakers-celtics'].includes(event.id)

    for (const outcome of event.outcomes) {
      const baseProb = eventProbMap[outcome.id] || (1 / event.outcomes.length)

      listingVenues.forEach((venue, idx) => {
        let offset = (rng() - 0.5) * 0.04
        if (forceHighDivergence && outcome.id === 'yes') {
          if (idx === 0) offset = -0.045 - rng() * 0.02
          if (idx === 1) offset = +0.040 + rng() * 0.02
        }

        let price = Math.max(0.01, Math.min(0.99, baseProb + offset))
        price = Math.round(price * 1000) / 1000

        const spread = 0.006 + rng() * 0.012
        const bestBid = Math.max(0.01, Math.round((price - spread / 2) * 1000) / 1000)
        const bestAsk = Math.min(0.99, Math.round((price + spread / 2) * 1000) / 1000)

        const change24h = Math.round(((rng() - 0.48) * 12) * 10) / 10
        const volume24h = Math.round((40000 + rng() * 500000) * baseProb)
        const totalVolume = Math.round(volume24h * (2.5 + rng() * 6))
        const openInterest = Math.round(volume24h * (0.8 + rng() * 1.8))
        const liquidity = Math.round(openInterest * (0.15 + rng() * 0.3))
        const traders = Math.round(150 + rng() * 3200)

        quotes.push({
          eventId: event.id,
          venueId: venue.id,
          outcomeId: outcome.id,
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
  }

  return { quotes, eventVenuesMap }
}

export const { quotes: MOCK_QUOTES, eventVenuesMap: EVENT_LISTING_VENUES } = generateMockQuotes()
