export type Category = 'sports' | 'politics' | 'crypto' | 'culture' | 'macro'

export interface Venue {
  id: string
  name: string
  chain: string
  type: 'orderbook' | 'amm'
  color: string
  url: string
  status: 'live' | 'degraded' | 'offline'
  latencyMs: number
}

export interface Outcome {
  id: string
  label: string
}

export interface Event {
  id: string
  slug: string
  title: string
  description: string
  category: Category
  tags: string[]
  startDate: string
  endDate: string
  status: 'open' | 'closed' | 'resolved'
  resolvedOutcomeId?: string
  outcomes: Outcome[]
  resolutionSource: string
  consensus?: number
  spread?: number
  totalVolume?: number
  totalOI?: number
  isWatchlisted?: boolean
  quotes?: VenueQuote[]
}

export interface VenueQuote {
  eventId: string
  venueId: string
  outcomeId: string
  bestBid: number
  bestAsk: number
  lastPrice: number
  change24h: number
  volume24h: number
  totalVolume: number
  openInterest: number
  liquidity: number
  traders: number
  marketUrl: string
  updatedAt: string
}

export interface OrderBookLevel {
  price: number
  size: number
  total: number
}

export interface OrderBook {
  eventId: string
  venueId: string
  outcomeId: string
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  spread: number
  midPrice: number
}

export interface Trade {
  id: string
  eventId: string
  venueId: string
  wallet: string
  side: 'buy' | 'sell'
  outcomeId: string
  price: number
  size: number
  notional: number
  txHash: string
  t: string
}

export interface WalletPosition {
  eventId: string
  eventTitle: string
  venueId: string
  outcomeId: string
  shares: number
  avgPrice: number
  currentPrice: number
  pnl: number
}

export interface WalletProfile {
  address: string
  chain: string
  label?: string
  isWhale: boolean
  firstSeen: string
  totalVolume: number
  realizedPnl: number
  unrealizedPnl: number
  winRate: number
  marketsTraded: number
  credibilityScore: number
  brierScore: number
  categoryAccuracy: Record<Category, number>
  venues: string[]
  pnlHistory: { t: string; pnl: number }[]
  positions: WalletPosition[]
  isFollowed?: boolean
}

export interface Pick {
  id: string
  eventId: string
  outcomeId: string
  probability: number
  consensusAtPick: number
  stake?: number
  reasoning: string
  createdAt: string
  result: 'pending' | 'won' | 'lost'
  resolvedAt?: string
}

export interface MemoryEntry {
  id: string
  kind: 'pick' | 'outcome' | 'credibility' | 'preference' | 'insight' | 'watchlist'
  text: string
  eventId?: string
  wallet?: string
  createdAt: string
  blobId?: string
  status: 'queued' | 'stored'
}

export interface Alert {
  id: string
  kind: 'divergence' | 'whale' | 'odds_move' | 'resolution'
  eventId?: string
  message: string
  severity: 'info' | 'warn' | 'high'
  createdAt: string
  read: boolean
}

export interface AlertRule {
  id: string
  kind: 'divergence' | 'whale' | 'odds_move' | 'resolution'
  threshold: number
  category?: Category
  venueIds?: string[]
  enabled: boolean
}

export interface DivergenceItem {
  event: Event
  outcome: Outcome
  consensus: number
  minQuote: VenueQuote
  maxQuote: VenueQuote
  spreadPp: number
  arbitrageEdge: number
}
