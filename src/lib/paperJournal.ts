import { useCallback, useEffect, useState } from 'react'

// Paper journal: a Sui-signed session (server-verified) plus a per-wallet journal kept in this browser.
// The preview server has no durable storage, so trades, tracked wallets and settings live in localStorage.

export interface PaperSession {
  address: string
  token: string
  expiresAt: string
}

export type TradeSource =
  | { kind: 'trade' }
  | { kind: 'dashboard'; label: string }
  | { kind: 'copy'; wallet: string; fillDigest: string }

export interface PaperTrade {
  id: string
  market: string
  marketTitle: string
  outcomeId: string
  outcomeLabel: string
  venueId: string
  live: boolean
  strike: number | null
  expiresAt: string | null
  entryPrice: number
  shares: number
  cost: number
  fee: number
  consensusAtEntry: number
  openedAt: string
  source: TradeSource
  status: 'open' | 'closed' | 'settled'
  exitPrice?: number
  closedAt?: string
  realizedPnl?: number
  settlementPrice?: number
}

export interface TrackedWallet {
  address: string
  label: string
  addedAt: string
}

export interface Journal {
  trades: PaperTrade[]
  tracked: TrackedWallet[]
  copySize: number
  dismissed: string[]
}

export interface PaperMark {
  id: string
  status: 'open' | 'settled' | 'awaiting' | 'unknown'
  mark: number | null
  settlementPrice?: number
  demo?: boolean
}

const SESSION_KEY = 'predictintel:paper-session'
const journalKey = (address: string) => `predictintel:journal:${address}`
const CHANGE_EVENT = 'predictintel:journal-changed'
const EMPTY: Journal = { trades: [], tracked: [], copySize: 10, dismissed: [] }

const memory = new Map<string, string>()

function load(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

function save(key: string, value: string | null) {
  if (value == null) memory.delete(key)
  else memory.set(key, value)
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage blocked: keep working for this page view only.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function readSession(): PaperSession | null {
  try {
    const s = JSON.parse(load(SESSION_KEY) || 'null')
    return s && Date.parse(s.expiresAt) > Date.now() ? s : null
  } catch {
    return null
  }
}

function readJournal(address: string): Journal {
  try {
    return { ...EMPTY, ...JSON.parse(load(journalKey(address)) || '{}') }
  } catch {
    return EMPTY
  }
}

function useStoreEvent(sync: () => void) {
  useEffect(() => {
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [sync])
}

async function postJson<T>(url: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && token) save(SESSION_KEY, null)
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data as T
}

export function usePaperSession() {
  const [session, setSession] = useState<PaperSession | null>(() => readSession())
  useStoreEvent(useCallback(() => setSession(readSession()), []))

  // Sessions are signed by the server; after a server restart they stop verifying, so re-check once.
  useEffect(() => {
    if (!session) return
    fetch('/api/paper/auth/session', { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r => {
        if (r.status === 401) save(SESSION_KEY, null)
      })
      .catch(() => {})
  }, [session?.token])

  const signIn = useCallback(async (address: string, signMessage: (message: Uint8Array) => Promise<{ signature: string }>) => {
    const { message } = await postJson<{ message: string }>('/api/paper/auth/challenge', { address })
    const { signature } = await signMessage(new TextEncoder().encode(message))
    const next = await postJson<PaperSession>('/api/paper/auth/verify', { address, signature })
    save(SESSION_KEY, JSON.stringify(next))
    return next
  }, [])

  const signOut = useCallback(() => save(SESSION_KEY, null), [])

  return { session, signIn, signOut }
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function useJournal(address: string | null | undefined) {
  const [journal, setJournal] = useState<Journal>(() => (address ? readJournal(address) : EMPTY))
  const sync = useCallback(() => setJournal(address ? readJournal(address) : EMPTY), [address])
  useEffect(sync, [sync])
  useStoreEvent(sync)

  const update = useCallback(
    (fn: (j: Journal) => Journal) => {
      if (!address) return
      save(journalKey(address), JSON.stringify(fn(readJournal(address))))
    },
    [address]
  )

  // Buys at the server's live price and records the fill with where it came from.
  const paperBuy = useCallback(
    async (order: { market: string; outcome: string; amount: number }, source: TradeSource) => {
      const session = readSession()
      if (!session || session.address !== address) throw new Error('Sign in with your Sui wallet on the Journal page first.')
      const fill = await postJson<Omit<PaperTrade, 'source' | 'status'>>('/api/paper/fill', order, session.token)
      const trade: PaperTrade = { ...fill, source, status: 'open' }
      update(j => ({ ...j, trades: [trade, ...j.trades] }))
      return trade
    },
    [address, update]
  )

  const closeTrade = useCallback(
    async (id: string) => {
      const trade = readJournal(address!).trades.find(t => t.id === id)
      if (!trade || trade.status !== 'open') return
      const [mark] = await postJson<PaperMark[]>('/api/paper/marks', { positions: [trade] })
      if (mark?.mark == null) throw new Error('No live price to close at right now. Try again shortly.')
      update(j => ({
        ...j,
        trades: j.trades.map(t =>
          t.id === id
            ? {
                ...t,
                status: mark.status === 'settled' ? 'settled' : 'closed',
                exitPrice: mark.mark!,
                settlementPrice: mark.settlementPrice,
                closedAt: new Date().toISOString(),
                realizedPnl: round2(mark.mark! * t.shares - t.cost)
              }
            : t
        )
      }))
    },
    [address, update]
  )

  const applySettlements = useCallback(
    (marks: PaperMark[]) => {
      const settled = new Map(marks.filter(m => m.status === 'settled' && m.mark != null).map(m => [m.id, m]))
      if (settled.size === 0) return
      update(j => ({
        ...j,
        trades: j.trades.map(t => {
          const m = settled.get(t.id)
          if (!m || t.status !== 'open') return t
          return {
            ...t,
            status: 'settled',
            exitPrice: m.mark!,
            settlementPrice: m.settlementPrice,
            closedAt: new Date().toISOString(),
            realizedPnl: round2(m.mark! * t.shares - t.cost)
          }
        })
      }))
    },
    [update]
  )

  const removeTrade = useCallback((id: string) => update(j => ({ ...j, trades: j.trades.filter(t => t.id !== id) })), [update])

  const track = useCallback(
    (wallet: string, label: string) =>
      update(j =>
        j.tracked.some(w => w.address === wallet)
          ? j
          : { ...j, tracked: [...j.tracked, { address: wallet, label: label.trim().slice(0, 40) || `${wallet.slice(0, 6)}…${wallet.slice(-4)}`, addedAt: new Date().toISOString() }] }
      ),
    [update]
  )
  const untrack = useCallback((wallet: string) => update(j => ({ ...j, tracked: j.tracked.filter(w => w.address !== wallet) })), [update])
  const setCopySize = useCallback((n: number) => update(j => ({ ...j, copySize: n })), [update])
  const dismiss = useCallback((digest: string) => update(j => ({ ...j, dismissed: [...j.dismissed.slice(-200), digest] })), [update])

  return { journal, paperBuy, closeTrade, applySettlements, removeTrade, track, untrack, setCopySize, dismiss }
}

// Live marks for open trades; settled DeepBook windows are written back into the journal.
export function usePaperMarks(address: string | null | undefined, trades: PaperTrade[], applySettlements: (m: PaperMark[]) => void) {
  const [marks, setMarks] = useState<Record<string, PaperMark>>({})
  const open = trades.filter(t => t.status === 'open')
  const key = open.map(t => t.id).join(',')

  useEffect(() => {
    if (!address || open.length === 0) return
    let cancelled = false
    const load = () =>
      postJson<PaperMark[]>('/api/paper/marks', { positions: open })
        .then(list => {
          if (cancelled) return
          setMarks(Object.fromEntries(list.map(m => [m.id, m])))
          applySettlements(list)
        })
        .catch(() => {})
    load()
    const timer = window.setInterval(load, 15_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [address, key])

  return marks
}
