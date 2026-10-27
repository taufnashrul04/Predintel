import React, { useState } from 'react'
import { Panel } from '../components/SharedUI'
import { VENUES } from '../lib/config/venues'
import { useApp } from '../context/AppContext'

export default function SettingsPage() {
  const [density, setDensity] = useState<'compact' | 'comfortable'>('compact')
  const { theme, toggleTheme, showToast } = useApp()

  return (
    <div className="space-y-md max-w-4xl">
      <div className="bg-primary border border-secondary rounded-xl p-xl shadow-xs">
        <h2 className="text-heading-xs font-bold text-primary">Terminal Settings &amp; Node Status</h2>
        <p className="text-xs text-secondary mt-xxs">
          Manage connectivity, Tatum multi-chain RPC gateway keys, and Walrus client namespace.
        </p>
      </div>

      <Panel title="7 Connected Venues Status">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
          {VENUES.map(v => (
            <div
              key={v.id}
              className="p-sm bg-secondary rounded-xl border border-secondary flex items-center justify-between text-xs font-mono"
            >
              <div className="flex items-center gap-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.color }} />
                <div>
                  <div className="font-bold text-primary">{v.name}</div>
                  <div className="text-[11px] text-quaternary">
                    {v.chain} · {v.type.toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-utility-success-700 font-bold">100% LIVE</span>
                <div className="text-[11px] text-tertiary">{v.latencyMs}ms</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Tatum Blockchain RPC &amp; Walrus Memory Keys">
        <div className="space-y-sm text-xs font-mono">
          <div>
            <label className="text-quaternary block mb-xxs">TATUM_API_KEY (Server Environment):</label>
            <input
              type="password"
              disabled
              value="tatum_live_pk_********************************"
              className="w-full bg-secondary border border-secondary rounded p-xs text-tertiary"
            />
          </div>

          <div>
            <label className="text-quaternary block mb-xxs">WALRUS AGENT ID &amp; NAMESPACE:</label>
            <input
              type="text"
              disabled
              value="ag_predictintel_main / predictintel (walrus-mainnet)"
              className="w-full bg-secondary border border-secondary rounded p-xs text-tertiary"
            />
          </div>

          <div className="pt-sm flex items-center justify-between border-t border-secondary">
            <div>
              <div className="font-semibold text-primary">Terminal Theme</div>
              <div className="text-quaternary text-[11px]">Dark Bloomberg Terminal / Light Mode</div>
            </div>
            <button
              onClick={toggleTheme}
              className="px-md py-xs rounded bg-secondary border border-secondary text-primary font-bold text-xs"
            >
              Current: {theme.toUpperCase()} (Toggle)
            </button>
          </div>

          <div className="pt-sm flex items-center justify-between border-t border-secondary">
            <div>
              <div className="font-semibold text-primary">Terminal UI Density</div>
              <div className="text-quaternary text-[11px]">Toggle between compact 13px Bloomberg density</div>
            </div>
            <div className="flex items-center gap-xxs bg-secondary p-xxs rounded border border-secondary">
              <button
                onClick={() => {
                  setDensity('compact')
                  showToast('Density set to Compact')
                }}
                className={`px-sm py-xxs rounded ${
                  density === 'compact' ? 'bg-brand-solid text-primary-on-brand' : 'text-quaternary'
                }`}
              >
                Compact
              </button>
              <button
                onClick={() => {
                  setDensity('comfortable')
                  showToast('Density set to Comfortable')
                }}
                className={`px-sm py-xxs rounded ${
                  density === 'comfortable' ? 'bg-brand-solid text-primary-on-brand' : 'text-quaternary'
                }`}
              >
                Comfortable
              </button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}
