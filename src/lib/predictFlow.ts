import { useEffect, useState } from 'react'

export interface PredictFill {
  digest: string
  at: string
  accountId: string
  owner: string | null
  signer: string | null
  marketId: string
  closesAt: string | null
  action: 'buy' | 'sell'
  side: 'up' | 'down' | 'range' | 'sell' | null
  strike: number | null
  upper: number | null
  cost: number
  payout: number
  probability: number | null
  fee: number
}

export interface PredictTrader {
  accountId: string
  owner: string | null
  signer: string | null
  fills: number
  buys: number
  sells: number
  volume: number
  payout: number
  up: number
  down: number
  markets: number
  lastAt: string
}

export interface PredictCrowd {
  marketId: string
  side: 'up' | 'down' | 'range'
  strike: number | null
  upper: number | null
  closesAt: string | null
  accounts: number
  accountIds: string[]
  owners: (string | null)[]
  fills: number
  volume: number
  payout: number
  avgProbability: number | null
  lastAt: string
}

interface SideTotal {
  volume: number
  accounts: number
}

export interface PredictFlow {
  source: string
  fetchedAt: string
  window: { from: string | null; to: string | null }
  ownersResolved: number
  totals: { fills: number; traders: number; volume: number; up: SideTotal; down: SideTotal; range: SideTotal }
  fills: PredictFill[]
  traders: PredictTrader[]
  crowds: PredictCrowd[]
}

// Owner resolution runs in the background on the server, so poll until it settles.
export function usePredictFlow(refreshMs = 30_000) {
  const [flow, setFlow] = useState<PredictFlow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch('/api/predict-flow')
        .then(async r => {
          const body = await r.json()
          if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`)
          if (!cancelled) {
            setFlow(body)
            setError(null)
          }
        })
        .catch(err => !cancelled && setError(err.message))
    load()
    const timer = window.setInterval(load, refreshMs)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [refreshMs])

  return { flow, error }
}

export const shortId = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
export const usdFmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
