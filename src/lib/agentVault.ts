import { useCallback, useEffect, useState } from 'react'
import type { PaperMark } from './paperJournal'

// The simulated x402 agent vault, kept in the browser. A serverless backend (Vercel) keeps no memory
// between requests, so the vault's balance, rules, positions, orders and history live here and the
// server only prices orders (GET /api/trade/quote) and marks positions (POST /api/paper/marks).

export interface AgentRules {
  maxPerTrade: number
  dailyBudget: number
  allowedVenues: string[]
  maxSlippagePct: number
}

export interface VaultPosition {
  id: string
  market: string
  marketTitle: string
  outcomeId: string
  outcomeLabel: string
  venueId: string
  shares: number
  avgPrice: number
  live: boolean
  strike: number | null
  expiresAt: string | null
  openedAt: string
}

export interface VaultOrder {
  id: string
  market: string
  marketTitle: string
  outcomeId: string
  outcomeLabel: string
  venueId: string
  side: 'buy' | 'sell'
  price: number
  amount: number
  createdAt: string
}

export interface VaultTrade {
  id: string
  market: string
  marketTitle: string
  outcomeId: string
  outcomeLabel: string
  side: 'buy' | 'sell'
  venueId: string
  shares: number
  price: number
  amount: number
  fee: number
  realizedPnl?: number
  at: string
}

export interface VaultActivity {
  id: string
  type: 'deposit' | 'withdraw' | 'trade' | 'rules'
  amount: number
  details: string
  time: string
}

export interface Vault {
  balanceUSDC: number
  spentToday: number
  spentDate: string
  rules: AgentRules
  positions: VaultPosition[]
  orders: VaultOrder[]
  history: VaultTrade[]
  activity: VaultActivity[]
}

export interface VaultOrderInput {
  market: string
  outcome: string
  side: 'buy' | 'sell'
  amount: number
  type: 'market' | 'limit'
  limitPrice?: number
  split?: boolean
}

const KEY = 'predictintel:agent-vault'
const CHANGE_EVENT = 'predictintel:agent-vault-changed'
const today = () => new Date().toISOString().slice(0, 10)
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export const MAX_ORDER_USDC = 100_000

const DEFAULT_VAULT = (): Vault => ({
  balanceUSDC: 2500,
  spentToday: 0,
  spentDate: today(),
  rules: { maxPerTrade: 1000, dailyBudget: 5000, allowedVenues: ['waterx', 'deepbook'], maxSlippagePct: 1 },
  positions: [],
  orders: [],
  history: [],
  activity: []
})

const memory: { value: string | null } = { value: null }

function read(): Vault {
  let raw: string | null = memory.value
  try {
    raw = localStorage.getItem(KEY) ?? raw
  } catch {
    // storage blocked: fall back to this page view's memory
  }
  try {
    const v = { ...DEFAULT_VAULT(), ...JSON.parse(raw || '{}') } as Vault
    if (v.spentDate !== today()) return { ...v, spentToday: 0, spentDate: today() }
    return v
  } catch {
    return DEFAULT_VAULT()
  }
}

function write(v: Vault) {
  const raw = JSON.stringify(v)
  memory.value = raw
  try {
    localStorage.setItem(KEY, raw)
  } catch {
    // keep working for this page view
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

const update = (fn: (v: Vault) => Vault) => write(fn(read()))

async function quote(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') qs.set(k, String(v))
  const res = await fetch(`/api/trade/quote?${qs}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Quote failed (${res.status})`)
  return body
}

// Folds the filled legs of a quote into the vault and returns it.
function applyFill(v: Vault, q: any, closing = false): Vault {
  const now = new Date().toISOString()
  const positions = [...v.positions]
  const history = [...v.history]
  let balance = v.balanceUSDC

  for (const leg of q.legs ?? []) {
    if (!(leg.allocatedShares > 0)) continue
    const match = (p: VaultPosition) => p.market === q.marketKey && p.outcomeId === q.outcomeId && p.venueId === leg.venueId
    let realized: number | undefined
    if (q.side === 'buy') {
      const existing = positions.find(match)
      if (existing) {
        const cost = existing.avgPrice * existing.shares + leg.notional
        existing.shares = round(existing.shares + leg.allocatedShares)
        existing.avgPrice = round(cost / existing.shares, 4)
      } else {
        positions.unshift({
          id: uid('vpos'),
          market: q.marketKey,
          marketTitle: q.marketTitle,
          outcomeId: q.outcomeId,
          outcomeLabel: q.outcomeLabel,
          venueId: leg.venueId,
          shares: leg.allocatedShares,
          avgPrice: leg.price,
          live: Boolean(q.live),
          strike: q.strike ?? null,
          expiresAt: q.expiresAt ?? null,
          openedAt: now
        })
      }
      balance -= leg.allocatedAmount
    } else {
      const existing = positions.find(match)
      if (existing) {
        realized = round((leg.price - existing.avgPrice) * leg.allocatedShares - leg.fee)
        existing.shares = round(existing.shares - leg.allocatedShares)
        if (existing.shares <= 0.01) positions.splice(positions.indexOf(existing), 1)
      }
      balance += leg.notional - leg.fee
    }
    history.unshift({
      id: uid('vtr'),
      market: q.marketKey,
      marketTitle: q.marketTitle,
      outcomeId: q.outcomeId,
      outcomeLabel: q.outcomeLabel,
      side: q.side,
      venueId: leg.venueId,
      shares: leg.allocatedShares,
      price: leg.price,
      amount: leg.allocatedAmount,
      fee: leg.fee,
      realizedPnl: realized,
      at: now
    })
  }

  const orders = [...v.orders]
  if (q.restingAmount > 0 && !closing) {
    orders.unshift({
      id: uid('vord'),
      market: q.marketKey,
      marketTitle: q.marketTitle,
      outcomeId: q.outcomeId,
      outcomeLabel: q.outcomeLabel,
      venueId: q.bestExecutableRoute?.venueId ?? '',
      side: q.side,
      price: q.limitPrice,
      amount: q.restingAmount,
      createdAt: now
    })
    if (q.side === 'buy') balance -= q.restingAmount
  }

  const spent = q.side === 'buy' ? (q.totalCost ?? 0) + (q.restingAmount ?? 0) : 0
  const verb = closing ? 'CLOSE' : q.side.toUpperCase()
  return {
    ...v,
    balanceUSDC: round(balance),
    spentToday: round(v.spentToday + spent),
    positions,
    orders,
    history: history.slice(0, 200),
    activity: [
      { id: uid('vact'), type: 'trade' as const, amount: round(q.side === 'buy' ? spent : q.proceeds ?? 0), details: `${verb} ${q.outcomeLabel} · ${q.marketTitle}`, time: now },
      ...v.activity
    ].slice(0, 100)
  }
}

// Loads a market's live detail so positions on live markets can settle (strike / expiry).
async function liveMeta(market: string) {
  if (!/^(wx|wxm|dbp):/.test(market)) return { live: false, strike: null, expiresAt: null }
  const res = await fetch(`/api/trade/live-markets/${encodeURIComponent(market)}`)
  const m = await res.json().catch(() => ({}))
  return { live: true, strike: m.referencePrice ?? null, expiresAt: m.settlesAt ?? null }
}

export async function executeVaultOrder(input: VaultOrderInput) {
  const v = read()
  const { rules } = v
  if (!(input.amount > 0)) throw new Error('Amount must be greater than 0.')
  if (input.amount > rules.maxPerTrade) throw new Error(`Amount exceeds the agent's max per trade ($${rules.maxPerTrade.toLocaleString('en-US')}).`)
  if (input.side === 'buy') {
    if (input.amount > v.balanceUSDC) throw new Error(`Agent vault has $${v.balanceUSDC.toFixed(2)} USDC. Deposit more or lower the amount.`)
    if (v.spentToday + input.amount > rules.dailyBudget) {
      throw new Error(`Daily budget reached: $${Math.max(0, rules.dailyBudget - v.spentToday).toFixed(2)} of $${rules.dailyBudget.toLocaleString('en-US')} left today.`)
    }
  }
  const held = input.side === 'sell'
    ? v.positions.filter(p => p.market === input.market && p.outcomeId === input.outcome)
    : []
  if (input.side === 'sell' && held.length === 0) throw new Error("The agent vault doesn't hold this outcome.")

  // Sells go to the venue the vault holds; the server can't see browser-held shares otherwise.
  const venue = held[0]?.venueId
  const q = await quote({
    market: input.market,
    outcome: input.outcome,
    side: input.side,
    amount: input.amount,
    type: input.type,
    limitPrice: input.type === 'limit' ? input.limitPrice : undefined,
    split: input.side === 'buy' ? String(Boolean(input.split)) : 'false',
    mode: 'agent',
    allowed: rules.allowedVenues.join(','),
    venue,
    held: input.side === 'sell' ? held.filter(p => p.venueId === venue).reduce((s, p) => s + p.shares, 0) : undefined
  })
  if (!q.executable) throw new Error(q.notExecutableReason || 'Nothing fills right now.')
  if (q.slippagePct > rules.maxSlippagePct) throw new Error(`Slippage ${q.slippagePct}% is above the agent limit of ${rules.maxSlippagePct}%. Lower the amount.`)

  const meta = await liveMeta(input.market)
  update(cur => applyFill(cur, { ...q, marketKey: input.market, ...meta }))
  return q
}

// Sells every share of a position into the book. Reduce-only, so the agent's limits don't apply.
export async function closeVaultPosition(id: string) {
  const p = read().positions.find(x => x.id === id)
  if (!p) throw new Error('Position not found.')
  const q = await quote({
    market: p.market,
    outcome: p.outcomeId,
    side: 'sell',
    amount: p.shares,
    type: 'market',
    mode: 'direct',
    venue: p.venueId,
    held: p.shares
  })
  if (!(q.totalShares > 0)) throw new Error('No bids to close against right now. Try again shortly.')
  update(cur => applyFill(cur, { ...q, marketKey: p.market }, true))
  return q
}

export function cancelVaultOrder(id: string) {
  update(v => {
    const o = v.orders.find(x => x.id === id)
    if (!o) return v
    return {
      ...v,
      orders: v.orders.filter(x => x.id !== id),
      balanceUSDC: o.side === 'buy' ? round(v.balanceUSDC + o.amount) : v.balanceUSDC
    }
  })
}

export function moveVaultFunds(kind: 'deposit' | 'withdraw', amount: number) {
  const v = read()
  if (!(amount > 0)) throw new Error('Enter an amount greater than 0.')
  if (amount > MAX_ORDER_USDC) throw new Error(`Amount cannot exceed $${MAX_ORDER_USDC.toLocaleString('en-US')}.`)
  if (kind === 'withdraw' && amount > v.balanceUSDC) throw new Error(`Vault only holds $${v.balanceUSDC.toFixed(2)}.`)
  const next = round(v.balanceUSDC + (kind === 'deposit' ? amount : -amount))
  write({
    ...v,
    balanceUSDC: next,
    activity: [
      { id: uid('vact'), type: kind, amount, details: `${kind === 'deposit' ? 'Deposited' : 'Withdrew'} $${amount.toFixed(2)} USDC (simulated)`, time: new Date().toISOString() },
      ...v.activity
    ].slice(0, 100)
  })
  return next
}

export function setVaultRules(rules: AgentRules) {
  if (rules.allowedVenues.length === 0) throw new Error('Allow at least one Sui venue.')
  if (!(rules.maxPerTrade >= 1 && rules.maxPerTrade <= MAX_ORDER_USDC)) throw new Error('Max per trade must be between 1 and 100,000.')
  if (!(rules.dailyBudget >= 1 && rules.dailyBudget <= MAX_ORDER_USDC * 10)) throw new Error('Daily budget must be between 1 and 1,000,000.')
  if (!(rules.maxSlippagePct >= 0.1 && rules.maxSlippagePct <= 10)) throw new Error('Max slippage must be between 0.1 and 10.')
  if (rules.maxPerTrade > rules.dailyBudget) throw new Error('Max per trade cannot be larger than the daily budget.')
  update(v => ({
    ...v,
    rules,
    activity: [
      { id: uid('vact'), type: 'rules' as const, amount: 0, details: `Rules: max $${rules.maxPerTrade}/trade, $${rules.dailyBudget}/day, slippage ≤ ${rules.maxSlippagePct}%`, time: new Date().toISOString() },
      ...v.activity
    ].slice(0, 100)
  }))
}

export function useVault() {
  const [vault, setVault] = useState<Vault>(() => read())
  const sync = useCallback(() => setVault(read()), [])
  useEffect(() => {
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [sync])
  return vault
}

// Live marks for vault positions, from the same endpoint the paper journal uses.
export function useVaultMarks(positions: VaultPosition[]) {
  const [marks, setMarks] = useState<Record<string, PaperMark>>({})
  const key = positions.map(p => `${p.id}:${p.shares}`).join(',')
  useEffect(() => {
    if (positions.length === 0) return setMarks({})
    let cancelled = false
    const load = () =>
      fetch('/api/paper/marks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions: positions.map(p => ({ id: p.id, market: p.market, outcomeId: p.outcomeId, strike: p.strike, expiresAt: p.expiresAt })) })
      })
        .then(r => r.json())
        .then(list => !cancelled && Array.isArray(list) && setMarks(Object.fromEntries(list.map((m: PaperMark) => [m.id, m]))))
        .catch(() => {})
    load()
    const t = window.setInterval(load, 15_000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [key])
  return marks
}
