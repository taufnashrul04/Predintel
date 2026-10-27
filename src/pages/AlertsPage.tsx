import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Panel } from '../components/SharedUI'
import { useApp } from '../context/AppContext'

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [newKind, setNewKind] = useState('divergence')
  const [newThreshold, setNewThreshold] = useState('6.0')
  const navigate = useNavigate()
  const { showToast } = useApp()

  const refreshData = () => {
    Promise.all([
      fetch('/api/alerts').then(r => r.json()),
      fetch('/api/alerts/rules').then(r => r.json())
    ]).then(([a, r]) => {
      setAlerts(Array.isArray(a) ? a : [])
      setRules(Array.isArray(r) ? r : [])
    }).catch(console.error)
  }

  useEffect(() => {
    refreshData()
  }, [])

  const handleMarkAll = async () => {
    await fetch('/api/alerts/read-all', { method: 'POST' })
    refreshData()
    showToast('All alerts marked as read')
  }

  const handleCreateRule = async () => {
    await fetch('/api/alerts/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: newKind,
        threshold: parseFloat(newThreshold),
        enabled: true
      })
    })
    refreshData()
    showToast('New alert trigger rule activated')
  }

  return (
    <div className="space-y-md">
      <div className="flex items-center justify-between bg-primary border border-secondary p-xl rounded-xl shadow-xs">
        <div>
          <h2 className="text-heading-xs font-bold text-primary">Alerts &amp; Real-Time Triggers</h2>
          <p className="text-xs text-secondary mt-xxs">
            Continuous surveillance over venue divergences, whale sweeps, and event resolutions.
          </p>
        </div>
        <button
          onClick={handleMarkAll}
          className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-sm font-semibold text-secondary border border-primary shadow-xs hover:bg-secondary-hover"
        >
          Mark All Read
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        {/* Alerts Feed */}
        <Panel title="Surveillance Feed" className="lg:col-span-2" noPadding>
          <div className="divide-y divide-secondary">
            {alerts.map((a: any) => (
              <div
                key={a.id}
                onClick={() => a.eventId && navigate(`/markets/${a.eventId}`)}
                className={`p-md flex items-start justify-between gap-sm cursor-pointer transition-colors ${
                  !a.read ? 'bg-secondary/60 hover:bg-secondary' : 'hover:bg-secondary-hover'
                }`}
              >
                <div className="flex items-start gap-sm">
                  <span
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      a.severity === 'high'
                        ? 'bg-utility-error-700'
                        : a.severity === 'warn'
                        ? 'bg-utility-warning-700'
                        : 'bg-brand-solid'
                    }`}
                  />
                  <div>
                    <div className="text-xs font-medium text-primary font-sans">{a.message}</div>
                    <div className="text-[11px] text-quaternary font-mono mt-xxs">
                      {a.createdAt.substring(11, 19)} · Kind: {a.kind}
                    </div>
                  </div>
                </div>
                {!a.read && (
                  <span className="w-2 h-2 rounded-full bg-brand-solid shrink-0" title="Unread" />
                )}
              </div>
            ))}
          </div>
        </Panel>

        {/* Alert Rules Manager */}
        <Panel title="Alert Rules">
          <div className="space-y-sm text-xs font-mono">
            <div className="space-y-xs">
              {rules.map((r: any) => (
                <div
                  key={r.id}
                  className="p-xs bg-secondary rounded-md border border-secondary flex items-center justify-between"
                >
                  <div>
                    <div className="text-primary font-semibold uppercase">{r.kind}</div>
                    <div className="text-quaternary text-[11px]">Threshold: {r.threshold}</div>
                  </div>
                  <span
                    className={`text-[10px] px-xs rounded ${
                      r.enabled
                        ? 'bg-utility-success-50 text-utility-success-700 font-bold'
                        : 'bg-secondary text-quaternary'
                    }`}
                  >
                    {r.enabled ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-sm border-t border-secondary space-y-sm">
              <div className="text-quaternary uppercase text-[11px] font-semibold">New Rule Trigger</div>
              <div className="flex flex-col gap-sm">
                <label className="text-sm font-medium text-secondary">Trigger Condition</label>
                <select
                  value={newKind}
                  onChange={e => setNewKind(e.target.value)}
                  className="rounded-md bg-primary px-lg py-sm text-sm text-primary border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <option value="divergence">Cross-Venue Spread (pp)</option>
                  <option value="whale">Whale Order ($)</option>
                  <option value="odds_move">Odds Momentum (pp/hr)</option>
                </select>
              </div>
              <div className="flex flex-col gap-sm">
                <label className="text-sm font-medium text-secondary">Threshold Value</label>
                <input
                  type="number"
                  value={newThreshold}
                  onChange={e => setNewThreshold(e.target.value)}
                  placeholder="e.g. 5.0"
                  className="rounded-md bg-primary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                />
              </div>
              <button
                onClick={handleCreateRule}
                className="w-full inline-flex items-center justify-center gap-sm rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-sm font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                + Add Alert Rule
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
