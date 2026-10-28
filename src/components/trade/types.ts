export type Side = 'buy' | 'sell'
export type OrderType = 'market' | 'limit'
export type ExecMode = 'direct' | 'agent'

export interface TicketState {
  side: Side
  type: OrderType
  amount: string
  limitPrice: string
  split: boolean
  mode: ExecMode
}

export interface RouteQuote {
  venueId: string
  venueName: string
  chain: string
  venueColor: string
  marketUrl: string
  isSui: boolean
  executable: boolean
  topPrice: number | null
  price: number
  estimatedShares: number
  notional: number
  fee: number
  filledPct: number
  slippagePct: number
  availableSize: number
}

export interface RouteLeg {
  venueId: string
  venueName: string
  chain: string
  venueColor: string
  allocatedAmount: number
  allocatedShares: number
  notional: number
  fee: number
  price: number
}

export interface TradeQuote {
  eventId: string
  marketTitle: string
  outcomeId: string
  outcomeLabel: string
  side: Side
  type: OrderType
  limitPrice: number | null
  amount: number
  mode: ExecMode
  routes: RouteQuote[]
  bestRoute: RouteQuote
  bestExecutableRoute: RouteQuote | null
  legs: RouteLeg[]
  splitRoutes: RouteLeg[] | null
  avgFillPrice: number
  totalShares: number
  totalFees: number
  totalCost: number | null
  proceeds: number | null
  maxPayout: number | null
  potentialProfit: number | null
  slippagePct: number
  unfilledAmount: number
  restingAmount: number
  consensusPrice: number
  consensusGapPp: number
  heldShares: number | null
  executable: boolean
  notExecutableReason: string | null
}

export interface AgentRules {
  maxPerTrade: number
  dailyBudget: number
  allowedVenues: string[]
  maxSlippagePct: number
  autoTradeSpreadEnabled: boolean
  autoTradeMinSpread: number
  autoTradeCategories: string[]
}

export interface AgentActivity {
  id: string
  type: string
  amount: number
  venue: string
  status: string
  simulated?: boolean
  txDigest: string | null
  ref?: string
  time: string
  details: string
}

export interface AgentWallet {
  address: string
  network: string
  balanceUSDC: number
  balanceSUI: number
  dailyBudget: number
  spentToday: number
  rules: AgentRules
  activityLog: AgentActivity[]
}

export interface Position {
  id: string
  eventId: string
  marketSlug: string
  marketTitle: string
  outcomeId: string
  outcomeLabel: string
  venueId: string
  shares: number
  avgPrice: number
  currentPrice: number
  pnl: number
  returnPct: number
}

export interface OpenOrder {
  id: string
  eventId?: string
  marketSlug: string
  marketTitle: string
  outcomeLabel: string
  venueId: string
  type: string
  side: Side
  price: number
  amount: number
  mode?: string
  status: string
  createdAt: string
}

export interface TradeRecord {
  id: string
  marketTitle: string
  outcomeLabel?: string
  outcomeId: string
  side: Side
  mode: string
  venueId: string
  shares: number
  price: number
  amount: number
  fee: number
  status: string
  simulated?: boolean
  txDigest: string | null
  ref?: string
  signer?: string | null
  t: string
}

export interface ExecutionStatus {
  status: 'building' | 'signing' | 'pending' | 'confirmed' | 'failed'
  mode: ExecMode
  venues: string
  amount: number
  shares: number
  ref?: string | null
  txDigest?: string | null
  simulated?: boolean
  reason?: string
}

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
  return body as T
}

export const postJson = <T,>(url: string, body: unknown) =>
  apiJson<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const cents = (p: number | null | undefined, digits = 1) =>
  p == null || !Number.isFinite(p) ? '—' : `${(p * 100).toFixed(digits)}¢`

export const usd = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const shortAddr = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)
