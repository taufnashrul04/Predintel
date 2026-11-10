import { useEffect, useState } from 'react'

// Polymarket wallets you can copy. Their trades run on Polygon; copies land as paper trades on the
// matching WaterX market on Sui (WaterX mirrors Polymarket markets).

export interface PolymarketTrader {
  wallet: string
  trader: string | null
  volume: number
  trades: number
  buys: number
  copyable: number
  lastAt: string
  lastMarket: string
}

export interface SuiTarget {
  market?: string
  outcome?: string
  label?: string
  reason?: string
}

export interface PolymarketSignal {
  id: string
  wallet: string
  trader: string | null
  side: string
  outcome: string
  price: number
  notional: number
  market: string
  url: string
  at: string
  sui: SuiTarget
}

export const isPolygonAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a)
export const polymarketProfile = (wallet: string) => `https://polymarket.com/profile/${wallet}`

function usePolledJson<T>(url: string | null, everyMs: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!url) {
      setData(null)
      return
    }
    let cancelled = false
    const load = () =>
      fetch(url)
        .then(async r => {
          const body = await r.json()
          if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`)
          if (!cancelled) {
            setData(body)
            setError(null)
          }
        })
        .catch(err => !cancelled && setError(err.message))
    load()
    const t = window.setInterval(load, everyMs)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [url, everyMs])
  return { data, error }
}

export function usePolymarketTraders() {
  const { data, error } = usePolledJson<{ traders: PolymarketTrader[]; minUsd: number }>('/api/copy/polymarket/traders', 60_000)
  return { traders: data?.traders ?? null, minUsd: data?.minUsd ?? 1000, error }
}

export function usePolymarketSignals(wallets: string[]) {
  const list = wallets.filter(isPolygonAddress).sort().join(',')
  const { data, error } = usePolledJson<{ signals: PolymarketSignal[] }>(
    list ? `/api/copy/polymarket/signals?wallets=${list}` : null,
    30_000
  )
  return { signals: data?.signals ?? null, error }
}
