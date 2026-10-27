import { Event, VenueQuote, OrderBook, PricePoint, Trade, WalletProfile } from '../types'

export interface VenueAdapter {
  id: string
  name: string
  getMarkets(): Promise<Event[]>
  getQuotes(eventId?: string): Promise<VenueQuote[]>
  getOrderBook(eventId: string, outcomeId: string): Promise<OrderBook | null>
  getPriceHistory(eventId: string, range?: string): Promise<PricePoint[]>
  getTrades(eventId?: string): Promise<Trade[]>
  getWallet(address: string): Promise<WalletProfile | null>
}
