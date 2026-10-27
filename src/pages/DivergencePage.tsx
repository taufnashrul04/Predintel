import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Panel } from '../components/SharedUI'
import { VENUE_MAP } from '../lib/config/venues'

export default function DivergencePage() {
  const [divergences, setDivergences] = useState<any[]>([])
  const [threshold, setThreshold] = useState<number>(5.0)
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`/api/divergence?threshold=${threshold}`)
      .then(r => r.json())
      .then(d => setDivergences(Array.isArray(d) ? d : []))
      .catch(console.error)
  }, [threshold])

  return (
    <div className="space-y-md">
      <div className="bg-primary border border-secondary rounded-xl p-xl shadow-xs flex flex-wrap items-center justify-between gap-md">
        <div>
          <h2 className="text-heading-xs font-bold text-primary">Cross-Venue Divergence &amp; Arbitrage Scanner</h2>
          <p className="text-xs text-secondary mt-xxs">
            Identifies pricing discrepancies across venue order books where spread exceeds threshold.
          </p>
        </div>

        <div className="flex items-center gap-sm bg-secondary p-sm rounded-lg border border-secondary text-xs font-mono">
          <span className="text-quaternary">Spread Threshold:</span>
          <span className="text-utility-warning-700 font-bold text-sm">+{threshold.toFixed(1)}pp</span>
          <input
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={threshold}
            onChange={e => setThreshold(parseFloat(e.target.value))}
            className="w-32 accent-amber-400"
          />
        </div>
      </div>

      <Panel title="Live Divergence Matches" badge={`${divergences.length} DETECTED`} noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                <th className="py-xs px-sm">Market Event</th>
                <th className="py-xs px-sm">Outcome</th>
                <th className="py-xs px-sm">Consensus</th>
                <th className="py-xs px-sm">Lowest Venue (Buy)</th>
                <th className="py-xs px-sm">Highest Venue (Sell)</th>
                <th className="py-xs px-sm">Spread Gap</th>
                <th className="py-xs px-sm">Gross Edge</th>
                <th className="py-xs px-sm text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {divergences.map((d: any, idx: number) => (
                <tr
                  key={idx}
                  onClick={() => navigate(`/markets/${d.event.slug || d.event.id}`)}
                  className="hover:bg-secondary-hover cursor-pointer transition-colors"
                >
                  <td className="py-sm px-sm font-sans font-medium text-primary">
                    <div className="truncate max-w-sm">{d.event.title}</div>
                    <span className="text-[10px] text-tertiary uppercase">{d.event.category}</span>
                  </td>
                  <td className="py-sm px-sm font-bold text-brand-primary">{d.outcome?.label || 'YES'}</td>
                  <td className="py-sm px-sm">{(d.consensus * 100).toFixed(1)}¢</td>
                  <td className="py-sm px-sm text-utility-success-700">
                    <div className="font-bold">
                      {VENUE_MAP.get(d.minQuote.venueId)?.name} @ {(d.minQuote.lastPrice * 100).toFixed(1)}¢
                    </div>
                    <div className="text-[10px] text-quaternary">
                      Ask: {(d.minQuote.bestAsk * 100).toFixed(1)}¢
                    </div>
                  </td>
                  <td className="py-sm px-sm text-utility-error-700">
                    <div className="font-bold">
                      {VENUE_MAP.get(d.maxQuote.venueId)?.name} @ {(d.maxQuote.lastPrice * 100).toFixed(1)}¢
                    </div>
                    <div className="text-[10px] text-quaternary">
                      Bid: {(d.maxQuote.bestBid * 100).toFixed(1)}¢
                    </div>
                  </td>
                  <td className="py-sm px-sm font-bold text-utility-warning-700">
                    +{d.spreadPp.toFixed(1)}pp
                  </td>
                  <td className="py-sm px-sm font-bold text-utility-success-700">
                    +{d.arbitrageEdge.toFixed(1)}%
                  </td>
                  <td className="py-sm px-sm text-right">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        navigate(`/trade?market=${d.event.slug || d.event.id}&outcome=${d.outcome?.id || 'yes'}`)
                      }}
                      className="px-sm py-xxs bg-secondary hover:bg-brand-solid hover:text-primary-on-brand rounded text-xs transition-colors font-bold"
                    >
                      Trade Arb →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
