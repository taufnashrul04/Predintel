import { ADAPTERS } from '../adapters/index.mjs'
import { MOCK_EVENTS } from '../mock/events.mjs'

export class MarketAggregator {
  async getAllEvents() {
    return MOCK_EVENTS
  }

  async getQuotesForEvent(eventId, outcomeId) {
    const promises = Object.values(ADAPTERS).map(a => a.getQuotes(eventId, outcomeId))
    const results = await Promise.all(promises)
    return results.flat()
  }

  async getAllQuotes() {
    const promises = Object.values(ADAPTERS).map(a => a.getQuotes())
    const results = await Promise.all(promises)
    return results.flat()
  }

  async getOrderBook(eventId, venueId, outcomeId) {
    const adapter = ADAPTERS[venueId]
    if (!adapter) return null
    return adapter.getOrderBook(eventId, outcomeId)
  }

  async getPriceHistory(eventId, outcomeId = 'yes') {
    const promises = Object.values(ADAPTERS).map(a => a.getPriceHistory(eventId, outcomeId))
    const results = await Promise.all(promises)
    return results.flat().sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
  }
}

export const aggregator = new MarketAggregator()
