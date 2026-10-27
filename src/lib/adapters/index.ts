import { VenueAdapter } from './types'
import { Event, VenueQuote, OrderBook, PricePoint, Trade, WalletProfile } from '../types'
import { MOCK_EVENTS } from '../mock/events'
import { MOCK_QUOTES } from '../mock/quotes'
import { MOCK_ORDERBOOKS } from '../mock/orderbooks'
import { MOCK_HISTORY } from '../mock/history'
import { MOCK_TRADES, MOCK_WALLETS } from '../mock/wallets'

export function createBaseAdapter(venueId: string, name: string): VenueAdapter {
  return {
    id: venueId,
    name,
    async getMarkets(): Promise<Event[]> {
      // TODO: real API/RPC call for venue
      return MOCK_EVENTS
    },
    async getQuotes(eventId?: string): Promise<VenueQuote[]> {
      // TODO: real API/RPC call for venue
      const quotes = MOCK_QUOTES.filter(q => q.venueId === venueId)
      if (eventId) {
        return quotes.filter(q => q.eventId === eventId)
      }
      return quotes
    },
    async getOrderBook(eventId: string, outcomeId: string): Promise<OrderBook | null> {
      // TODO: real API/RPC call for venue
      const key = `${eventId}_${venueId}_${outcomeId}`
      return MOCK_ORDERBOOKS[key] || null
    },
    async getPriceHistory(eventId: string, _range?: string): Promise<PricePoint[]> {
      // TODO: real API/RPC call for venue
      const allPoints = MOCK_HISTORY[eventId] || []
      return allPoints.filter(p => p.venueId === venueId)
    },
    async getTrades(eventId?: string): Promise<Trade[]> {
      // TODO: real API/RPC call for venue
      const trades = MOCK_TRADES.filter(t => t.venueId === venueId)
      if (eventId) {
        return trades.filter(t => t.eventId === eventId)
      }
      return trades
    },
    async getWallet(address: string): Promise<WalletProfile | null> {
      // TODO: real API/RPC call for venue
      return MOCK_WALLETS.find(w => w.address.toLowerCase() === address.toLowerCase()) || null
    }
  }
}

export const polymarketAdapter = createBaseAdapter('polymarket', 'Polymarket')
export const predictfunAdapter = createBaseAdapter('predictfun', 'Predict.fun')
export const waterxAdapter = createBaseAdapter('waterx', 'WaterX')
export const deepbookAdapter = createBaseAdapter('deepbook', 'DeepBook')
export const opinionAdapter = createBaseAdapter('opinion', 'Opinion')
export const sxbetAdapter = createBaseAdapter('sxbet', 'SX Bet')
export const limitlessAdapter = createBaseAdapter('limitless', 'Limitless')

export const ADAPTERS: Record<string, VenueAdapter> = {
  polymarket: polymarketAdapter,
  predictfun: predictfunAdapter,
  waterx: waterxAdapter,
  deepbook: deepbookAdapter,
  opinion: opinionAdapter,
  sxbet: sxbetAdapter,
  limitless: limitlessAdapter
}
