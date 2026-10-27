import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts'
import { Panel, StatCard } from '../components/SharedUI'

export default function PickJournalPage() {
  const [picks, setPicks] = useState<any[]>([])
  const [tradesHistory, setTradesHistory] = useState<any[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      fetch('/api/picks').then(r => r.json()),
      fetch('/api/trade/history').then(r => r.json())
    ]).then(([p, t]) => {
      setPicks(Array.isArray(p) ? p : [])
      setTradesHistory(Array.isArray(t) ? t : [])
    }).catch(console.error)
  }, [])

  const calibrationData = [
    { bin: '10%', predicted: 10, actual: 12 },
    { bin: '20%', predicted: 20, actual: 18 },
    { bin: '30%', predicted: 30, actual: 29 },
    { bin: '40%', predicted: 40, actual: 44 },
    { bin: '50%', predicted: 50, actual: 51 },
    { bin: '60%', predicted: 60, actual: 63 },
    { bin: '70%', predicted: 70, actual: 68 },
    { bin: '80%', predicted: 80, actual: 76 },
    { bin: '90%', predicted: 90, actual: 92 }
  ]

  return (
    <div className="space-y-md">
      {/* Stats Summary with Trades Count */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-sm">
        <StatCard label="Total Picks Logged" value={picks.length} subtext="Tracked on Walrus" />
        <StatCard label="Win Rate" value="68.4%" change="+4.1%" changePositive={true} />
        <StatCard label="Brier Calibration" value="0.094" subtext="Lower is superior" />
        <StatCard label="Avg Edge vs Market" value="+6.2pp" subtext="Consensus divergence" />
        <StatCard label="Trades Executed" value={tradesHistory.length} subtext="Live Terminal Fills" />
      </div>

      {/* Forecaster Calibration Diagram */}
      <Panel title="Forecaster Calibration Curve (Reliability Diagram)" badge="DIAGNOSTIC">
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={calibrationData}>
              <XAxis dataKey="bin" stroke="#5C6773" fontSize={10} />
              <YAxis stroke="#5C6773" fontSize={10} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0D1117', borderColor: '#1F2933', fontSize: '11px' }}
              />
              <Line
                type="linear"
                dataKey="predicted"
                stroke="#5C6773"
                strokeDasharray="4 4"
                name="Perfect Calibration"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#22D3EE"
                strokeWidth={2}
                name="Actual Hit Rate"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <div className="bg-primary border border-secondary rounded-xl p-xl shadow-xs">
          <div className="flex items-center justify-between text-xs mb-xxs">
            <span className="text-utility-success-700 font-bold">WON (+18 Credibility)</span>
            <span className="text-quaternary font-mono">Resolved 10/15</span>
          </div>
          <div className="text-xs font-semibold text-primary">EU AI Act upheld by European Court of Justice?</div>
          <p className="text-[11px] text-tertiary mt-xs">
            You predicted: <strong className="text-primary font-mono">85%</strong> · Market consensus at pick:{' '}
            <strong className="text-quaternary font-mono">75%</strong> · Final Outcome:{' '}
            <strong className="text-utility-success-700 font-mono">YES (100%)</strong>
          </p>
        </div>

        <div className="bg-primary border border-secondary rounded-xl p-xl shadow-xs">
          <div className="flex items-center justify-between text-xs mb-xxs">
            <span className="text-utility-error-700 font-bold">LOST (-8 Credibility)</span>
            <span className="text-quaternary font-mono">Resolved 10/24</span>
          </div>
          <div className="text-xs font-semibold text-primary">US CPI YoY above 3% in November?</div>
          <p className="text-[11px] text-tertiary mt-xs">
            You predicted: <strong className="text-primary font-mono">72% NO</strong> · Market consensus at pick:{' '}
            <strong className="text-quaternary font-mono">63.5%</strong> · Final Outcome:{' '}
            <strong className="text-utility-error-700 font-mono">YES (3.1%)</strong>
          </p>
        </div>
      </div>

      {/* Picks Log Table */}
      <Panel title="Picks Log" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-quaternary border-b border-secondary uppercase text-[11px] font-semibold bg-secondary">
                <th className="py-xs px-sm">Pick ID</th>
                <th className="py-xs px-sm">Market Event</th>
                <th className="py-xs px-sm">Your Odds</th>
                <th className="py-xs px-sm">Consensus at Pick</th>
                <th className="py-xs px-sm">Stake</th>
                <th className="py-xs px-sm">Result</th>
                <th className="py-xs px-sm text-right">Reasoning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary">
              {picks.map((p: any) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/markets/${p.eventId}`)}
                  className="hover:bg-secondary-hover cursor-pointer transition-colors"
                >
                  <td className="py-sm px-sm text-quaternary">{p.id}</td>
                  <td className="py-sm px-sm font-sans font-medium text-primary">{p.eventId}</td>
                  <td className="py-sm px-sm font-bold text-brand-primary">
                    {(p.probability * 100).toFixed(1)}%
                  </td>
                  <td className="py-sm px-sm text-tertiary">
                    {(p.consensusAtPick * 100).toFixed(1)}%
                  </td>
                  <td className="py-sm px-sm">${p.stake || 100}</td>
                  <td className="py-sm px-sm">
                    <span
                      className={`text-[10px] px-xs py-none rounded uppercase font-bold ${
                        p.result === 'won'
                          ? 'bg-utility-success-50 text-utility-success-700'
                          : p.result === 'lost'
                          ? 'bg-utility-error-50 text-utility-error-700'
                          : 'bg-secondary text-utility-warning-700'
                      }`}
                    >
                      {p.result}
                    </span>
                  </td>
                  <td className="py-sm px-sm text-right font-sans text-tertiary truncate max-w-xs">
                    {p.reasoning}
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
