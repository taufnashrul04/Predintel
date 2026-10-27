import { MOCK_EVENTS } from '../mock/events.mjs'
import { MOCK_QUOTES } from '../mock/quotes.mjs'
import { MOCK_ORDERBOOKS } from '../mock/orderbooks.mjs'
import { MOCK_HISTORY } from '../mock/history.mjs'
import { MOCK_TRADES, MOCK_WALLETS } from '../mock/wallets.mjs'

export function createBaseAdapter(venueId, name) {
  return {
    id: venueId,
    name,
    async getMarkets() {
      // TODO: real API/RPC call for venue
      return MOCK_EVENTS
    },
    async getQuotes(eventId, outcomeId) {
      // TODO: real API/RPC call for venue
      let list = MOCK_QUOTES.filter(q => q.venueId === venueId)
      if (eventId) list = list.filter(q => q.eventId === eventId)
      if (outcomeId) list = list.filter(q => q.outcomeId === outcomeId)
      return list
    },
    async getOrderBook(eventId, outcomeId) {
      // TODO: real API/RPC call for venue
      const key = `${eventId}_${venueId}_${outcomeId}`
      return MOCK_ORDERBOOKS[key] || null
    },
    async getPriceHistory(eventId, outcomeId = 'yes') {
      // TODO: real API/RPC call for venue
      const eventHist = MOCK_HISTORY[eventId] || {}
      const outcomeHist = eventHist[outcomeId] || []
      return outcomeHist.filter(p => p.venueId === venueId)
    },
    async getTrades(eventId) {
      // TODO: real API/RPC call for venue
      let trades = MOCK_TRADES.filter(t => t.venueId === venueId)
      if (eventId) trades = trades.filter(t => t.eventId === eventId)
      return trades
    },
    async getWallet(address) {
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

export const ADAPTERS = {
  polymarket: polymarketAdapter,
  predictfun: predictfunAdapter,
  waterx: waterxAdapter,
  deepbook: deepbookAdapter,
  opinion: opinionAdapter,
  sxbet: sxbetAdapter,
  limitless: limitlessAdapter
}
