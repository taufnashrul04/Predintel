import React, { useCallback, useEffect, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { Panel } from '../SharedUI'
import { formatTimeAgo } from '../../lib/formatters'
import { WalletSnapshot } from '../../lib/myWallets'

const REFRESH_MS = 30_000

export const suiscanTx = (digest: string) => `https://suiscan.xyz/mainnet/tx/${digest}`
export const suiscanAccount = (address: string) => `https://suiscan.xyz/mainnet/account/${address}`

export const fmtToken = (n: number, digits = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export function useWalletSnapshot(address: string | null) {
  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    if (!address) return
    setLoading(true)
    fetch(`/api/wallets/${address}/live`)
      .then(async r => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`)
        setSnapshot(body)
        setError(null)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [address])

  useEffect(() => {
    setSnapshot(null)
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  return { snapshot, error, loading, reload: load }
}

function Change({ value, unit }: { value: number; unit: string }) {
  if (Math.abs(value) < 1e-9) return null
  return (
    <span className={value > 0 ? 'text-utility-success-700' : 'text-utility-error-700'}>
      {value > 0 ? '+' : '−'}
      {fmtToken(Math.abs(value), unit === 'SUI' ? 4 : 2)} {unit}
    </span>
  )
}

export default function LiveWalletPanel({ address }: { address: string }) {
  const { snapshot, error, loading, reload } = useWalletSnapshot(address)

  return (
    <Panel
      title="Live on-chain"
      badge="SUI MAINNET"
      badgeVariant="success"
      actions={
        <div className="flex items-center gap-sm text-xs font-mono text-quaternary">
          {snapshot && <span>Updated {formatTimeAgo(snapshot.fetchedAt)}</span>}
          <button
            onClick={reload}
            disabled={loading}
            aria-label="Refresh live data"
            className="p-xxs rounded hover:bg-secondary-hover hover:text-primary disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      }
    >
      {error && !snapshot && (
        <p className="text-xs text-utility-error-700">Couldn't load live data: {error}</p>
      )}
      {!snapshot && !error && <div className="h-24 rounded bg-secondary animate-pulse" />}
      {snapshot && (
        <div className="space-y-md text-xs font-mono">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
            <div className="p-sm rounded-lg bg-secondary border border-secondary">
              <div className="text-quaternary text-[11px] uppercase">SUI</div>
              <div className="text-primary font-bold text-sm">{fmtToken(snapshot.sui, 4)}</div>
            </div>
            <div className="p-sm rounded-lg bg-secondary border border-secondary">
              <div className="text-quaternary text-[11px] uppercase">USDC</div>
              <div className="text-primary font-bold text-sm">{fmtToken(snapshot.usdc)}</div>
            </div>
            <div className="p-sm rounded-lg bg-secondary border border-secondary">
              <div className="text-quaternary text-[11px] uppercase">Value (SUI + USDC)</div>
              <div className="text-primary font-bold text-sm">
                {snapshot.valueUsd == null ? '—' : `$${fmtToken(snapshot.valueUsd)}`}
              </div>
              {snapshot.suiPrice != null && (
                <div className="text-quaternary text-[10px]">SUI ${snapshot.suiPrice.toFixed(4)} · DeepBook</div>
              )}
            </div>
            <div className="p-sm rounded-lg bg-secondary border border-secondary">
              <div className="text-quaternary text-[11px] uppercase">Other tokens</div>
              <div className="text-primary font-bold text-sm">
                {snapshot.otherTokens}
                {snapshot.moreTokens ? '+' : ''}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-xs">
              <span className="text-quaternary text-[11px] uppercase font-semibold">Recent transactions</span>
              <a
                href={suiscanAccount(address)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-xxs text-brand-primary hover:underline"
              >
                Suiscan <ExternalLink className="size-3" />
              </a>
            </div>
            {snapshot.transactions.length === 0 ? (
              <p className="text-tertiary font-sans">No transactions found for this address.</p>
            ) : (
              <div className="divide-y divide-secondary border border-secondary rounded-lg">
                {snapshot.transactions.map(tx => (
                  <div key={tx.digest} className="flex flex-wrap items-center justify-between gap-sm px-sm py-xs">
                    <a
                      href={suiscanTx(tx.digest)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:text-brand-primary hover:underline"
                    >
                      {tx.digest.slice(0, 10)}…
                    </a>
                    <div className="flex items-center gap-sm">
                      <Change value={tx.suiChange} unit="SUI" />
                      <Change value={tx.usdcChange} unit="USDC" />
                      {tx.otherChanges > 0 && <span className="text-quaternary">+{tx.otherChanges} token</span>}
                      <span className={tx.status === 'SUCCESS' ? 'text-quaternary' : 'text-utility-error-700'}>
                        {tx.status === 'SUCCESS' ? '' : tx.status}
                      </span>
                      <span className="text-quaternary w-16 text-right">{tx.timestamp ? formatTimeAgo(tx.timestamp) : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-[10px] text-quaternary">Source: {snapshot.source}. Refreshes every 30s.</p>
        </div>
      )}
    </Panel>
  )
}
