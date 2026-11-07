import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { toggleTerminal } from './TerminalConsole'

export function CommandPalette() {
  const { cmdOpen, setCmdOpen } = useApp()
  const [query, setQuery] = useState('')
  const [markets, setMarkets] = useState<any[]>([])
  const [wallets, setWallets] = useState<any[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    if (cmdOpen) {
      Promise.all([
        fetch('/api/markets').then(r => r.json()),
        fetch('/api/wallets').then(r => r.json())
      ]).then(([m, w]) => {
        setMarkets(Array.isArray(m) ? m : [])
        setWallets(Array.isArray(w) ? w : [])
      }).catch(() => {})
    }
  }, [cmdOpen])

  if (!cmdOpen) return null

  const items = [
    ...markets.map(m => ({
      type: 'Market',
      title: m.title,
      sub: `${m.category} · ${(m.consensus * 100).toFixed(1)}%`,
      action: () => {
        navigate(`/markets/${m.slug || m.id}`)
        setCmdOpen(false)
      }
    })),
    ...wallets.map(w => ({
      type: 'Wallet',
      title: w.label || `${w.address.slice(0, 8)}...${w.address.slice(-6)}`,
      sub: `${w.chain} · Win: ${(w.winRate * 100).toFixed(0)}% · Cred: ${w.credibilityScore}`,
      action: () => {
        navigate(`/wallets/${w.address}`)
        setCmdOpen(false)
      }
    })),
    {
      type: 'Console',
      title: 'Open command terminal (`)',
      sub: 'Type commands: markets, odds, buy, flow, wallet, track',
      action: () => {
        setCmdOpen(false)
        toggleTerminal()
      }
    },
    {
      type: 'Trade',
      title: 'Open Trade Terminal (/trade)',
      sub: 'Smart order routing, Sui Agent x402, and live order books',
      action: () => {
        navigate('/trade')
        setCmdOpen(false)
      }
    },
    {
      type: 'Page',
      title: 'Divergence Scanner (/divergence)',
      sub: 'Scan cross-venue price spreads ≥ 5pp',
      action: () => {
        navigate('/divergence')
        setCmdOpen(false)
      }
    },
    {
      type: 'Page',
      title: 'Walrus Memory Browser (/memory)',
      sub: 'Search encrypted recall memories',
      action: () => {
        navigate('/memory')
        setCmdOpen(false)
      }
    },
    {
      type: 'Page',
      title: 'Forecaster Leaderboard (/leaderboard)',
      sub: 'Calibrated rankings by Brier score',
      action: () => {
        navigate('/leaderboard')
        setCmdOpen(false)
      }
    }
  ].filter(i =>
    i.title.toLowerCase().includes(query.toLowerCase()) ||
    i.type.toLowerCase().includes(query.toLowerCase()) ||
    i.sub.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-md">
      <div className="fixed inset-0 bg-overlay opacity-70" onClick={() => setCmdOpen(false)}></div>
      <div className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-lg bg-primary shadow-2xl border border-secondary">
        <header className="flex items-center gap-sm border-b border-secondary p-xl">
          <Search className="size-4 shrink-0 text-fg-quaternary" />
          <input
            type="text"
            autoFocus
            placeholder="Jump to market, wallet, or view..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-primary placeholder:text-placeholder focus:outline-none"
          />
          <button
            onClick={() => setCmdOpen(false)}
            className="p-xs text-quaternary hover:text-primary rounded focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-md space-y-xxs max-h-80">
          {items.length === 0 ? (
            <div className="p-xl text-center text-xs text-quaternary">
              No matches found for "{query}"
            </div>
          ) : (
            items.map((item, idx) => (
              <button
                key={idx}
                onClick={item.action}
                className="w-full text-left p-sm rounded-md hover:bg-secondary-hover transition-colors flex items-center justify-between group focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <div>
                  <div className="text-xs font-medium text-primary flex items-center gap-xs">
                    <span className="text-xs px-xs py-none rounded bg-secondary text-quaternary border border-secondary font-mono">
                      {item.type}
                    </span>
                    <span>{item.title}</span>
                  </div>
                  <div className="text-xs text-quaternary mt-xxs">{item.sub}</div>
                </div>
                <ChevronRight className="size-4 text-quaternary group-hover:text-primary transition-colors" />
              </button>
            ))
          )}
        </div>

        <footer className="flex justify-between items-center border-t border-secondary p-md bg-secondary text-[11px] text-quaternary font-mono">
          <span>Navigation: Enter / Click</span>
          <span>Close: Esc</span>
        </footer>
      </div>
    </div>
  )
}
