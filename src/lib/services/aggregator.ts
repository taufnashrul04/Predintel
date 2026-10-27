import { ADAPTERS } from '../adapters'
import { Event, VenueQuote, OrderBook, PricePoint, Trade, WalletProfile } from '../types'
import { MOCK_EVENTS } from '../mock/events'

export class MarketAggregator {
  async getAllEvents(): Promise<Event[]> {
    return MOCK_EVENTS
  }

  async getQuotesForEvent(eventId: string): Promise<VenueQuote[]> {
    const promises = Object.values(ADAPTERS).map(adapter => adapter.getQuotes(eventId))
    const results = await Promise.all(promises)
    return results.flat()
  }

  async getAllQuotes(): Promise<VenueQuote[]> {
    const promises = Object.values(ADAPTERS).map(adapter => adapter.getQuotes())
    const results = await Promise.all(promises)
    return results.flat()
  }

  async getOrderBook(eventId: string, venueId: string, outcomeId: string): Promise<OrderBook | null> {
    const adapter = ADAPTERS[venueId]
    if (!adapter) return null
    return adapter.getOrderBook(eventId, outcomeId)
  }

  async getPriceHistory(eventId: string, range?: string): Promise<PricePoint[]> {
    const promises = Object.values(ADAPTERS).map(adapter => adapter.getPriceHistory(eventId, range))
    const results = await Promise.all(promises)
    return results.flat().sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
  }

  async getTrades(eventId?: string): Promise<Trade[]> {
    const promises = Object.values(ADAPTERS).map(adapter => adapter.getTrades(eventId))
    const results = await Promise.all(promises)
    return results.flat().sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime())
  }

  async getWallet(address: string): Promise<WalletProfile | null> {
    for (const adapter of Object.values(ADAPTERS)) {
      const w = await adapter.getWallet(address)
      if (w) return w
    }
    return null
  }
}

export const aggregator = new MarketAggregator()
